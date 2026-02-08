import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { Restaurant } from '@/types';
import { Loader2, MapPin, Clock3, Star, Phone, Trophy, Crown } from 'lucide-react';
import gsap from 'gsap';
import { foodCategories } from '@/data/restaurants';
import { Button } from '@/components/ui/button';

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
}

// Vibrant appetizing color palette
const WHEEL_COLORS = [
  '#FF6B6B', // Juicy tomato red
  '#FF9F43', // Orange spice
  '#F4C430', // Sunny yellow (slightly darker for white text)
  '#6BCB77', // Fresh green
  '#4D96FF', // Appetizing blue
  '#A45EE5', // Vibrant purple
  '#FF6B6B', // Juicy tomato red
  '#FF9F43', // Orange spice
  '#F4C430', // Sunny yellow (slightly darker for white text)
  '#6BCB77', // Fresh green
  '#4D96FF', // Appetizing blue
  '#A45EE5', // Vibrant purple
  '#FF6B6B', // Juicy tomato red
  '#FF9F43', // Orange spice
];

function getSegmentColor(index: number): string {
  return WHEEL_COLORS[index % WHEEL_COLORS.length];
}


const getOpeningHoursLabel = (restaurant: Restaurant): string => {
  const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayKey = dayOrder[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const todayHours = restaurant.hours[dayKey];
  const dailyHours = restaurant.hours.daily;
  const fallbackHours = Object.values(restaurant.hours)[0];
  const selectedHours = todayHours ?? dailyHours ?? fallbackHours;

  if (!selectedHours || selectedHours.closed) return 'Closed today';
  return `Open ${selectedHours.open} • Close ${selectedHours.close}`;
};

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
}: RouletteWheelProps) {
  const ANTICIPATION_DURATION_S = 0.5;
  const ANTICIPATION_DEG = 50;
  const SPIN_DURATION_S = 5.8;
  const WINNER_PULSE_DURATION_MS = 900;

  const wheelRef = useRef<HTMLDivElement>(null);
  const wheelScrollRef = useRef<HTMLDivElement>(null);
  const wheelContainerRef = useRef<HTMLDivElement>(null);
  const previousRestaurantsRef = useRef(restaurants);
  const winnerPulseTimeoutRef = useRef<number | null>(null);
  const [spinResult, setSpinResult] = useState<Restaurant | null>(null);
  const currentRotationRef = useRef(0);
  const [wheelSize, setWheelSize] = useState(320);
  const celebrationTimeoutsRef = useRef<number[]>([]);
  const celebrationElementsRef = useRef<HTMLElement[]>([]);
  const recenterTimeoutRef = useRef<number | null>(null);
  const resultScrollTimeoutRef = useRef<number | null>(null);
  const lastExternalSpinIdRef = useRef('');
  const [winnerSliceIndex, setWinnerSliceIndex] = useState<number | null>(null);
  const [isWinnerSliceHighlighted, setIsWinnerSliceHighlighted] = useState(false);

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

    recenterWheel();
    setIsSpinning(true);
    setSpinResult(null);
    setWinnerSliceIndex(null);
    setIsWinnerSliceHighlighted(false);
    if (winnerPulseTimeoutRef.current !== null) {
      window.clearTimeout(winnerPulseTimeoutRef.current);
      winnerPulseTimeoutRef.current = null;
    }
    gsap.killTweensOf(wheelRef.current);

    const timeline = gsap.timeline();
    timeline.to(wheelRef.current, {
      rotation: currentRotationRef.current - ANTICIPATION_DEG,
      duration: ANTICIPATION_DURATION_S,
      ease: 'back.inOut(1.2)',
      onUpdate: () => {
        if (wheelRef.current) {
          currentRotationRef.current = gsap.getProperty(wheelRef.current, 'rotation') as number;
        }
      },
    });

    timeline.to(wheelRef.current, {
      rotation: targetRotation,
      duration: SPIN_DURATION_S,
      ease: 'power4.out',
      onUpdate: () => {
        if (wheelRef.current) {
          currentRotationRef.current = gsap.getProperty(wheelRef.current, 'rotation') as number;
        }
      },
      onComplete: () => {
        setIsSpinning(false);
        setSpinResult(result);
        setWinnerSliceIndex(selectedIndex);
        setIsWinnerSliceHighlighted(true);
        winnerPulseTimeoutRef.current = window.setTimeout(() => {
          setIsWinnerSliceHighlighted(false);
        }, WINNER_PULSE_DURATION_MS);
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
  }, [onSpinComplete, recenterWheel, restaurants, setIsSpinning]);

  const handleLocalSpin = () => {
    if (isSpinning || restaurants.length === 0 || !canSpin) return;
    const spinRestaurants = onSpinStart?.() ?? restaurants;
    if (spinRestaurants.length < 2) return;
    const randomIndex = Math.floor(Math.random() * spinRestaurants.length);
    animateSpinToIndex(randomIndex, spinRestaurants);
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
    }
  }, [isSpinning, restaurants]);

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
      if (recenterTimeoutRef.current !== null) {
        window.clearTimeout(recenterTimeoutRef.current);
      }
      if (resultScrollTimeoutRef.current !== null) {
        window.clearTimeout(resultScrollTimeoutRef.current);
      }
      if (winnerPulseTimeoutRef.current !== null) {
        window.clearTimeout(winnerPulseTimeoutRef.current);
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
  const centerX = wheelSize / 2;
  const centerY = wheelSize / 2;
  // Position text at 65% from center to give more space with larger center circle
  const textRadius = (wheelSize / 2) * 0.66;
  const isManualResult = Boolean(
    spinResult
      && (spinResult.id.startsWith('manual-')
        || spinResult.address === 'Your custom pick'
        || spinResult.description === 'Added by you.')
  );

  return (
    <div className="flex flex-col items-center gap-6 py-4 sm:py-5">
      {/* Roulette Wheel */}
      <div ref={wheelScrollRef} className="relative mx-auto w-full max-w-[32.5rem] px-2 sm:px-3 overflow-hidden">
        {/* Pointer */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
          <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[30px] border-t-eatspin-orange drop-shadow-lg" />
        </div>

        {/* Wheel Container */}
        <div
          ref={wheelContainerRef}
          className="relative w-full aspect-square"
          style={{ maxWidth: 'min(85vw, 32.5rem)' }}
        >
          {/* Wheel */}
          <div
            ref={wheelRef}
            className="w-full h-full rounded-full shadow-2xl relative overflow-hidden"
            style={{
              background: wheelBackground,
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

            {/* Restaurant names positioned with polar coordinates */}
            {restaurants.map((restaurant, index) => {
              const startAngle = (360 / restaurants.length) * index;
              const midAngle = startAngle + segmentAngle / 2;
              // Convert polar to cartesian coordinates
              // Subtract 90 degrees because 0 degrees is at 3 o'clock, we want it at 12 o'clock
              const angleRad = ((midAngle - 90) * Math.PI) / 180;
              const x = centerX + textRadius * Math.cos(angleRad);
              const y = centerY + textRadius * Math.sin(angleRad);
              
               // Text rotation: always point toward center
              // Add 90 degrees to make text read from outside toward center
              const textRotation = midAngle + 90;
              
              // All colors in our palette have good contrast with white text
              const textColor = '#FFFFFF';
              
              const displayName = restaurant.name;
              const nameLength = displayName.length;
              const maxFontSize = wheelSize * 0.054;
              const minFontSize = wheelSize * 0.022;
              const lengthFactor = Math.min(Math.max((nameLength - 5) / 30, 0), 1);
              const baseFontSize =
                maxFontSize - (maxFontSize - minFontSize) * lengthFactor;
              const maxLabelWidth = wheelSize * 0.28;
              const estimatedCharWidth = 0.6;
              const fitFontSize = maxLabelWidth / Math.max(nameLength * estimatedCharWidth, 1);
              const computedFontSize = Math.max(
                minFontSize,
                Math.min(baseFontSize, fitFontSize),
              );
              const fontWeight = nameLength <= 5 ? 700 : 600;
              
              return (
                <div
                  key={restaurant.id}
                  className="absolute flex flex-col items-center"
                  style={{
                    left: `${(x / wheelSize) * 100}%`,
                    top: `${(y / wheelSize) * 100}%`,
                    transform: `translate(-50%, -50%) rotate(${textRotation}deg)`,
                    transformOrigin: 'center center',
                  }}
                >
                  <span
                    className="text-center leading-tight whitespace-nowrap"
                    style={{
                      color: textColor,
                      fontSize: `${computedFontSize}px`,
                      fontWeight,
                      maxWidth: `${maxLabelWidth}px`,
                      textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 1px 1px rgba(0,0,0,0.8)',
                    }}
                  >
                    {displayName}
                  </span>
                  {restaurant.distance !== undefined && (
                    <span 
                      className="text-[8px] sm:text-[10px] font-semibold whitespace-nowrap"
                      style={{
                        color: textColor,
                        textShadow: '0 1px 3px rgba(0,0,0,0.8), 0 1px 1px rgba(0,0,0,0.6)',
                        opacity: 0.9,
                      }}
                    >
                      {restaurant.distance.toFixed(1)} km
                    </span>
                  )}
                </div>
              );
            })}

            {/* Larger Center Circle */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full shadow-xl flex items-center justify-center z-20 border-4 border-eatspin-peach">
              <span className="text-base sm:text-lg font-heading text-eatspin-orange font-bold">SPIN</span>
            </div>
            
            {/* Inner decorative ring */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-white/20 pointer-events-none" />
          </div>

          {/* Decorative outer rings */}
          <div className="absolute inset-0 rounded-full border-6 border-white/20 pointer-events-none shadow-inner" />
          <div className="absolute inset-0 rounded-full border-[3px] border-eatspin-peach/60 pointer-events-none" />
        </div>
      </div>

      {/* Spin Button */}
      <button
        onClick={handleSpinClick}
        disabled={isSpinning || !canSpin || (Boolean(onRequestSpin) && !canRequestSpin)}
        className="sticky bottom-3 sm:static z-30 relative overflow-hidden w-full max-w-sm px-8 sm:px-12 py-5 bg-brand-orange text-white font-heading text-xl font-bold rounded-2xl shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {isSpinning ? (
          <span className="inline-flex items-center justify-center gap-2" aria-live="polite">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
            <span className="text-base sm:text-lg">Spinning...</span>
          </span>
        ) : (
          <span>{spinButtonLabel}</span>
        )}
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

      {/* Result Display */}
      {spinResult && (
        <div id="spin-result-card" className="w-full max-w-md relative z-10">
          <div className="celebration-ring celebration-ring-sm" />
          <div className="celebration-ring celebration-ring-lg" />

          <div className="celebration-crown-badge">
            <Crown size={16} className="text-yellow-900" />
            <span>FOOD DESTINY</span>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 border text-center relative celebration-result-card">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="w-2 h-2 bg-eatspin-success rounded-full animate-pulse" />
              <span className="text-sm font-semibold text-[#B8860B]">Your Food Destiny</span>
            </div>

            <h3 className="font-heading text-2xl font-bold text-brand-black mb-3 flex items-center justify-center gap-2">
              <Trophy size={20} className="celebration-floating-icon text-[#F4C430]" />
              {spinResult.name}
              <Trophy size={20} className="celebration-floating-icon text-[#FFD700]" />
            </h3>
            
            {!isManualResult && (
              <div className="space-y-2 text-sm">
              <div className="flex items-center justify-center gap-2 text-eatspin-gray-1">
                <MapPin size={16} className="text-[#F4C430] flex-shrink-0" />
                <span>{spinResult.address}</span>
              </div>
              
              <div className="flex items-center justify-center gap-2 text-eatspin-gray-1">
                <Star size={16} className="text-[#FFD700] flex-shrink-0" />
                <span>{spinResult.rating} / 5.0</span>
                <span className="text-eatspin-gray-2">•</span>
                <span className="text-eatspin-orange font-medium">{spinResult.priceRange}</span>
              </div>
              
              {spinResult.distance !== undefined && (
                <div className="flex items-center justify-center gap-2 text-eatspin-gray-1">
                  <Clock3 size={16} className="text-[#F4C430] flex-shrink-0" />
                  <span>{spinResult.distance.toFixed(1)} km away</span>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-eatspin-gray-1">
                <Clock3 size={16} className="text-[#F4C430] flex-shrink-0" />
                <span>{getOpeningHoursLabel(spinResult)}</span>
              </div>
              
              {spinResult.phone && (
                <div className="flex items-center justify-center gap-2 text-eatspin-gray-1">
                  <Phone size={16} className="text-[#F4C430] flex-shrink-0" />
                  <a href={`tel:${spinResult.phone}`} className="hover:text-eatspin-orange">
                    {spinResult.phone}
                  </a>
                </div>
              )}
              </div>
            )}
            
            {spinResult.description && (
               <p className="mt-4 text-sm text-eatspin-gray-1 leading-relaxed">
                {spinResult.description}
              </p>
            )}
            
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {spinResult.category.slice(0, 3).map((cat) => {
                const categoryConfig = foodCategories.find((c) => c.id === cat);
                return (
                  <span
                    key={cat}
                    className="px-3 py-1 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: categoryConfig?.color || '#F54703' }}
                  >
                    {categoryConfig?.icon} {categoryConfig?.name}
                  </span>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {onEditList && (
                <Button variant="outline" onClick={onEditList}>
                  Edit list
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
