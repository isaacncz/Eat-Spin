import { useState, useRef, useEffect } from 'react';
import type { Restaurant } from '@/types';
import { Loader2, MapPin, Clock, Star, Phone } from 'lucide-react';
import gsap from 'gsap';
import { foodCategories } from '@/data/restaurants';

interface RouletteWheelProps {
  restaurants: Restaurant[];
  onSpinComplete: (restaurant: Restaurant) => void;
  isSpinning: boolean;
  setIsSpinning: (spinning: boolean) => void;
}

export function RouletteWheel({
  restaurants,
  onSpinComplete,
  isSpinning,
  setIsSpinning,
}: RouletteWheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const [spinResult, setSpinResult] = useState<Restaurant | null>(null);

  const handleSpin = () => {
    if (isSpinning || restaurants.length === 0) return;

    setIsSpinning(true);
    setSpinResult(null);

    // Random rotation between 720 and 1440 degrees (2-4 full rotations)
    const rotation = 720 + Math.random() * 720;
    
    // Determine which restaurant will be selected based on rotation
    const segmentAngle = 360 / restaurants.length;
    const finalRotation = rotation % 360;
    const selectedIndex = Math.floor((360 - finalRotation) / segmentAngle) % restaurants.length;
    const result = restaurants[selectedIndex];

    // Animate the wheel
    gsap.to(wheelRef.current, {
      rotation: rotation,
      duration: 3,
      ease: 'power2.out',
      onComplete: () => {
        setIsSpinning(false);
        setSpinResult(result);
        onSpinComplete(result);
      },
    });
  };

  // Reset wheel position when restaurants change
  useEffect(() => {
    if (wheelRef.current) {
      gsap.set(wheelRef.current, { rotation: 0 });
    }
  }, [restaurants]);

  if (restaurants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-center">
          <p className="text-lg font-medium text-eatspin-gray-1 mb-2">
            No restaurants match your criteria
          </p>
          <p className="text-sm text-eatspin-gray-2">
            Try selecting different categories or check back during meal hours
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-8 py-8">
      {/* Roulette Wheel */}
      <div className="relative">
        {/* Pointer */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
          <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[30px] border-t-eatspin-orange" />
        </div>

        {/* Wheel Container */}
        <div className="relative w-80 h-80 sm:w-96 sm:h-96">
          {/* Wheel */}
          <div
            ref={wheelRef}
            className="w-full h-full rounded-full shadow-2xl relative overflow-hidden"
            style={{
              background: 'conic-gradient(from 0deg, #F54703, #FF6B35, #FF8E53, #FFB07A, #FFD4A5, #FEE4C7, #F54703)',
            }}
          >
            {/* Wheel segments */}
            {restaurants.map((restaurant, index) => {
              const angle = (360 / restaurants.length) * index;
              const segmentAngle = 360 / restaurants.length;
              
              return (
                <div
                  key={restaurant.id}
                  className="absolute w-full h-full"
                  style={{
                    transform: `rotate(${angle}deg)`,
                  }}
                >
                  {/* Segment line */}
                  <div
                    className="absolute top-0 left-1/2 w-0.5 h-full bg-white/30 origin-top"
                    style={{ transform: 'translateX(-50%)' }}
                  />
                  
                  {/* Restaurant name */}
                  <div
                    className="absolute top-4 left-1/2 -translate-x-1/2 text-center"
                    style={{
                      transform: `translateX(-50%) rotate(${segmentAngle / 2}deg)`,
                      width: '80px',
                    }}
                  >
                    <span className="text-xs font-medium text-white drop-shadow-lg line-clamp-2">
                      {restaurant.name}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Center circle */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center z-10">
              <span className="text-2xl font-heading text-eatspin-orange">SPIN</span>
            </div>
          </div>

          {/* Decorative outer ring */}
          <div className="absolute inset-0 rounded-full border-4 border-eatspin-peach pointer-events-none" />
        </div>
      </div>

      {/* Spin Button */}
      <button
        onClick={handleSpin}
        disabled={isSpinning}
        className="relative overflow-hidden px-12 py-4 bg-brand-orange text-white font-heading text-xl font-bold rounded-full shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        <span className={`transition-opacity duration-300 ${isSpinning ? 'opacity-0' : 'opacity-100'}`}>
          Spin the Wheel!
        </span>
        {isSpinning && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
          </span>
        )}
      </button>

      {/* Result Display */}
      {spinResult && (
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-eatspin-peach">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-eatspin-success rounded-full animate-pulse" />
              <span className="text-sm font-medium text-eatspin-success">Your Food Destiny</span>
            </div>
            
            <h3 className="font-heading text-2xl font-bold text-brand-black mb-3">
              {spinResult.name}
            </h3>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-eatspin-gray-1">
                <MapPin size={16} className="text-eatspin-orange" />
                <span>{spinResult.address}</span>
              </div>
              
              <div className="flex items-center gap-2 text-eatspin-gray-1">
                <Star size={16} className="text-yellow-500" />
                <span>{spinResult.rating} / 5.0</span>
                <span className="text-eatspin-gray-2">•</span>
                <span className="text-eatspin-orange font-medium">{spinResult.priceRange}</span>
              </div>
              
              {spinResult.distance && (
                <div className="flex items-center gap-2 text-eatspin-gray-1">
                  <Clock size={16} className="text-eatspin-orange" />
                  <span>{spinResult.distance.toFixed(1)} km away</span>
                </div>
              )}
              
              {spinResult.phone && (
                <div className="flex items-center gap-2 text-eatspin-gray-1">
                  <Phone size={16} className="text-eatspin-orange" />
                  <a href={`tel:${spinResult.phone}`} className="hover:text-eatspin-orange">
                    {spinResult.phone}
                  </a>
                </div>
              )}
            </div>
            
            {spinResult.description && (
              <p className="mt-4 text-sm text-eatspin-gray-1 leading-relaxed">
                {spinResult.description}
              </p>
            )}
            
            <div className="mt-4 flex flex-wrap gap-2">
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
          </div>
        </div>
      )}
    </div>
  );
}