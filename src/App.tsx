import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RotateCcw, Crown, MapPin, Utensils } from 'lucide-react';
import './App.css';

type WheelMode = 'spin-for-me' | 'i-know-where';

function App() {
  // State management
  const [selectedCategories, setSelectedCategories] = useState<FoodCategory[]>([]);
  const [selectedPriceRanges, setSelectedPriceRanges] = useState<Restaurant['priceRange'][]>([]);
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showSpinLimitWarning, setShowSpinLimitWarning] = useState(false);
  const [currentMealTime, setCurrentMealTime] = useState<MealTime>('none');
  const [isPremium, setIsPremium] = useState(false);
  const [spinResult, setSpinResult] = useState<Restaurant | null>(null);
  const [activeTab, setActiveTab] = useState<WheelMode>('spin-for-me');

  const [wheelRestaurants, setWheelRestaurants] = useState<Restaurant[]>([]);
  const [showSpinForMeWheel, setShowSpinForMeWheel] = useState(false);

  const [manualInput, setManualInput] = useState('');
  const [manualRestaurants, setManualRestaurants] = useState<Restaurant[]>([]);
  const [showManualWheel, setShowManualWheel] = useState(false);

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
    const interval = setInterval(updateMealTime, 60000);

    return () => clearInterval(interval);
  }, []);

  const filteredRestaurants = useMemo(
    () =>
      enhancedFilterRestaurants(
        penangRestaurants,
        location,
        selectedCategories,
        radiusKm,
        selectedPriceRanges
      ),
    [location, selectedCategories, radiusKm, selectedPriceRanges]
  );

  const buildManualRestaurant = (name: string): Restaurant => ({
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    category: [],
    address: '',
    coordinates: { lat: 0, lng: 0 },
    hours: {},
    rating: 0,
    priceRange: '$',
  });

  const addManualRestaurant = useCallback(() => {
    const trimmed = manualInput.trim();
    if (!trimmed) {
      return;
    }

    const hasDuplicate = manualRestaurants.some(
      (restaurant) => restaurant.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase()
    );

    if (!hasDuplicate) {
      setManualRestaurants((prev) => [...prev, buildManualRestaurant(trimmed)]);
    }

    setManualInput('');
  }, [manualInput, manualRestaurants]);

  const removeManualRestaurant = (id: string) => {
    setManualRestaurants((prev) => prev.filter((restaurant) => restaurant.id !== id));
    setSpinResult(null);
  };

  const clearManualRestaurants = () => {
    const confirmed = window.confirm('Clear all restaurants?');
    if (confirmed) {
      setManualRestaurants([]);
      setSpinResult(null);
    }
  };

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

  const handleStartSpinForMe = () => {
    if (handleSpinAttempt()) {
      shuffleWheel();
      setShowSpinForMeWheel(true);
      setTimeout(() => {
        const wheelSection = document.getElementById('wheel');
        wheelSection?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  };

  const handleTabChange = (value: string) => {
    const nextTab = value as WheelMode;
    setActiveTab(nextTab);
    setSpinResult(null);
    setIsSpinning(false);

    if (nextTab === 'spin-for-me') {
      setShowSpinForMeWheel(false);
      setWheelRestaurants([]);
    }

    if (nextTab === 'i-know-where') {
      setShowManualWheel(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-linen">
      <Navbar
        isPremium={isPremium}
        onUpgradeClick={() => setShowSubscription(true)}
      />

      <Hero onGetStarted={() => {
        const appSection = document.getElementById('app');
        appSection?.scrollIntoView({ behavior: 'smooth' });
      }} />

      <HowItWorks />
      <Features />

      <section id="app" className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-brand-black mb-4">
              Let's Find You Something to Eat!
            </h2>
            <p className="text-eatspin-gray-1 max-w-lg mx-auto">
              Select your food preferences and spin the wheel to discover your next meal
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="w-full h-auto grid grid-cols-2 mb-8 bg-brand-linen p-1">
              <TabsTrigger value="spin-for-me" className="py-3 text-sm sm:text-base">Spin for me</TabsTrigger>
              <TabsTrigger value="i-know-where" className="py-3 text-sm sm:text-base">I know where</TabsTrigger>
            </TabsList>

            <TabsContent value="spin-for-me" className="space-y-6">
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

              <div className="mb-6 flex justify-center">
                <MealTimeIndicator />
              </div>

              <div className="mb-8">
                <FoodCategorySelector
                  selectedCategories={selectedCategories}
                  onCategoryChange={setSelectedCategories}
                  maxSelection={3}
                />
              </div>

              <div className="mb-8">
                <div className="mb-4 text-center">
                  <h3 className="font-heading text-lg font-semibold text-brand-black mb-2">Price range</h3>
                  <p className="text-sm text-eatspin-gray-1">Select any (optional)</p>
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

              {location && (
                <div className="text-center mb-6">
                  <p className="text-sm text-eatspin-gray-1">
                    <span className="font-semibold text-brand-orange">{filteredRestaurants.length}</span>{' '}
                    restaurants within {radiusKm} km
                    {selectedCategories.length > 0 && ' match your preferences'}
                  </p>
                </div>
              )}

              {showSpinLimitWarning && currentMealTime !== 'none' && (
                <div className="mb-6">
                  <SpinLimitWarning
                    mealTime={currentMealTime}
                    onUpgrade={() => setShowSubscription(true)}
                    onClose={() => setShowSpinLimitWarning(false)}
                  />
                </div>
              )}

              {location && filteredRestaurants.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                  <Button
                    onClick={handleStartSpinForMe}
                    disabled={isSpinning || filteredRestaurants.length === 0}
                    className="bg-brand-orange hover:bg-brand-orange/90 text-white font-heading text-lg font-bold px-8 py-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 disabled:opacity-70"
                  >
                    <Utensils size={20} className="mr-2" />
                    Spin for {currentMealTime !== 'none' ? currentMealTime : 'Food'}
                  </Button>

                  {spinResult && (
                    <Button
                      onClick={resetWheel}
                      variant="outline"
                      className="border-eatspin-orange text-eatspin-orange hover:bg-eatspin-orange/10 font-medium px-6 py-6 rounded-full"
                    >
                      <RotateCcw size={18} className="mr-2" />
                      Spin Again
                    </Button>
                  )}
                </div>
              )}

              {showSpinForMeWheel && location && filteredRestaurants.length > 0 && (
                <section id="wheel" className="py-8 px-2 sm:px-4 bg-brand-linen rounded-2xl">
                  <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-8">
                      <h2 className="font-heading text-2xl sm:text-3xl font-bold text-brand-black mb-2">Spin the Wheel!</h2>
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
            </TabsContent>

            <TabsContent value="i-know-where" className="space-y-6">
              <section className="py-4 px-2 sm:px-4 bg-brand-linen rounded-2xl">
                <div className="max-w-4xl mx-auto">
                  <div className="text-center mb-6">
                    <h3 className="font-heading text-2xl font-bold text-brand-black">Your restaurant wheel</h3>
                    <p className="text-eatspin-gray-1">Type any options you want and spin when ready.</p>
                  </div>

                  {showManualWheel && (
                    <RouletteWheel
                      restaurants={manualRestaurants}
                      totalCount={manualRestaurants.length}
                      onSpinComplete={handleSpinComplete}
                      isSpinning={isSpinning}
                      setIsSpinning={setIsSpinning}
                      minSpinCount={2}
                      spinButtonLabel="Spin"
                      emptyTitle="Add restaurants to start"
                      emptyDescription="Type any restaurant you like…"
                      minCountHelperText={
                        manualRestaurants.length === 0
                          ? 'Add restaurants to start'
                          : 'Add at least 2 restaurants to spin'
                      }
                      showResultDetails={false}
                    />
                  )}

                  {!showManualWheel && (
                    <div className="text-center py-12">
                      <p className="text-sm text-eatspin-gray-2">Add restaurants to start</p>
                    </div>
                  )}

                  <div className="mt-8 space-y-4">
                    <div className="flex gap-2">
                      <Input
                        value={manualInput}
                        onChange={(event) => setManualInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            addManualRestaurant();
                            setShowManualWheel(true);
                          }
                        }}
                        placeholder="Type any restaurant you like…"
                        className="h-11"
                      />
                      <Button
                        type="button"
                        onClick={() => {
                          addManualRestaurant();
                          setShowManualWheel(true);
                        }}
                        className="h-11"
                      >
                        Add
                      </Button>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-brand-black">Restaurant list ({manualRestaurants.length})</p>
                        {manualRestaurants.length > 0 && (
                          <button
                            type="button"
                            onClick={clearManualRestaurants}
                            className="text-xs text-eatspin-orange font-medium hover:underline"
                          >
                            Clear all
                          </button>
                        )}
                      </div>

                      {manualRestaurants.length === 0 && (
                        <p className="text-sm text-eatspin-gray-2">Add restaurants to start</p>
                      )}

                      <ul className="space-y-2">
                        {manualRestaurants.map((restaurant) => (
                          <li
                            key={restaurant.id}
                            className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-gray-100"
                          >
                            <span className="text-sm text-brand-black">{restaurant.name}</span>
                            <button
                              type="button"
                              onClick={() => removeManualRestaurant(restaurant.id)}
                              className="text-sm text-eatspin-orange hover:text-eatspin-orange/80"
                              aria-label={`Remove ${restaurant.name}`}
                            >
                              ❌
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </section>
            </TabsContent>
          </Tabs>

          {!isPremium && (
            <div className="text-center mt-8">
              <button
                onClick={() => setShowSubscription(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full text-sm font-medium hover:shadow-lg transition-all duration-300 hover:scale-105"
              >
                <Crown size={16} />
                Upgrade to Premium for unlimited spins
              </button>
            </div>
          )}

          {isPremium && (
            <div className="text-center mt-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full text-sm font-medium">
                <Crown size={16} />
                Premium Member - Unlimited Spins
              </div>
            </div>
          )}
        </div>
      </section>

      <Testimonials />
      <CTA />
      <Footer />

      <SubscriptionModal
        isOpen={showSubscription}
        onClose={() => setShowSubscription(false)}
        onSubscribe={handleSubscribe}
      />
    </div>
  );
}

export default App;
