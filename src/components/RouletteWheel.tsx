import { useState, useRef, useEffect, useMemo } from 'react';
import type { Restaurant } from '@/types';
import { Loader2, MapPin, Clock3, Star, Phone } from 'lucide-react';
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
}: RouletteWheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const wheelScrollRef = useRef<HTMLDivElement>(null);
  const wheelContainerRef = useRef<HTMLDivElement>(null);
  const [spinResult, setSpinResult] = useState<Restaurant | null>(null);
  const currentRotationRef = useRef(0);
  const [wheelSize, setWheelSize] = useState(320);

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

  const recenterWheel = () => {
    const target = wheelScrollRef.current ?? wheelContainerRef.current;
    if (!target) return;

    // Some layouts reflow right after click; a second scroll on the next frame is more reliable on mobile.
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const handleSpin = () => {
    if (isSpinning || restaurants.length === 0 || !canSpin) return;

    // Re-center the wheel in view when starting a spin (especially useful on mobile).
    recenterWheel();

    setIsSpinning(true);
    setSpinResult(null);

    const currentRotation = currentRotationRef.current;
    const additionalRotation = 1440 + Math.random() * 720;
    const targetRotation = currentRotation + additionalRotation;
    
    const segmentAngle = 360 / restaurants.length;
    const finalRotation = targetRotation % 360;
    const selectedIndex = Math.floor((360 - finalRotation) / segmentAngle) % restaurants.length;
    const result = restaurants[selectedIndex];

    gsap.to(wheelRef.current, {
      rotation: targetRotation,
      duration: 5,
      ease: 'power4.out',
      onUpdate: () => {
        if (wheelRef.current) {
          currentRotationRef.current = gsap.getProperty(wheelRef.current, 'rotation') as number;
        }
      },
      onComplete: () => {
        setIsSpinning(false);
        setSpinResult(result);
        onSpinComplete(result);

        setTimeout(() => {
          const resultCard = document.getElementById('spin-result-card');
          if (resultCard) {
            resultCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            requestAnimationFrame(() => {
              resultCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
          }
        }, 100);
      },
    });
  };

  // Reset wheel position when restaurants change
  useEffect(() => {
    if (wheelRef.current) {
      gsap.set(wheelRef.current, { rotation: 0 });
      currentRotationRef.current = 0;
    }
  }, [restaurants]);

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
    <div className="flex flex-col items-center gap-8 py-8">
      {/* Roulette Wheel */}
      <div ref={wheelScrollRef} className="relative mx-auto w-full max-w-[28rem] px-3 sm:px-4 overflow-hidden">
        {/* Pointer */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
          <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[30px] border-t-eatspin-orange drop-shadow-lg" />
        </div>

        {/* Wheel Container */}
        <div
          ref={wheelContainerRef}
          className="relative w-full aspect-square"
          style={{ maxWidth: 'min(90vw, 28rem)' }}
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
              const maxFontSize = wheelSize * 0.045;
              const minFontSize = wheelSize * 0.022;
              const lengthFactor = Math.min(Math.max((nameLength - 4) / 24, 0), 1);
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
                  {restaurant.distance && (
                    <span 
                      className="text-[8px] sm:text-[10px] font-semibold whitespace-nowrap"
                      style={{
                        color: textColor,
                        textShadow: '0 1px 3px rgba(0,0,0,0.8), 0 1px 1px rgba(0,0,0,0.6)',
                        opacity: 0.9,
                      }}
                    >
                      {restaurant.distance.toFixed(1)}km
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
        onClick={handleSpin}
        disabled={isSpinning || !canSpin}
        className="sticky bottom-3 sm:static z-30 relative overflow-hidden w-full max-w-sm px-8 sm:px-12 py-5 bg-brand-orange text-white font-heading text-xl font-bold rounded-2xl shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        <span className={`transition-opacity duration-300 ${isSpinning ? 'opacity-0' : 'opacity-100'}`}>
          {spinButtonLabel}
        </span>
        {isSpinning && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
          </span>
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
        <div id="spin-result-card" className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-eatspin-peach text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="w-2 h-2 bg-eatspin-success rounded-full animate-pulse" />
              <span className="text-sm font-medium text-eatspin-success">Your Food Destiny</span>
            </div>
            
            <h3 className="font-heading text-2xl font-bold text-brand-black mb-3">
              {spinResult.name}
            </h3>
            
            {!isManualResult && (
              <div className="space-y-2 text-sm">
              <div className="flex items-center justify-center gap-2 text-eatspin-gray-1">
                <MapPin size={16} className="text-eatspin-orange flex-shrink-0" />
                <span>{spinResult.address}</span>
              </div>
              
              <div className="flex items-center justify-center gap-2 text-eatspin-gray-1">
                <Star size={16} className="text-yellow-500 flex-shrink-0" />
                <span>{spinResult.rating} / 5.0</span>
                <span className="text-eatspin-gray-2">•</span>
                <span className="text-eatspin-orange font-medium">{spinResult.priceRange}</span>
              </div>
              
              {spinResult.distance && (
                <div className="flex items-center justify-center gap-2 text-eatspin-gray-1">
                  <Clock3 size={16} className="text-eatspin-orange flex-shrink-0" />
                  <span>{spinResult.distance.toFixed(1)} km away</span>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-eatspin-gray-1">
                <Clock3 size={16} className="text-eatspin-orange flex-shrink-0" />
                <span>{getOpeningHoursLabel(spinResult)}</span>
              </div>
              
              {spinResult.phone && (
                <div className="flex items-center justify-center gap-2 text-eatspin-gray-1">
                  <Phone size={16} className="text-eatspin-orange flex-shrink-0" />
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
