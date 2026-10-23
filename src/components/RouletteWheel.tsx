import { useState, useRef, useEffect, useMemo, useCallback, useImperativeHandle, type Ref } from 'react';
import type { Restaurant } from '@/types';
import { Loader2, MapPin, Heart, Volume2, VolumeX } from 'lucide-react';
import gsap from 'gsap';
import { playSpinTick, playSpinWin, playSpinStart, stopSpinAudio, setSpinSoundEnabled, unlockSpinAudio, triggerSpinHaptic } from '@/lib/spinAudio';
import { ResultScreen, type ResultVisit } from '@/components/ResultScreen';
import { LevelUpDialog } from '@/components/LevelUpDialog';
import { getRarity, type Rarity } from '@/lib/rarity';
import type { LetsGoReward } from '@/lib/letsGoReward';
import { estimateTravelTime } from '@/lib/travelTime';
import { fitWheelLabel } from '@/lib/wheelLabel';


/** What a parent can call on the wheel. Lets a screen own the spin button. */
export interface RouletteWheelHandle {
  /** Same as tapping the built-in spin button (the host's guards and limits still apply). */
  spin: () => void;
}

interface RouletteWheelProps {
  ref?: Ref<RouletteWheelHandle>;
  /** Hide the built-in spin button when the host screen renders its own and calls `ref.spin()`. */
  hideSpinButton?: boolean;
  distanceOrigin?: string;
  /** A room can render its own inline result and attendance instead of the modal. */
  resultPresentation?: 'dialog' | 'parent';
  /** Reveal notification, including direct restoration of an older external event. */
  onResultRevealed?: (restaurant: Restaurant, spinId?: string) => void;
  /** CSS length that caps the wheel's diameter (default 32.5rem). */
  wheelMaxSize?: string;
  /** Scroll the wheel to the top of the screen when a spin starts (default true). */
  scrollOnSpin?: boolean;
  restaurants: Restaurant[];
  totalCount: number;
  onSpinComplete: (restaurant: Restaurant) => void;
  isSpinning: boolean;
  setIsSpinning: (spinning: boolean) => void;
  onShuffle: () => void;
  canSpin?: boolean;
  helperText?: string;
  spinButtonLabel?: string;
  emptyStateTitle?: string;
  emptyStateSubtitle?: string;
  onEditList?: () => void;
  externalSpin?: {
    spinId: string;
    winnerIndex: number;
    restaurant?: Restaurant;
    animate?: boolean;
  } | null;
  onRequestSpin?: () => void | Promise<void>;
  canRequestSpin?: boolean;
  onSpinStart?: () => Restaurant[] | null;
  /** Called when user taps the "★ Save" button on the spin result. */
  onSaveFavourite?: (restaurant: Restaurant) => void;
  /**
   * Called once per result when the user taps "Let's go! Claim reward". `rarity` is the
   * tier the result card showed, so the reward matches what the player saw. Return the
   * reward to show reward tiles (and a level-up modal); return nothing to skip them.
   */
  onLetsGo?: (restaurant: Restaurant, rarity?: Rarity) => LetsGoReward | void;
  /** Called when user taps "Share" on the spin result. */
  onShareResult?: (restaurant: Restaurant, cardElement: HTMLElement) => void | Promise<void>;
  /** Called before the one-tap spin-again action starts a new spin. */
  onSpinAgain?: (restaurant: Restaurant) => void;
  /** Whether spin-again has enough candidates to run. */
  canSpinAgain?: boolean;
  /** Returns true if the restaurant is already saved as a favourite. */
  isFavourite?: (restaurant: Restaurant) => boolean;
  /**
   * Epoch ms of the last visit to a restaurant (undefined = never visited). When set,
   * the result card shows a rarity ribbon. Rarity is computed from this, never stored.
   */
  getLastVisitedAt?: (restaurant: Restaurant) => number | undefined;
  /** How many times the player tapped "Let's go!" for a restaurant. Shown on the result screen. */
  getVisitCount?: (restaurant: Restaurant) => number | undefined;
}

// Vibrant appetizing color palette
// Bright arcade palette. Labels use ink (#1E1B4B), which passes 4.5:1 on every colour here.
const WHEEL_COLORS = [
  '#FF4D8D', // Pink
  '#22D3EE', // Cyan
  '#A3E635', // Lime
  '#FB923C', // Orange
  '#C4B5FD', // Violet
  '#FFD93D', // Yellow
  '#FF4D8D',
  '#22D3EE',
  '#A3E635',
  '#FB923C',
  '#C4B5FD',
  '#FFD93D',
  '#FF4D8D',
  '#22D3EE',
];

function getSegmentColor(index: number): string {
  return WHEEL_COLORS[index % WHEEL_COLORS.length];
}

const compactRestaurantName = (name: string, maxLength: number): string => {
  const normalized = name.trim().replace(/\s+/g, ' ');
  if (normalized.length <= maxLength) return normalized;

  const delimiters = [' - ', ' | ', ',', '('];
  for (const delimiter of delimiters) {
    const delimiterIndex = normalized.indexOf(delimiter);
    if (delimiterIndex > 4) {
      const compacted = normalized.slice(0, delimiterIndex).trim();
      if (compacted.length >= 4) {
        return compacted;
      }
    }
  }

  return normalized;
};

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
const SOUND_PREF_STORAGE_KEY = 'eatspin:sound-enabled';

const loadSoundPreference = (): boolean => {
  if (typeof window === 'undefined') return true;
  const storedValue = window.localStorage.getItem(SOUND_PREF_STORAGE_KEY);
  if (storedValue === null) return true;
  return storedValue !== '0';
};


export function RouletteWheel({
  ref,
  hideSpinButton = false,
  distanceOrigin,
  resultPresentation = 'dialog',
  onResultRevealed,
  wheelMaxSize = '32.5rem',
  scrollOnSpin = true,
  restaurants,
  totalCount,
  onSpinComplete,
  isSpinning,
  setIsSpinning,
  onShuffle,
  canSpin = restaurants.length > 0,
  helperText,
  spinButtonLabel = 'Spin the Wheel!',
  emptyStateTitle = 'No restaurants match your criteria',
  emptyStateSubtitle = 'Try selecting different categories or check back during meal hours',
  onEditList,
  externalSpin = null,
  onRequestSpin,
  canRequestSpin = true,
  onSpinStart,
  onSaveFavourite,
  onLetsGo,
  onShareResult,
  onSpinAgain,
  canSpinAgain = false,
  isFavourite,
  getLastVisitedAt,
  getVisitCount,
}: RouletteWheelProps) {
  const ANTICIPATION_DURATION_S = 0.5;
  const ANTICIPATION_DEG = 50;
  const SPIN_DURATION_S = 5.8;
  const WINNER_PULSE_DURATION_MS = 900;
  const LEVEL_UP_DELAY_MS = 900;

  const wheelRef = useRef<HTMLDivElement>(null);
  const wheelScrollRef = useRef<HTMLDivElement>(null);
  const wheelContainerRef = useRef<HTMLDivElement>(null);
  const previousRestaurantsRef = useRef(restaurants);
  const winnerPulseTimeoutRef = useRef<number | null>(null);
  const [spinResult, setSpinResult] = useState<Restaurant | null>(null);
  // Frozen when the wheel stops, so the tier cannot change after "Let's go!" records the visit.
  const [resultRarity, setResultRarity] = useState<Rarity | null>(null);
  const getLastVisitedAtRef = useRef(getLastVisitedAt);
  const getVisitCountRef = useRef(getVisitCount);
  // Last visit and visit count when the wheel stopped. Frozen with the rarity, since claiming records a visit.
  const [resultVisit, setResultVisit] = useState<ResultVisit | null>(null);
  // The result is a full-screen view. Back closes it and leaves a "Your pick" button under the wheel.
  const [resultOpen, setResultOpen] = useState(false);
  const reopenResultRef = useRef<HTMLButtonElement>(null);
  // Reward reveal for the current result. Reset on every spin, so it happens once per result.
  const [claim, setClaim] = useState<{ reward: LetsGoReward | null } | null>(null);
  const claimedResultRef = useRef<Restaurant | null>(null);
  const [levelUp, setLevelUp] = useState<{ level: number; open: boolean } | null>(null);
  const levelUpTimeoutRef = useRef<number | null>(null);
  const currentRotationRef = useRef(0);
  const [wheelSize, setWheelSize] = useState(320);
  const celebrationTimeoutsRef = useRef<number[]>([]);
  const celebrationElementsRef = useRef<HTMLElement[]>([]);
  const recenterTimeoutRef = useRef<number | null>(null);
  const lastExternalSpinIdRef = useRef('');
  const [winnerSliceIndex, setWinnerSliceIndex] = useState<number | null>(null);
  const [isWinnerSliceHighlighted, setIsWinnerSliceHighlighted] = useState(false);
  const lastTickSegmentRef = useRef<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => loadSoundPreference());
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  // No separate drawer state needed — "Let's Go!" opens Google Maps directly
  const canPlayEffects = soundEnabled && !prefersReducedMotion;
  const canPlayEffectsRef = useRef(canPlayEffects);

  useEffect(() => {
    canPlayEffectsRef.current = canPlayEffects;
    setSpinSoundEnabled(canPlayEffects);
  }, [canPlayEffects]);

  useEffect(() => {
    const unlock = () => { if (canPlayEffectsRef.current) void unlockSpinAudio(); };
    const visibility = () => { if (document.hidden) stopSpinAudio(); };
    window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
    window.addEventListener('keydown', unlock, true);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', stopSpinAudio);
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', stopSpinAudio);
      setSpinSoundEnabled(false);
    };
  }, []);

  useEffect(() => {
    getLastVisitedAtRef.current = getLastVisitedAt;
    getVisitCountRef.current = getVisitCount;
  }, [getLastVisitedAt, getVisitCount]);

  const syncWheelRotationVar = useCallback((rotation: number) => {
    if (!wheelRef.current) return;
    wheelRef.current.style.setProperty('--wheel-rotation', `${rotation}deg`);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    updatePreference();
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updatePreference);
    } else {
      mediaQuery.addListener(updatePreference);
    }
    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', updatePreference);
      } else {
        mediaQuery.removeListener(updatePreference);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SOUND_PREF_STORAGE_KEY, soundEnabled ? '1' : '0');
  }, [soundEnabled]);

  const clearCelebrationEffects = useCallback(() => {
    celebrationTimeoutsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    celebrationTimeoutsRef.current = [];

    celebrationElementsRef.current.forEach((node) => {
      node.remove();
    });
    celebrationElementsRef.current = [];
  }, []);

  const triggerCelebration = useCallback(() => {
    clearCelebrationEffects();

    const celebrationLayer = document.createElement('div');
    celebrationLayer.className = 'celebration-layer';
    document.body.appendChild(celebrationLayer);
    celebrationElementsRef.current.push(celebrationLayer);

    const burst = document.createElement('div');
    burst.className = 'celebration-burst';
    celebrationLayer.appendChild(burst);

    const emojis = ['🎉', '✨', '⭐', '🏆'];
    const emojiCount = 18;

    for (let i = 0; i < emojiCount; i++) {
      const timer = window.setTimeout(() => {
        const emoji = document.createElement('span');
        emoji.className = 'celebration-emoji';
        emoji.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        // Rise along the side margins so they frame the result card instead of covering its text.
        const leftSide = i % 2 === 0;
        emoji.style.left = leftSide ? `${Math.random() * 2}vw` : `${94 + Math.random() * 2}vw`;
        emoji.style.top = `${40 + Math.random() * 55}vh`;
        emoji.style.animationDelay = `${Math.random() * 0.3}s`;
        emoji.style.fontSize = `${0.85 + Math.random() * 0.35}rem`;
        celebrationLayer.appendChild(emoji);

        const removeTimer = window.setTimeout(() => {
          emoji.remove();
        }, 3000);
        celebrationTimeoutsRef.current.push(removeTimer);
      }, i * 140);

      celebrationTimeoutsRef.current.push(timer);
    }

    const cleanupTimer = window.setTimeout(() => {
      clearCelebrationEffects();
    }, 3400);
    celebrationTimeoutsRef.current.push(cleanupTimer);
  }, [clearCelebrationEffects]);

  // Generate conic gradient for wheel segments
  const wheelBackground = useMemo(() => {
    if (restaurants.length === 0) return '';
    
    const segmentAngle = 360 / restaurants.length;
    const stops: string[] = [];
    
    for (let i = 0; i < restaurants.length; i++) {
      const startAngle = i * segmentAngle;
      const endAngle = (i + 1) * segmentAngle;
      const color = getSegmentColor(i);
      stops.push(`${color} ${startAngle}deg ${endAngle}deg`);
    }
    
    return `conic-gradient(from 0deg, ${stops.join(', ')})`;
  }, [restaurants.length]);

  const scrollWheelIntoView = useCallback((behavior: ScrollBehavior) => {
    const target = wheelScrollRef.current ?? wheelContainerRef.current;
    if (!target || typeof window === 'undefined') return;

    const navbarHeight = Number.parseInt(
      window.getComputedStyle(document.documentElement).getPropertyValue('--navbar-height'),
      10,
    );
    const offset = Number.isFinite(navbarHeight) ? navbarHeight : 72;
    const targetTop = window.scrollY + target.getBoundingClientRect().top - offset - 8;
    window.scrollTo({ top: Math.max(0, targetTop), behavior });
  }, []);

  const recenterWheel = useCallback(() => {
    if (!scrollOnSpin) return;
    // First pass: smooth scroll for expected UX.
    scrollWheelIntoView('smooth');
    window.requestAnimationFrame(() => {
      scrollWheelIntoView('smooth');
    });

    // Correction pass: some browsers miss the smooth target during rapid reflow.
    if (recenterTimeoutRef.current !== null) {
      window.clearTimeout(recenterTimeoutRef.current);
    }
    recenterTimeoutRef.current = window.setTimeout(() => {
      scrollWheelIntoView('auto');
      recenterTimeoutRef.current = null;
    }, 180);
  }, [scrollOnSpin, scrollWheelIntoView]);

  const animateSpinToIndex = useCallback((index: number, sourceRestaurants?: Restaurant[], externalSpinId?: string) => {
    const targetRestaurants = sourceRestaurants ?? restaurants;
    if (targetRestaurants.length === 0) return;

    const selectedIndex = ((Math.floor(index) % targetRestaurants.length) + targetRestaurants.length) % targetRestaurants.length;
    const result = targetRestaurants[selectedIndex];
    const segmentAngle = 360 / targetRestaurants.length;
    const currentRotation = ((currentRotationRef.current % 360) + 360) % 360;
    const desiredFinalRotation = ((360 - (selectedIndex + 0.5) * segmentAngle) % 360 + 360) % 360;
    // Use whole-turn randomness so all clients can end on the exact same visual angle.
    const additionalTurns = 4 + Math.floor(Math.random() * 3);
    const additionalRotation = additionalTurns * 360;
    const delta = (desiredFinalRotation - currentRotation + 360) % 360;
    const targetRotation = currentRotationRef.current + additionalRotation + delta;
    const updateSpinFrame = () => {
      if (!wheelRef.current) return;
      currentRotationRef.current = gsap.getProperty(wheelRef.current, 'rotation') as number;
      syncWheelRotationVar(currentRotationRef.current);
      if (!canPlayEffectsRef.current) return;

      const normalizedRotation = ((currentRotationRef.current % 360) + 360) % 360;
      const currentSegment = Math.floor(normalizedRotation / segmentAngle);
      if (lastTickSegmentRef.current === null) {
        lastTickSegmentRef.current = currentSegment;
        return;
      }

      if (currentSegment !== lastTickSegmentRef.current) {
        lastTickSegmentRef.current = currentSegment;
        playSpinTick();
      }
    };

    recenterWheel();
    setIsSpinning(true);
    setSpinResult(null);
    setResultRarity(null);
    setResultVisit(null);
    setResultOpen(false);
    setClaim(null);
    setLevelUp(null);
    claimedResultRef.current = null;
    if (levelUpTimeoutRef.current !== null) {
      window.clearTimeout(levelUpTimeoutRef.current);
      levelUpTimeoutRef.current = null;
    }
    setWinnerSliceIndex(null);
    setIsWinnerSliceHighlighted(false);
    lastTickSegmentRef.current = null;
    if (winnerPulseTimeoutRef.current !== null) {
      window.clearTimeout(winnerPulseTimeoutRef.current);
      winnerPulseTimeoutRef.current = null;
    }
    gsap.killTweensOf(wheelRef.current);
    stopSpinAudio();

    const timeline = gsap.timeline();
    timeline.to(wheelRef.current, {
      rotation: currentRotationRef.current - ANTICIPATION_DEG,
      duration: ANTICIPATION_DURATION_S,
      ease: 'back.inOut(1.2)',
      onUpdate: updateSpinFrame,
    });

    if (canPlayEffectsRef.current) {
      playSpinStart();
    }

    timeline.to(wheelRef.current, {
      rotation: targetRotation,
      duration: SPIN_DURATION_S,
      ease: 'power4.out',
      onUpdate: updateSpinFrame,
      onComplete: () => {
        stopSpinAudio();
        setIsSpinning(false);
        setSpinResult(result);
        const lastVisitedAt = getLastVisitedAtRef.current?.(result);
        setResultRarity(getLastVisitedAtRef.current ? getRarity(lastVisitedAt) : null);
        setResultVisit(getLastVisitedAtRef.current ? { lastVisitedAt, visitCount: getVisitCountRef.current?.(result) } : null);
        setResultOpen(resultPresentation === 'dialog');
        setWinnerSliceIndex(selectedIndex);
        setIsWinnerSliceHighlighted(true);
        winnerPulseTimeoutRef.current = window.setTimeout(() => {
          setIsWinnerSliceHighlighted(false);
        }, WINNER_PULSE_DURATION_MS);
        if (canPlayEffectsRef.current && !document.hidden) {
          playSpinWin();
          triggerSpinHaptic();
        }
        onSpinComplete(result);
        onResultRevealed?.(result, externalSpinId);
      },
    });
  }, [onSpinComplete, onResultRevealed, recenterWheel, restaurants, resultPresentation, setIsSpinning, syncWheelRotationVar]);

  const handleLocalSpin = () => {
    if (isSpinning || restaurants.length === 0 || !canSpin) return;
    const spinRestaurants = onSpinStart?.() ?? restaurants;
    if (spinRestaurants.length < 2) return;
    const randomIndex = Math.floor(Math.random() * spinRestaurants.length);
    animateSpinToIndex(randomIndex, spinRestaurants);
  };

  // "Let's go! Claim reward": runs once per result. The ref also blocks a double tap that
  // lands before React re-renders. After the claim the primary action becomes a plain Maps link.
  const handleClaim = () => {
    if (!spinResult || !onLetsGo || claimedResultRef.current === spinResult) return;
    claimedResultRef.current = spinResult;

    const reward = onLetsGo(spinResult, resultRarity ?? undefined) ?? null;
    setClaim({ reward });

    if (reward && reward.awarded && reward.leveledUp) {
      const level = reward.level;
      if (prefersReducedMotion) {
        setLevelUp({ level, open: true });
      } else {
        // Let the tiles and confetti land before the modal covers them.
        levelUpTimeoutRef.current = window.setTimeout(() => {
          setLevelUp({ level, open: true });
          levelUpTimeoutRef.current = null;
        }, LEVEL_UP_DELAY_MS);
      }
    }
  };

  // Radix returns focus to a trigger, and the result view has none. Put it on "Your pick".
  const handleResultCloseAutoFocus = (event: Event) => {
    event.preventDefault();
    reopenResultRef.current?.focus();
  };

  const handleSpinClick = () => {
    if (onRequestSpin) {
      if (isSpinning || !canSpin || !canRequestSpin) return;
      recenterWheel();
      void onRequestSpin();
      return;
    }
    handleLocalSpin();
  };

  useImperativeHandle(ref, () => ({ spin: handleSpinClick }));

  // Reset wheel position when restaurants change
  useEffect(() => {
    const restaurantsChanged = previousRestaurantsRef.current !== restaurants;
    previousRestaurantsRef.current = restaurants;
    if (!restaurantsChanged) return;
    if (isSpinning) return;
    if (wheelRef.current) {
      gsap.set(wheelRef.current, { rotation: 0 });
      currentRotationRef.current = 0;
      syncWheelRotationVar(0);
    }
  }, [isSpinning, restaurants, syncWheelRotationVar]);

  useEffect(() => {
    if (!externalSpin || restaurants.length === 0) return;
    if (externalSpin.spinId === lastExternalSpinIdRef.current) return;
    lastExternalSpinIdRef.current = externalSpin.spinId;
    if (externalSpin.animate === false || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      const result = externalSpin.restaurant ?? restaurants[externalSpin.winnerIndex];
      if (!result) return;
      const lastVisitedAt = getLastVisitedAtRef.current?.(result);
      setSpinResult(result);
      setResultRarity(getLastVisitedAtRef.current ? getRarity(lastVisitedAt) : null);
      setResultVisit(getLastVisitedAtRef.current ? { lastVisitedAt, visitCount: getVisitCountRef.current?.(result) } : null);
      setClaim(null);
      claimedResultRef.current = null;
      setLevelUp(null);
      if (levelUpTimeoutRef.current !== null) window.clearTimeout(levelUpTimeoutRef.current);
      setResultOpen(resultPresentation === 'dialog');
      setIsSpinning(false);
      // A live reduced-motion event still completes; an older restore does not.
      if (externalSpin.animate !== false) onSpinComplete(result);
      onResultRevealed?.(result, externalSpin.spinId);
      // Restoring an old result is not a fresh spin completion or quest event.
      return;
    }
    animateSpinToIndex(externalSpin.winnerIndex, undefined, externalSpin.spinId);
  }, [animateSpinToIndex, externalSpin, onResultRevealed, onSpinComplete, restaurants, resultPresentation, setIsSpinning]);

  useEffect(() => {
    const container = wheelContainerRef.current;
    if (!container) return;

    const updateWheelSize = () => {
      const nextSize = container.offsetWidth;
      if (nextSize > 0) {
        setWheelSize(nextSize);
      }
    };

    updateWheelSize();
    const observer = new ResizeObserver(() => {
      updateWheelSize();
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!spinResult) return;

    // People who prefer reduced motion get the result and rewards with no animation at all.
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduceMotion) return;

    triggerCelebration();
  }, [spinResult, triggerCelebration]);

  useEffect(() => {
    const wheelElement = wheelRef.current;
    return () => {
      clearCelebrationEffects();
      stopSpinAudio();
      if (recenterTimeoutRef.current !== null) {
        window.clearTimeout(recenterTimeoutRef.current);
      }
      if (winnerPulseTimeoutRef.current !== null) {
        window.clearTimeout(winnerPulseTimeoutRef.current);
      }
      if (levelUpTimeoutRef.current !== null) {
        window.clearTimeout(levelUpTimeoutRef.current);
      }
      gsap.killTweensOf(wheelElement);
      // StrictMode replays mount effects after cleanup. A cancelled external
      // animation must be allowed to restart rather than remaining unrevealed.
      lastExternalSpinIdRef.current = '';
    };
  }, [clearCelebrationEffects]);

  if (restaurants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-center">
          <p className="text-lg font-medium text-eatspin-gray-1 mb-2">
            {emptyStateTitle}
          </p>
          <p className="text-sm text-eatspin-gray-2">
            {emptyStateSubtitle}
          </p>
        </div>
      </div>
    );
  }

  const segmentAngle = 360 / restaurants.length;
  const wheelRadius = wheelSize / 2;
  const outerPadding = wheelRadius * 0.08;
  const labelOuterRadius = wheelRadius - outerPadding;
  const centerButtonRadius = wheelRadius * 0.2;
  const labelInnerRadius = centerButtonRadius + wheelRadius * 0.14;
  // Pull labels closer to center when segments are wide so text stays inside the circle
  const labelRadialFraction = segmentAngle >= 120 ? 0.46 : segmentAngle >= 72 ? 0.54 : 0.62;
  const labelRadius = labelInnerRadius + (labelOuterRadius - labelInnerRadius) * labelRadialFraction;
  const centerX = wheelSize / 2;
  const centerY = wheelSize / 2;
  const angleRad = (segmentAngle * Math.PI) / 180;
  const usableArcWidth = Math.max(labelRadius * angleRad * 0.92, wheelSize * 0.19);
  const radialBandHeight = Math.max((labelOuterRadius - labelInnerRadius) * 0.8, wheelSize * 0.15);
  const canShowDistance = segmentAngle >= 22 && radialBandHeight >= 36;

  const labelLayouts = restaurants.map((restaurant, index) => {
      const startAngle = segmentAngle * index;
      const midAngle = startAngle + segmentAngle / 2;
      const pointAngleRad = ((midAngle - 90) * Math.PI) / 180;
      const x = centerX + labelRadius * Math.cos(pointAngleRad);
      const y = centerY + labelRadius * Math.sin(pointAngleRad);

      // Constrain label width so it never extends outside the wheel circle.
      // At height y the circle spans [centerX - halfChord, centerX + halfChord].
      // A centered label at x with width w spans [x - w/2, x + w/2].
      // Both edges must stay inside → w ≤ 2 × min(x - leftEdge, rightEdge - x).
      const circleClipRadius = wheelRadius - 6;
      const dy = y - centerY;
      const halfChord = Math.sqrt(Math.max(circleClipRadius * circleClipRadius - dy * dy, 0));
      const leftEdge = centerX - halfChord;
      const rightEdge = centerX + halfChord;
      const maxCircleWidth = Math.max(2 * Math.min(x - leftEdge, rightEdge - x), 40);
      const constrainedWidth = Math.min(usableArcWidth, maxCircleWidth);

      const labelBaseFontSize = clamp(Math.min(constrainedWidth * 0.16, radialBandHeight * 0.28), 11.5, 22);
      // Text box is narrower than the segment arc; leave a little side padding.
      const compactName = compactRestaurantName(restaurant.name, 28);
      const { lines, fontSize } = fitWheelLabel(compactName, constrainedWidth - 6, labelBaseFontSize);
      // One unit on the wheel: the radius is chosen in km, so distances are km too.
      const distanceLabel = canShowDistance && restaurant.distance !== undefined
        ? `${restaurant.distance.toFixed(1)} km`
        : null;

      return {
        restaurant,
        x,
        y,
        lines,
        fontSize,
        distanceLabel,
        constrainedWidth,
      };
    });

  const isManualResult = Boolean(
    spinResult
      && (spinResult.id.startsWith('manual-')
        || spinResult.address === 'Your custom pick'
        || spinResult.description === 'Added by you.')
  );

  return (
    <div className="flex flex-col items-center gap-6 py-4 sm:py-5">
      {/* Roulette Wheel */}
      <div ref={wheelScrollRef} className="relative mx-auto w-full max-w-[32.5rem] px-1 sm:px-3 overflow-hidden">
        {/* Sound: a corner icon so it does not take a row between the wheel and the Spin button. */}
        <button
          type="button"
          aria-label={soundEnabled ? 'Sound on' : 'Sound off'}
          title={prefersReducedMotion ? 'Sound is off while reduced motion is on' : soundEnabled ? 'Sound on — tap to mute' : 'Sound off — tap to unmute'}
          onClick={() => {
            const next = !soundEnabled;
            canPlayEffectsRef.current = next && !prefersReducedMotion;
            setSpinSoundEnabled(canPlayEffectsRef.current);
            setSoundEnabled(next);
            if (canPlayEffectsRef.current) void unlockSpinAudio();
          }}
          className="absolute right-1 top-0 z-30 inline-flex size-11 items-center justify-center rounded-full border-[3px] border-brand-ink bg-white text-brand-ink outline-none hover:bg-arcade-yellow/50 focus-visible:ring-[3px] focus-visible:ring-brand-ink sm:right-3"
        >
          {soundEnabled ? <Volume2 size={18} strokeWidth={2.5} aria-hidden="true" /> : <VolumeX size={18} strokeWidth={2.5} aria-hidden="true" />}
        </button>

        {/* Pointer */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
          <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[30px] border-t-eatspin-orange drop-shadow-lg" />
        </div>

        {/* Wheel Container */}
        <div
          ref={wheelContainerRef}
          className="relative mx-auto w-full aspect-square"
          style={{ maxWidth: wheelMaxSize }}
        >
          {/* Wheel */}
          <div
            ref={wheelRef}
            className={`w-full h-full rounded-full relative overflow-hidden ${hideSpinButton ? '' : 'shadow-2xl'}`}
            style={{
              background: wheelBackground,
              ['--wheel-rotation' as string]: '0deg',
            }}
          >
            {/* Segment dividers */}
            {restaurants.map((_, index) => {
              const angle = (360 / restaurants.length) * index;
              return (
                <div
                  key={`divider-${index}`}
                  className="absolute top-0 left-1/2 w-[2px] h-full bg-white/30 origin-top"
                  style={{ transform: `translateX(-50%) rotate(${angle}deg)` }}
                />
              );
            })}

            {winnerSliceIndex !== null && (
              <div
                className={`pointer-events-none absolute inset-0 rounded-full ${isWinnerSliceHighlighted ? 'winner-slice-highlight' : 'winner-slice-highlight-idle'}`}
                style={{
                  background: `conic-gradient(
                    from 0deg,
                    rgba(255, 215, 0, 0) 0deg ${(winnerSliceIndex * segmentAngle)}deg,
                    rgba(255, 215, 0, 0.34) ${(winnerSliceIndex * segmentAngle)}deg ${((winnerSliceIndex + 1) * segmentAngle)}deg,
                    rgba(255, 215, 0, 0) ${((winnerSliceIndex + 1) * segmentAngle)}deg 360deg
                  )`,
                }}
              />
            )}

            {/* Labels remain upright by counter-rotating the wheel transform. */}
            {labelLayouts.map(({ restaurant, x, y, lines, fontSize, distanceLabel, constrainedWidth }) => {
              return (
                <div
                  key={restaurant.id}
                  className="absolute flex flex-col items-center"
                  style={{
                    left: `${(x / wheelSize) * 100}%`,
                    top: `${(y / wheelSize) * 100}%`,
                    width: `${constrainedWidth}px`,
                    transform: 'translate(-50%, -50%) rotate(calc(-1 * var(--wheel-rotation)))',
                    transformOrigin: 'center center',
                  }}
                >
                  <div
                    className="text-center leading-[1.05]"
                    style={{
                      color: '#1E1B4B',
                      fontSize: `${fontSize}px`,
                      fontWeight: 700,
                    }}
                  >
                    {lines.map((line, lineIndex) => (
                      <span key={`${restaurant.id}-${lineIndex}`} className="block">
                        {line}
                      </span>
                    ))}
                  </div>
                  {distanceLabel && (
                    <span
                      className="mt-0.5 text-[10px] sm:text-[11px] font-semibold whitespace-nowrap"
                      style={{
                        color: '#1E1B4B',
                        opacity: 0.85,
                      }}
                    >
                      {distanceLabel}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Center Circle */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full flex items-center justify-center z-20 border-4 border-brand-ink shadow-pop">
              <span className="text-base sm:text-lg font-heading text-eatspin-orange font-bold">SPIN</span>
            </div>
            
            {/* Inner decorative ring */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-white/20 pointer-events-none" />
          </div>

          {/* Decorative outer rings */}
          <div className="absolute inset-0 rounded-full border-6 border-white/20 pointer-events-none shadow-inner" />
          <div className="absolute inset-0 rounded-full border-4 border-brand-ink pointer-events-none" />
        </div>
      </div>

      {/* After Back, the pick stays one tap away. */}
      {resultPresentation === 'dialog' && spinResult && !resultOpen && (
        <button
          ref={reopenResultRef}
          type="button"
          onClick={() => setResultOpen(true)}
          className="flex min-h-12 w-full max-w-sm items-center justify-center gap-2 rounded-2xl border-[3px] border-brand-ink bg-arcade-pink px-4 py-2 font-heading text-base font-bold text-brand-ink shadow-pop active:translate-y-[3px] active:shadow-none motion-reduce:transition-none"
        >
          <span className="shrink-0">Your pick:</span>
          <span className="truncate">{spinResult.name}</span>
        </button>
      )}

      {/* Spin Button */}
      {!hideSpinButton && (
      <button
        onClick={handleSpinClick}
        disabled={isSpinning || !canSpin || (Boolean(onRequestSpin) && !canRequestSpin)}
        className="sticky bottom-[calc(var(--bottom-nav-height)_+_0.75rem)] sm:static z-30 relative overflow-hidden w-full max-w-sm px-8 sm:px-12 py-6 sm:py-7 bg-brand-orange text-white font-heading text-2xl sm:text-[1.7rem] font-bold rounded-2xl border-4 border-brand-ink shadow-pop-lg active:translate-y-[3px] animate-cta-pulse transition-all duration-300 hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {isSpinning ? (
          <span className="inline-flex flex-col items-center justify-center gap-1" aria-live="polite">
            <span className="inline-flex items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
            <span className="text-lg sm:text-xl">Spinning...</span>
            </span>
            <span className="text-xs sm:text-sm font-medium opacity-85">One tap. Let fate decide.</span>
          </span>
        ) : (
          <span className="inline-flex flex-col items-center gap-1 leading-tight">
            <span>{spinButtonLabel}</span>
            <span className="text-xs sm:text-sm font-medium opacity-85">One tap. Let fate decide.</span>
          </span>
        )}
      </button>
      )}


      {helperText && (
        <p className="text-sm text-eatspin-gray-1 text-center">{helperText}</p>
      )}

      {totalCount > restaurants.length && (
        <div className="text-center">
          <p className="text-sm text-eatspin-gray-1 mb-2">
            Showing {restaurants.length} of {totalCount} restaurants
          </p>
          <button
            onClick={onShuffle}
            disabled={isSpinning}
            className="min-h-11 px-2 text-sm text-eatspin-orange font-medium hover:underline disabled:opacity-50"
          >
            ↻ Shuffle for different options
          </button>
        </div>
      )}

      {/* Distance legend – compact list of restaurants sorted by proximity */}
      {restaurants.some((r) => r.distance !== undefined) && (
        <div className="w-full max-w-md">
          <details className="group rounded-xl border-2 border-brand-ink bg-white/80 backdrop-blur-sm overflow-hidden">
            <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold text-brand-black select-none hover:bg-arcade-yellow/60 transition-colors">
              <span className="inline-flex items-center gap-2">
                <MapPin size={15} className="text-brand-orange" />
                Distance Guide
              </span>
              <span className="text-xs text-eatspin-gray-1 group-open:hidden">tap to expand</span>
              <span className="text-xs text-eatspin-gray-1 hidden group-open:inline">tap to collapse</span>
            </summary>
            <ul className="divide-y divide-brand-ink/15 px-4 pb-3">
              {[...restaurants]
                .filter((r) => r.distance !== undefined)
                .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
                .map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="flex-shrink-0 w-3 h-3 rounded-full"
                        style={{ backgroundColor: getSegmentColor(restaurants.indexOf(r)) }}
                      />
                      <span className="truncate text-brand-black">
                        {r.name}
                        {isFavourite?.(r) && (
                          <Heart size={10} className="inline ml-1 fill-arcade-pink text-brand-ink" />
                        )}
                      </span>
                    </span>
                    <span className="flex-shrink-0 text-xs font-semibold text-brand-orange tabular-nums">
                      {distanceOrigin ? `${r.distance!.toFixed(1)} km from ${distanceOrigin}` : estimateTravelTime(r.distance!)}
                    </span>
                  </li>
                ))}
            </ul>
          </details>
        </div>
      )}

      {/* Result: a full-screen view that opens when the wheel stops. */}
      {resultPresentation === 'dialog' && spinResult && (
        <ResultScreen
          open={resultOpen}
          onOpenChange={setResultOpen}
          restaurant={spinResult}
          distanceOrigin={distanceOrigin}
          isManual={isManualResult}
          rarity={resultRarity}
          visit={resultVisit}
          claim={claim}
          onClaim={onLetsGo ? handleClaim : undefined}
          animate={!prefersReducedMotion}
          onShare={onShareResult ? (cardElement) => onShareResult(spinResult, cardElement) : undefined}
          onSave={onSaveFavourite ? () => onSaveFavourite(spinResult) : undefined}
          isSaved={Boolean(isFavourite?.(spinResult))}
          onSpinAgain={onSpinAgain ? () => {
            onSpinAgain(spinResult);
            handleLocalSpin();
          } : undefined}
          canSpinAgain={canSpinAgain}
          isSpinning={isSpinning}
          onEditList={onEditList}
          onCloseAutoFocus={handleResultCloseAutoFocus}
        />
      )}

      {levelUp && (
        <LevelUpDialog
          open={levelUp.open}
          level={levelUp.level}
          onOpenChange={(open) => setLevelUp((prev) => (prev ? { ...prev, open } : prev))}
        />
      )}
    </div>
  );
}
