import { useState, useEffect, useCallback } from 'react';
import { useLocation } from '@/hooks/useLocation';
import { useSpinTracker } from '@/hooks/useSpinTracker';
import type { FoodCategory, MealTime, Restaurant } from '@/types';
import { penangRestaurants } from '@/data/restaurants';
import { enhancedFilterRestaurants } from '@/lib/restaurantUtils';
import { getCurrentMealTime } from '@/lib/utils';
import { FoodCategorySelector } from '@/components/FoodCategorySelector';
import { RouletteWheel } from '@/components/RouletteWheel';
import { LocationPermission } from '@/components/LocationPermission';
import { SubscriptionModal } from '@/components/SubscriptionModal';
import { MealTimeIndicator } from '@/components/MealTimeIndicator';
import { SpinLimitWarning } from '@/components/SpinLimitWarning';
import { Navbar } from '@/sections/Navbar';
import { Hero } from '@/sections/Hero';
import { HowItWorks } from '@/sections/HowItWorks';
import { Features } from '@/sections/Features';
import { Testimonials } from '@/sections/Testimonials';
import { CTA } from '@/sections/CTA';
import { Footer } from '@/sections/Footer';
import { Button } from '@/components/ui/button';
import { RotateCcw, Crown, MapPin, Utensils } from 'lucide-react';
import './App.css';

function App() {
  // State management
  const [selectedCategories, setSelectedCategories] = useState<FoodCategory[]>([]);
  const [selectedPriceRanges, setSelectedPriceRanges] = useState<Restaurant['priceRange'][]>([]);
  const [nonHalalOnly, setNonHalalOnly] = useState(false);
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>([]);
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showSpinLimitWarning, setShowSpinLimitWarning] = useState(false);
  const [currentMealTime, setCurrentMealTime] = useState<MealTime>('none');
  const [isPremium, setIsPremium] = useState(false);
  const [spinResult, setSpinResult] = useState<Restaurant | null>(null);
  const [showWheelSection, setShowWheelSection] = useState(false);
  const [wheelRestaurants, setWheelRestaurants] = useState<Restaurant[]>([]);

  // Custom hooks
  const { location, error: locationError, isLoading: locationLoading, requestLocation } = useLocation();
  const { canSpin, recordSpin } = useSpinTracker();

  const priceOptions: Restaurant['priceRange'][] = ['$', '$$', '$$$', '$$$$'];

  const togglePriceRange = (price: Restaurant['priceRange']) => {
    setSelectedPriceRanges((prev) =>
      prev.includes(price) ? prev.filter((p) => p !== price) : [...prev, price]
    );
  };

  // Update current meal time
  useEffect(() => {
    const updateMealTime = () => {
      setCurrentMealTime(getCurrentMealTime());
    };
    
    updateMealTime();
    const interval = setInterval(updateMealTime, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, []);

  // Filter restaurants when location, categories, or radius change
  useEffect(() => {
    const filtered = enhancedFilterRestaurants(
      penangRestaurants,
      location,
      selectedCategories,
      radiusKm,
      selectedPriceRanges,
      nonHalalOnly
    );
    setFilteredRestaurants(filtered);
  }, [location, selectedCategories, radiusKm, selectedPriceRanges, nonHalalOnly]);

  // Handle spin complete
  const handleSpinComplete = useCallback((restaurant: Restaurant) => {
    setSpinResult(restaurant);
    recordSpin(restaurant.id, currentMealTime);
  }, [currentMealTime, recordSpin]);

  // Handle spin attempt
  const handleSpinAttempt = () => {
    if (!canSpin(currentMealTime)) {
      setShowSpinLimitWarning(true);
      return false;
    }
    return true;
  };

  // Handle subscription
  const handleSubscribe = () => {
    setIsPremium(true);
    setShowSubscription(false);
    setShowSpinLimitWarning(false);
  };

  // Reset wheel
  const resetWheel = () => {
    setSpinResult(null);
    setShowSpinLimitWarning(false);
  };

  // Shuffle wheel restaurants
  const shuffleWheel = () => {
    const shuffled = [...filteredRestaurants].sort(() => Math.random() - 0.5);
    setWheelRestaurants(shuffled.slice(0, 12));
  };

  // Main App Content
  return (
    <div className="min-h-screen bg-brand-linen">
      {/* Navigation */}
      <Navbar 
        isPremium={isPremium} 
        onUpgradeClick={() => setShowSubscription(true)} 
      />

      {/* Hero Section */}
       <Hero onGetStarted={() => {
         const appSection = document.getElementById('app');
         appSection?.scrollIntoView({ behavior: 'smooth' });
       }} />

      {/* How It Works Section */}
      <HowItWorks />

      {/* Features Section */}
      <Features />

      {/* Main App Section */}
      <section id="app" className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-8">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-brand-black mb-4">
              Let's Find You Something to Eat!
            </h2>
            <p className="text-eatspin-gray-1 max-w-lg mx-auto">
              Select your food preferences and spin the wheel to discover your next meal
            </p>
          </div>

          {/* Location Permission */}
          {!location && (
            <div className="mb-8">
              <LocationPermission
                isLoading={locationLoading}
                error={locationError}
                onRequestLocation={requestLocation}
                location={location}
              />
            </div>
          )}

          {/* Location Status */}
          {location && (
            <div className="mb-6 flex items-center justify-center">
              <div className="flex items-center gap-2 px-4 py-2 bg-eatspin-success/10 rounded-full">
                <div className="w-2 h-2 bg-eatspin-success rounded-full animate-pulse" />
                <MapPin size={16} className="text-eatspin-success" />
                <span className="text-sm font-medium text-eatspin-success">
                  Finding restaurants near you
                </span>
              </div>
            </div>
          )}

          {/* Radius Selector */}
          {location && (
            <div className="mb-6 max-w-md mx-auto">
              <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                Search Radius: <span className="text-brand-orange font-bold">{radiusKm} km</span>
              </label>
              <input
                type="range"
                min="1"
                max="50"
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-orange"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1 km</span>
                <span>25 km</span>
                <span>50 km</span>
              </div>
            </div>
          )}

          {/* Meal Time Indicator */}
          <div className="mb-6 flex justify-center">
            <MealTimeIndicator />
          </div>

          {/* Food Category Selector */}
          <div className="mb-8">
            <FoodCategorySelector
              selectedCategories={selectedCategories}
              onCategoryChange={setSelectedCategories}
              maxSelection={3}
            />
          </div>

          {/* Price Range Selector */}
          <div className="mb-8">
            <div className="mb-4 text-center">
              <h3 className="font-heading text-lg font-semibold text-brand-black mb-2">
                Price range
              </h3>
              <p className="text-sm text-eatspin-gray-1">
                Select any (optional)
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {priceOptions.map((price) => {
                const isSelected = selectedPriceRanges.includes(price);
                return (
                  <button
                    key={price}
                    type="button"
                    onClick={() => togglePriceRange(price)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                      isSelected
                        ? 'bg-brand-orange text-white shadow-lg'
                        : 'bg-white text-brand-black border border-gray-200 hover:border-brand-orange hover:text-brand-orange'
                    }`}
                  >
                    {price}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dietary Preference */}
          <div className="mb-8">
            <div className="mb-4 text-center">
              <h3 className="font-heading text-lg font-semibold text-brand-black mb-2">
                Dietary preference
              </h3>
              <p className="text-sm text-eatspin-gray-1">
                Show only non-halal options
              </p>
            </div>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setNonHalalOnly((prev) => !prev)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  nonHalalOnly
                    ? 'bg-brand-orange text-white shadow-lg'
                    : 'bg-white text-brand-black border border-gray-200 hover:border-brand-orange hover:text-brand-orange'
                }`}
              >
                Non-Halal Only
              </button>
            </div>
          </div>

          {/* Restaurant Count */}
          {location && (
            <div className="text-center mb-6">
              <p className="text-sm text-eatspin-gray-1">
                <span className="font-semibold text-brand-orange">{filteredRestaurants.length}</span>{' '}
                restaurants within {radiusKm} km
                {(selectedCategories.length > 0 || nonHalalOnly) && ' match your preferences'}
              </p>
            </div>
          )}

          {/* Spin Limit Warning */}
          {showSpinLimitWarning && currentMealTime !== 'none' && (
            <div className="mb-6">
              <SpinLimitWarning
                mealTime={currentMealTime}
                onUpgrade={() => setShowSubscription(true)}
                onClose={() => setShowSpinLimitWarning(false)}
              />
            </div>
          )}

          {/* Action Buttons */}
          {location && filteredRestaurants.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
               <Button
                  onClick={() => {
                    if (handleSpinAttempt()) {
                      shuffleWheel();
                      setShowWheelSection(true);
                      // Navigate to wheel section
                      setTimeout(() => {
                        const wheelSection = document.getElementById('wheel');
                        wheelSection?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 100);
                    }
                  }}
                 disabled={isSpinning || filteredRestaurants.length === 0}
                 className="w-full sm:w-auto bg-brand-orange hover:bg-brand-orange/90 text-white font-heading text-base sm:text-lg font-bold px-6 sm:px-8 py-5 sm:py-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 disabled:opacity-70"
               >
                <Utensils size={20} className="mr-2" />
                Spin for {currentMealTime !== 'none' ? currentMealTime : 'Food'}
              </Button>

              {spinResult && (
                <Button
                  onClick={resetWheel}
                  variant="outline"
                  className="w-full sm:w-auto border-eatspin-orange text-eatspin-orange hover:bg-eatspin-orange/10 font-medium px-6 py-5 sm:py-6 rounded-full"
                >
                  <RotateCcw size={18} className="mr-2" />
                  Spin Again
                </Button>
              )}
            </div>
          )}

          {/* Premium Status */}
          {!isPremium && (
            <div className="text-center">
              <button
                onClick={() => setShowSubscription(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full text-sm font-medium hover:shadow-lg transition-all duration-300 hover:scale-105"
              >
                <Crown size={16} />
                Upgrade to Premium for unlimited spins
              </button>
            </div>
          )}

          {/* Premium User Badge */}
          {isPremium && (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full text-sm font-medium">
                <Crown size={16} />
                Premium Member - Unlimited Spins
              </div>
            </div>
          )}
        </div>
      </section>

       {/* Roulette Wheel Section */}
       {showWheelSection && location && filteredRestaurants.length > 0 && (
         <section id="wheel" className="py-16 px-4 sm:px-6 lg:px-8 bg-brand-linen">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-brand-black mb-2">
                Spin the Wheel!
              </h2>
              <p className="text-eatspin-gray-1">
                {filteredRestaurants.length} restaurants within {radiusKm} km ready to be discovered
              </p>
            </div>

            <RouletteWheel
              restaurants={wheelRestaurants}
              totalCount={filteredRestaurants.length}
              onSpinComplete={handleSpinComplete}
              isSpinning={isSpinning}
              setIsSpinning={setIsSpinning}
              onShuffle={shuffleWheel}
            />
          </div>
        </section>
      )}

      {/* Testimonials Section */}
      <Testimonials />

      {/* CTA Section */}
      <CTA />

      {/* Footer */}
      <Footer />

      {/* Subscription Modal */}
      <SubscriptionModal
        isOpen={showSubscription}
        onClose={() => setShowSubscription(false)}
        onSubscribe={handleSubscribe}
      />
    </div>
  );
}

export default App;
