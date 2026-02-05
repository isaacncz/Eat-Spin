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
import { RotateCcw, Crown, MapPin, Utensils, Sparkles, PencilLine, Plus, X } from 'lucide-react';
import './App.css';

type SpinTab = 'auto' | 'manual';

function App() {
  // State management
  const [selectedCategories, setSelectedCategories] = useState<FoodCategory[]>([]);
  const [selectedPriceRanges, setSelectedPriceRanges] = useState<Restaurant['priceRange'][]>([]);
  const [nonHalalOnly, setNonHalalOnly] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showSpinLimitWarning, setShowSpinLimitWarning] = useState(false);
  const [currentMealTime, setCurrentMealTime] = useState<MealTime>('none');
  const [isPremium, setIsPremium] = useState(false);
  const [showWheelSection, setShowWheelSection] = useState(false);
  const [wheelRestaurants, setWheelRestaurants] = useState<Restaurant[]>([]);
  const [activeTab, setActiveTab] = useState<SpinTab>('auto');
  const [autoWheelKey, setAutoWheelKey] = useState(0);

  const [manualInput, setManualInput] = useState('');
  const [manualRestaurants, setManualRestaurants] = useState<Restaurant[]>([]);
  const [manualWheelKey, setManualWheelKey] = useState(0);
  const [manualSpinResult, setManualSpinResult] = useState<Restaurant | null>(null);

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

  const filteredRestaurants = useMemo(() => (
    enhancedFilterRestaurants(
      penangRestaurants,
      location,
      selectedCategories,
      radiusKm,
      selectedPriceRanges,
      nonHalalOnly
    )
  ), [location, selectedCategories, radiusKm, selectedPriceRanges, nonHalalOnly]);

  // Handle spin complete
  const handleSpinComplete = useCallback((restaurant: Restaurant) => {
    recordSpin(restaurant.id, currentMealTime);
  }, [currentMealTime, recordSpin]);

  const handleManualSpinComplete = useCallback((restaurant: Restaurant) => {
    setManualSpinResult(restaurant);
  }, []);

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

  const resetAutoWheel = () => {
    setShowSpinLimitWarning(false);
    setAutoWheelKey((prev) => prev + 1);
  };

  // Shuffle wheel restaurants
  const shuffleWheel = () => {
    const shuffled = [...filteredRestaurants].sort(() => Math.random() - 0.5);
    setWheelRestaurants(shuffled.slice(0, 12));
  };

  const switchTab = (tab: SpinTab) => {
    setActiveTab(tab);
    if (tab === 'auto') {
      setWheelRestaurants([]);
      setShowWheelSection(false);
      setAutoWheelKey((prev) => prev + 1);
    } else {
      setManualSpinResult(null);
      setManualWheelKey((prev) => prev + 1);
    }
  };

  const addManualRestaurant = () => {
    const name = manualInput.trim();
    if (!name) return;

    const exists = manualRestaurants.some(
      (restaurant) => restaurant.name.toLowerCase() === name.toLowerCase()
    );

    if (exists) {
      setManualInput('');
      return;
    }

    const now = new Date();
    const id = `manual-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;

    const restaurant: Restaurant = {
      id,
      name,
      category: ['street food'],
      address: 'Your custom pick',
      coordinates: { lat: 0, lng: 0 },
      hours: {
        daily: { open: '00:00', close: '23:59' },
      },
      rating: 5,
      priceRange: '$$',
      description: 'Added by you.',
    };

    setManualRestaurants((prev) => [...prev, restaurant]);
    setManualInput('');
    setManualSpinResult(null);
    setManualWheelKey((prev) => prev + 1);
  };

  const removeManualRestaurant = (id: string) => {
    setManualRestaurants((prev) => prev.filter((restaurant) => restaurant.id !== id));
    setManualSpinResult(null);
    setManualWheelKey((prev) => prev + 1);
  };

  const clearManualRestaurants = () => {
    if (!window.confirm('Clear all restaurants?')) return;
    setManualRestaurants([]);
    setManualSpinResult(null);
    setManualWheelKey((prev) => prev + 1);
  };

  const manualHelperText = useMemo(() => {
    if (manualRestaurants.length === 0) return 'Add restaurants to start';
    if (manualRestaurants.length === 1) return 'Add at least 2 restaurants to spin';
    return undefined;
  }, [manualRestaurants.length]);

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
              Choose whether you want suggestions or already know your options
            </p>
          </div>

          <div className="mb-8">
            <div className="inline-flex p-1 bg-brand-linen rounded-full border border-eatspin-peach/70">
              <button
                type="button"
                onClick={() => switchTab('auto')}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                  activeTab === 'auto'
                    ? 'bg-brand-orange text-white shadow'
                    : 'text-brand-black hover:bg-white'
                }`}
              >
                <span className="inline-flex items-center gap-2"><Sparkles size={16} />Spin for me</span>
              </button>
              <button
                type="button"
                onClick={() => switchTab('manual')}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                  activeTab === 'manual'
                    ? 'bg-brand-orange text-white shadow'
                    : 'text-brand-black hover:bg-white'
                }`}
              >
                <span className="inline-flex items-center gap-2"><PencilLine size={16} />I know where</span>
              </button>
            </div>
          </div>

          {activeTab === 'auto' && (
            <>
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
                  <h3 className="font-heading text-lg font-semibold text-brand-black mb-2">
                    Price range
                  </h3>
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

              <div className="mb-8">
                <div className="mb-4 text-center">
                  <h3 className="font-heading text-lg font-semibold text-brand-black mb-2">
                    Dietary preference
                  </h3>
                  <p className="text-sm text-eatspin-gray-1">Show only non-halal options</p>
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

              {location && (
                <div className="text-center mb-6">
                  <p className="text-sm text-eatspin-gray-1">
                    <span className="font-semibold text-brand-orange">{filteredRestaurants.length}</span>{' '}
                    restaurants within {radiusKm} km
                    {(selectedCategories.length > 0 || nonHalalOnly) && ' match your preferences'}
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
                    onClick={() => {
                      if (handleSpinAttempt()) {
                        shuffleWheel();
                        setShowWheelSection(true);
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

                  <Button
                    onClick={resetAutoWheel}
                    variant="outline"
                    className="w-full sm:w-auto border-eatspin-orange text-eatspin-orange hover:bg-eatspin-orange/10 font-medium px-6 py-5 sm:py-6 rounded-full"
                  >
                    <RotateCcw size={18} className="mr-2" />
                    Reset Wheel
                  </Button>
                </div>
              )}

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

              {isPremium && (
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full text-sm font-medium">
                    <Crown size={16} />
                    Premium Member - Unlimited Spins
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'manual' && (
            <div id="wheel" className="py-4">
              <div className="text-center mb-5">
                <h3 className="font-heading text-2xl font-bold text-brand-black mb-2">I know where</h3>
                <p className="text-sm text-eatspin-gray-1">Add any restaurants you like and spin.</p>
              </div>

              <RouletteWheel
                key={`manual-${manualWheelKey}-${manualRestaurants.length}`}
                restaurants={manualRestaurants}
                totalCount={manualRestaurants.length}
                onSpinComplete={handleManualSpinComplete}
                isSpinning={isSpinning}
                setIsSpinning={setIsSpinning}
                onShuffle={() => {
                  setManualRestaurants((prev) => [...prev].sort(() => Math.random() - 0.5));
                  setManualWheelKey((prev) => prev + 1);
                }}
                canSpin={manualRestaurants.length >= 2}
                helperText={manualHelperText}
                spinButtonLabel="Spin the Wheel!"
                emptyStateTitle="Add restaurants to start"
                emptyStateSubtitle="Type any restaurant you like…"
                onEditList={() => {
                  document.getElementById('manual-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              />

              <div id="manual-input" className="mt-8 max-w-xl mx-auto">
                <div className="flex gap-2">
                  <Input
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addManualRestaurant();
                      }
                    }}
                    placeholder="Type any restaurant you like…"
                  />
                  <Button onClick={addManualRestaurant}>
                    <Plus size={16} className="mr-1" /> Add
                  </Button>
                </div>

                <div className="mt-4 bg-white rounded-xl border border-eatspin-peach/60 p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold text-brand-black">Restaurant list ({manualRestaurants.length})</h4>
                    {manualRestaurants.length > 0 && (
                      <button
                        type="button"
                        className="text-xs font-medium text-eatspin-orange hover:underline"
                        onClick={clearManualRestaurants}
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  {manualRestaurants.length === 0 ? (
                    <p className="text-sm text-eatspin-gray-1">No restaurants yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {manualRestaurants.map((restaurant) => (
                        <li key={restaurant.id} className="flex justify-between items-center bg-brand-linen rounded-lg px-3 py-2">
                          <span className="text-sm text-brand-black">{restaurant.name}</span>
                          <button
                            type="button"
                            onClick={() => removeManualRestaurant(restaurant.id)}
                            className="text-eatspin-gray-1 hover:text-red-500"
                            aria-label={`Remove ${restaurant.name}`}
                          >
                            <X size={16} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {manualSpinResult && (
                  <p className="mt-4 text-center text-sm text-eatspin-gray-1">
                    Last result: <span className="font-semibold text-brand-black">{manualSpinResult.name}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {activeTab === 'auto' && showWheelSection && location && filteredRestaurants.length > 0 && (
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
              key={`auto-${autoWheelKey}`}
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
