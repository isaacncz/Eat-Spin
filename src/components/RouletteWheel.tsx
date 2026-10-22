import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { Restaurant } from '@/types';
import { Loader2, MapPin, Clock3, Star, Phone, Trophy, Heart, Navigation, Share2, Volume2, VolumeX, RefreshCw } from 'lucide-react';
import gsap from 'gsap';
import { foodCategories } from '@/data/restaurants';
import { Button } from '@/components/ui/button';
import { playSpinTick, playSpinWin, startSpinDrumroll, stopSpinDrumroll, triggerSpinHaptic } from '@/lib/spinAudio';
import { PhotoCarousel } from '@/components/PhotoCarousel';
import { RarityRibbon } from '@/components/RarityBadge';
import { RewardTiles } from '@/components/RewardReveal';
import { LevelUpDialog } from '@/components/LevelUpDialog';
import { getRarity, type Rarity } from '@/lib/rarity';
import type { LetsGoReward } from '@/lib/letsGoReward';
import { getMapsUrl } from '@/lib/maps';


interface RouletteWheelProps {
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

/** Estimate travel time from straight-line distance using road detour factor. */
const estimateTravelTime = (straightLineKm: number): string => {
  const roadKm = straightLineKm * 1.4; // detour factor
  if (roadKm <= 1.2) {
    // Walking range
    const minutes = Math.round((roadKm / 5) * 60); // 5 km/h walk speed
    return `~${Math.max(1, minutes)} min walk`;
  }
  // Driving range — urban avg ~30 km/h
  const minutes = Math.round((roadKm / 30) * 60);
  return `~${Math.max(1, minutes)} min drive`;
};

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

const wrapLabelText = (text: string, maxCharsPerLine: number, maxLines: number): string[] => {
  const words = text.split(' ').filter(Boolean);
  const lines: string[] = [];

  for (const word of words) {
    const currentLine = lines[lines.length - 1] ?? '';
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (!currentLine || nextLine.length <= maxCharsPerLine) {
      if (currentLine) {
        lines[lines.length - 1] = nextLine;
      } else {
        lines.push(word);
      }
      continue;
    }

    if (lines.length < maxLines) {
      lines.push(word);
      continue;
    }

    lines[lines.length - 1] = `${currentLine.slice(0, Math.max(currentLine.length - 1, 1))}…`;
    return lines;
  }

  if (lines.length > maxLines) {
    return lines.slice(0, maxLines);
  }

  return lines;
};

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
const SOUND_PREF_STORAGE_KEY = 'eatspin:sound-enabled';

const loadSoundPreference = (): boolean => {
  if (typeof window === 'undefined') return true;
  const storedValue = window.localStorage.getItem(SOUND_PREF_STORAGE_KEY);
  if (storedValue === null) return true;
  return storedValue !== '0';
};


import { getSmartHoursLabel } from '@/lib/smartHours';

export function RouletteWheel({
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
  const resultScrollTimeoutRef = useRef<number | null>(null);
  const lastExternalSpinIdRef = useRef('');
  const [winnerSliceIndex, setWinnerSliceIndex] = useState<number | null>(null);
  const [isWinnerSliceHighlighted, setIsWinnerSliceHighlighted] = useState(false);
  const resultCardRef = useRef<HTMLDivElement>(null);
  const lastTickSegmentRef = useRef<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => loadSoundPreference());
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  // No separate drawer state needed — "Let's Go!" opens Google Maps directly
  const canPlayEffects = soundEnabled && !prefersReducedMotion;

  useEffect(() => {
    getLastVisitedAtRef.current = getLastVisitedAt;
  }, [getLastVisitedAt]);

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
        emoji.style.left = `${Math.random() * 100}vw`;
        emoji.style.top = `${62 + Math.random() * 32}vh`;
        emoji.style.animationDelay = `${Math.random() * 0.3}s`;
        emoji.style.fontSize = `${1 + Math.random() * 1.1}rem`;
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
  }, [scrollWheelIntoView]);

  const animateSpinToIndex = useCallback((index: number, sourceRestaurants?: Restaurant[]) => {
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
      if (!canPlayEffects) return;

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
    stopSpinDrumroll();

    const timeline = gsap.timeline();
    timeline.to(wheelRef.current, {
      rotation: currentRotationRef.current - ANTICIPATION_DEG,
      duration: ANTICIPATION_DURATION_S,
      ease: 'back.inOut(1.2)',
      onUpdate: updateSpinFrame,
    });

    if (canPlayEffects) {
      startSpinDrumroll(Math.round(SPIN_DURATION_S * 1000));
    }

    timeline.to(wheelRef.current, {
      rotation: targetRotation,
      duration: SPIN_DURATION_S,
      ease: 'power4.out',
      onUpdate: updateSpinFrame,
      onComplete: () => {
        stopSpinDrumroll();
        setIsSpinning(false);
        setSpinResult(result);
        setResultRarity(getLastVisitedAtRef.current ? getRarity(getLastVisitedAtRef.current(result)) : null);
        setWinnerSliceIndex(selectedIndex);
        setIsWinnerSliceHighlighted(true);
        winnerPulseTimeoutRef.current = window.setTimeout(() => {
          setIsWinnerSliceHighlighted(false);
        }, WINNER_PULSE_DURATION_MS);
        if (canPlayEffects) {
          playSpinWin();
          triggerSpinHaptic();
        }
        onSpinComplete(result);

        if (resultScrollTimeoutRef.current !== null) {
          window.clearTimeout(resultScrollTimeoutRef.current);
        }
        resultScrollTimeoutRef.current = window.setTimeout(() => {
          const resultCard = document.getElementById('spin-result-card');
          if (resultCard) {
            const cardRect = resultCard.getBoundingClientRect();
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
            const isFullyVisible = cardRect.top >= 0 && cardRect.bottom <= viewportHeight;
            if (!isFullyVisible) {
              resultCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
          resultScrollTimeoutRef.current = null;
        }, 100);
      },
    });
  }, [canPlayEffects, onSpinComplete, recenterWheel, restaurants, setIsSpinning, syncWheelRotationVar]);

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

  const handleSpinClick = () => {
    if (onRequestSpin) {
      if (isSpinning || !canSpin || !canRequestSpin) return;
      recenterWheel();
      void onRequestSpin();
      return;
    }
    handleLocalSpin();
  };

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
    animateSpinToIndex(externalSpin.winnerIndex);
  }, [animateSpinToIndex, externalSpin, restaurants.length]);

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

    // People who prefer reduced motion get the card and rewards with no animation at all.
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduceMotion) return;

    const resultCard = document.getElementById('spin-result-card');
    if (resultCard) {
      gsap.fromTo(
        resultCard,
        { autoAlpha: 0, y: 30, scale: 0.92 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.55)' },
      );
    }

    triggerCelebration();
  }, [spinResult, triggerCelebration]);

  useEffect(() => {
    return () => {
      clearCelebrationEffects();
      stopSpinDrumroll();
      if (recenterTimeoutRef.current !== null) {
        window.clearTimeout(recenterTimeoutRef.current);
      }
      if (resultScrollTimeoutRef.current !== null) {
        window.clearTimeout(resultScrollTimeoutRef.current);
      }
      if (winnerPulseTimeoutRef.current !== null) {
        window.clearTimeout(winnerPulseTimeoutRef.current);
      }
      if (levelUpTimeoutRef.current !== null) {
        window.clearTimeout(levelUpTimeoutRef.current);
      }
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

      const labelMaxChars = clamp(Math.floor(constrainedWidth / 10), 6, 18);
      const compactName = compactRestaurantName(restaurant.name, labelMaxChars * 2 + 5);
      const lines = wrapLabelText(compactName, labelMaxChars, 3);
      const longestLineLength = Math.max(...lines.map((line) => line.length), 1);
      const densityScale = clamp(labelMaxChars / longestLineLength, 0.75, 1.08);
      const labelBaseFontSize = clamp(Math.min(constrainedWidth * 0.16, radialBandHeight * 0.28), 11.5, 22);
      const fontSize = clamp(labelBaseFontSize * densityScale, 11.5, 24);
      const distanceLabel = canShowDistance && lines.length <= 3 && restaurant.distance !== undefined
        ? estimateTravelTime(restaurant.distance)
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
        {/* Pointer */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
          <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[30px] border-t-eatspin-orange drop-shadow-lg" />
        </div>

        {/* Wheel Container */}
        <div
          ref={wheelContainerRef}
          className="relative mx-auto w-full aspect-square"
          style={{ maxWidth: '32.5rem' }}
        >
          {/* Wheel */}
          <div
            ref={wheelRef}
            className="w-full h-full rounded-full shadow-2xl relative overflow-hidden"
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
                      color: '#FFFFFF',
                      fontSize: `${fontSize}px`,
                      fontWeight: 700,
                      textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 1px 1px rgba(0,0,0,0.8)',
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
                        color: '#FFFFFF',
                        textShadow: '0 1px 3px rgba(0,0,0,0.8), 0 1px 1px rgba(0,0,0,0.6)',
                        opacity: 0.8,
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

      {/* Spin Button */}
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

      <button
        type="button"
        onClick={() => setSoundEnabled((previous) => !previous)}
        className="inline-flex items-center gap-1.5 rounded-full border-2 border-brand-ink bg-white px-3 py-1.5 text-xs font-semibold text-eatspin-gray-1 hover:border-brand-ink hover:text-brand-orange"
      >
        {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
        {soundEnabled ? 'Sound on' : 'Sound off'}
        {prefersReducedMotion && <span className="text-[10px] text-eatspin-gray-2">(reduced motion)</span>}
      </button>

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
            className="text-sm text-eatspin-orange font-medium hover:underline disabled:opacity-50"
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
                      {estimateTravelTime(r.distance!)}
                    </span>
                  </li>
                ))}
            </ul>
          </details>
        </div>
      )}

      {/* Result Display */}
      {spinResult && (
        <div id="spin-result-card" ref={resultCardRef} className="w-full max-w-md relative z-10">
          <div className="celebration-ring celebration-ring-sm" />
          <div className="celebration-ring celebration-ring-lg" />

          <div className="bg-white rounded-2xl text-center relative celebration-result-card overflow-hidden">
            {/* Branded header strip */}
            <div className="bg-arcade-pink border-b-4 border-brand-ink px-6 py-3">
              <div className="flex items-center justify-center gap-2">
                <div className="w-2.5 h-2.5 bg-brand-ink rounded-full animate-pulse" />
                <span className="text-sm font-bold text-brand-ink tracking-wide uppercase">EatSpin picked this for you!</span>
                <div className="w-2.5 h-2.5 bg-brand-ink rounded-full animate-pulse" />
              </div>
            </div>

            {resultRarity && <RarityRibbon rarity={resultRarity} />}

            <div className="p-6">
              <h3 className="font-heading text-2xl sm:text-3xl font-bold text-brand-black mb-3 flex items-center justify-center gap-2">
                <Trophy size={22} className="celebration-floating-icon text-brand-ink" />
                {spinResult.name}
                <Trophy size={22} className="celebration-floating-icon text-brand-ink" />
              </h3>

              {!isManualResult && (spinResult.photos?.length ?? 0) > 1 ? (
                <PhotoCarousel
                  photos={spinResult.photos!}
                  alt={`Photos of ${spinResult.name}`}
                  className="mb-4"
                />
              ) : !isManualResult && spinResult.image ? (
                <div className="mb-4 overflow-hidden rounded-xl border-2 border-brand-ink">
                  <img
                    src={spinResult.image}
                    alt={`Photo of ${spinResult.name}`}
                    className="h-48 w-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : null}
              
              {!isManualResult && (
                <div className="space-y-2 text-sm">
                <div className="flex items-center justify-center gap-2 text-eatspin-gray-1">
                  <MapPin size={16} className="text-brand-orange flex-shrink-0" />
                  <span>{spinResult.address}</span>
                </div>
                
                <div className="flex items-center justify-center gap-3 text-eatspin-gray-1">
                  <span className="inline-flex items-center gap-1">
                    <Star size={16} className="text-[#FFD700] flex-shrink-0" />
                    <span className="font-semibold text-brand-black">{spinResult.rating}</span>
                    <span>/5</span>
                  </span>
                  <span className="text-eatspin-gray-3">|</span>
                  <span className="font-semibold text-brand-orange">{spinResult.priceRange}</span>
                  {spinResult.distance !== undefined && (
                    <>
                      <span className="text-eatspin-gray-3">|</span>
                      <span>{estimateTravelTime(spinResult.distance)}</span>
                    </>
                  )}
                </div>

                {(() => {
                  const hoursInfo = getSmartHoursLabel(spinResult);
                  return (
                    <div className="flex items-center justify-center gap-2">
                      <Clock3
                        size={16}
                        className={
                          hoursInfo.status === 'closing-soon'
                            ? 'text-amber-500 flex-shrink-0'
                            : hoursInfo.status === 'closed'
                              ? 'text-red-400 flex-shrink-0'
                              : 'text-brand-orange flex-shrink-0'
                        }
                      />
                      <span
                        className={
                          hoursInfo.status === 'closing-soon'
                            ? 'text-amber-600 font-medium'
                            : hoursInfo.status === 'closed'
                              ? 'text-red-400'
                              : 'text-eatspin-gray-1'
                        }
                      >
                        {hoursInfo.label}
                      </span>
                    </div>
                  );
                })()}
                
                {spinResult.phone && (
                  <div className="flex items-center justify-center gap-2 text-eatspin-gray-1">
                    <Phone size={16} className="text-brand-orange flex-shrink-0" />
                    <a href={`tel:${spinResult.phone}`} className="hover:text-eatspin-orange">
                      {spinResult.phone}
                    </a>
                  </div>
                )}
                </div>
              )}
              
              {spinResult.description && (
                 <p className="mt-3 text-sm text-eatspin-gray-1 leading-relaxed">
                  {spinResult.description}
                </p>
              )}
              
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {spinResult.category.slice(0, 3).map((cat) => {
                  const categoryConfig = foodCategories.find((c) => c.id === cat);
                  return (
                    <span
                      key={cat}
                      className="px-3 py-1 rounded-full border-2 border-brand-ink bg-white text-xs font-semibold text-brand-ink"
                      style={{ boxShadow: `0 2px 0 0 ${categoryConfig?.color || '#FF4D8D'}` }}
                    >
                      {categoryConfig?.icon} {categoryConfig?.name}
                    </span>
                  );
                })}
              </div>

              {/* Service badges */}
              {(spinResult.delivery || spinResult.takeout || spinResult.dineIn) && (
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  {spinResult.dineIn && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      🍽️ Dine-in
                    </span>
                  )}
                  {spinResult.takeout && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      📦 Takeout
                    </span>
                  )}
                  {spinResult.delivery && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                      🛵 Delivery
                    </span>
                  )}
                </div>
              )}

              {/* Vibe / context tags */}
              {(spinResult.goodForGroups || spinResult.goodForChildren || spinResult.outdoorSeating) && (
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  {spinResult.goodForGroups && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                      👥 Groups
                    </span>
                  )}
                  {spinResult.goodForChildren && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-50 text-cyan-700 border border-cyan-200">
                      👶 Kids
                    </span>
                  )}
                  {spinResult.outdoorSeating && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
                      🌿 Outdoor
                    </span>
                  )}
                </div>
              )}

              {/* AI-generated summary */}
              {spinResult.generativeSummary && (
                <p className="mt-3 text-xs italic text-eatspin-gray-1 leading-relaxed px-2">
                  "{spinResult.generativeSummary}"
                </p>
              )}

              {/* Branded footer - visible in screenshots */}
              <div className="mt-4 pt-3 border-t-2 border-brand-ink/20 flex items-center justify-center gap-2">
                <span className="text-xs font-bold text-brand-orange">🍴 EatSpin</span>
                <span className="text-[10px] text-eatspin-gray-2">•</span>
                <span className="text-[10px] text-eatspin-gray-2">Spin to decide what to eat</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="px-6 pb-6 space-y-2">
              {/* Persistent live region so screen readers announce the reward when it appears. */}
              <div role="status" aria-live="polite">
                {claim?.reward && <RewardTiles reward={claim.reward} animate={!prefersReducedMotion} />}
              </div>

              {/* Primary action: claim once, then it turns into a plain Maps link. */}
              {onLetsGo && !claim && (
                <Button
                  className="h-12 w-full bg-brand-orange hover:bg-brand-orange/90 text-white font-heading font-bold text-base rounded-xl transition-all"
                  onClick={handleClaim}
                >
                  <Navigation size={18} className="mr-1.5" />
                  Let's go! Claim reward
                </Button>
              )}
              {onLetsGo && claim && (
                <Button
                  asChild
                  variant="outline"
                  className="h-12 w-full rounded-xl border-brand-ink text-brand-ink hover:bg-arcade-yellow font-heading font-bold text-base"
                >
                  <a href={getMapsUrl(spinResult)} target="_blank" rel="noopener noreferrer">
                    <Navigation size={18} className="mr-1.5" />
                    Open in Maps
                  </a>
                </Button>
              )}

              {/* Share + Save + Spin Again */}
              <div className="flex flex-wrap gap-2">
                {onShareResult && (
                  <Button
                    variant="outline"
                    className="h-11 min-w-[7rem] flex-1 rounded-xl border-brand-orange text-brand-orange hover:bg-brand-orange/10 font-heading font-bold text-base"
                    onClick={() => {
                      const cardElement = resultCardRef.current;
                      if (!cardElement) return;
                      void onShareResult(spinResult, cardElement);
                    }}
                  >
                    <Share2 size={18} className="mr-1.5" />
                    Share
                  </Button>
                )}
                {onSaveFavourite && (
                  <Button
                    variant={isFavourite?.(spinResult) ? 'default' : 'outline'}
                    className={`h-11 min-w-[7rem] flex-1 rounded-xl ${isFavourite?.(spinResult)
                      ? 'bg-arcade-pink hover:bg-arcade-pink/90 text-brand-ink font-heading font-bold'
                      : 'text-brand-ink hover:bg-arcade-pink/20 font-heading font-bold'
                    }`}
                    onClick={() => onSaveFavourite(spinResult)}
                    disabled={isFavourite?.(spinResult)}
                  >
                    <Heart size={15} className={`mr-1 ${isFavourite?.(spinResult) ? 'fill-current' : ''}`} />
                    {isFavourite?.(spinResult) ? 'Saved!' : 'Save'}
                  </Button>
                )}
                {onSpinAgain && (
                  <Button
                    variant="outline"
                    className="h-11 min-w-[7rem] flex-1 rounded-xl border-brand-ink text-brand-black hover:bg-brand-linen font-heading font-bold"
                    onClick={() => {
                      onSpinAgain(spinResult);
                      handleLocalSpin();
                    }}
                    disabled={!canSpinAgain || isSpinning}
                  >
                    <RefreshCw size={15} className="mr-1" aria-hidden="true" />
                    Spin Again
                  </Button>
                )}
                {onEditList && (
                  <Button variant="outline" className="h-11 min-w-[7rem] flex-1 rounded-xl" onClick={onEditList}>
                    Edit list
                  </Button>
                )}
              </div>

            </div>
          </div>
        </div>
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
