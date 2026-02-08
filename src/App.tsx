import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import { useLocation } from '@/hooks/useLocation';
import { useSpinTracker } from '@/hooks/useSpinTracker';
import { useFirebaseGroupRoom } from '@/hooks/useFirebaseGroupRoom';
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
import { GroupSpin } from '@/sections/GroupSpin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Toaster } from '@/components/ui/sonner';
import { RotateCcw, Crown, MapPin, Utensils, Sparkles, PencilLine, Plus, X, Trash2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import './App.css';

type SpinTab = 'auto' | 'manual';
type PresetMealTime = Exclude<MealTime, 'none'> | null;
interface ManualPreset {
  id: string;
  name: string;
  restaurants: string[];
  mealTime: PresetMealTime;
  createdAt: number;
}

const MANUAL_RESTAURANTS_STORAGE_KEY = 'eatspin:manual-restaurants';
const MANUAL_PRESETS_STORAGE_KEY = 'eatspin:manual-presets';
const ROOM_LIST_SYNC_GRACE_MS = 2_500;

const createManualRestaurant = (name: string): Restaurant => {
  const now = Date.now();
  return {
    id: `manual-${now}-${Math.random().toString(36).slice(2, 8)}`,
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
};

const getPresetMealTime = (): PresetMealTime => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 10) return 'breakfast';
  if (hour >= 10 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 22) return 'dinner';
  return null;
};

const presetMealTimeTimeToLabel = (mealTime: PresetMealTime): string => {
  if (mealTime === 'breakfast') return 'Breakfast';
  if (mealTime === 'lunch') return 'Lunch';
  if (mealTime === 'dinner') return 'Dinner';
  return '';
};

const loadManualRestaurants = (): Restaurant[] => {
  if (typeof window === 'undefined') return [];

  const storedRestaurants = window.localStorage.getItem(MANUAL_RESTAURANTS_STORAGE_KEY);
  if (!storedRestaurants) return [];

  try {
    const parsedRestaurants = JSON.parse(storedRestaurants);
    if (!Array.isArray(parsedRestaurants)) return [];

    return parsedRestaurants.filter((restaurant): restaurant is Restaurant => (
      typeof restaurant?.id === 'string'
      && typeof restaurant?.name === 'string'
      && typeof restaurant?.address === 'string'
      && typeof restaurant?.description === 'string'
      && typeof restaurant?.rating === 'number'
      && typeof restaurant?.priceRange === 'string'
      && Array.isArray(restaurant?.category)
      && typeof restaurant?.coordinates?.lat === 'number'
      && typeof restaurant?.coordinates?.lng === 'number'
      && typeof restaurant?.hours === 'object'
    ));
  } catch {
    return [];
  }
};

const loadManualPresets = (): ManualPreset[] => {
  if (typeof window === 'undefined') return [];

  const storedPresets = window.localStorage.getItem(MANUAL_PRESETS_STORAGE_KEY);
  if (!storedPresets) return [];

  try {
    const parsedPresets = JSON.parse(storedPresets);
    if (!Array.isArray(parsedPresets)) return [];

    return parsedPresets.filter((preset): preset is ManualPreset => {
      const restaurants = (preset as { restaurants?: unknown }).restaurants;

      return (
        typeof (preset as { id?: unknown }).id === 'string'
        && typeof (preset as { name?: unknown }).name === 'string'
        && Array.isArray(restaurants)
        && restaurants.every((restaurant: unknown) => typeof restaurant === 'string')
        && ((preset as { mealTime?: unknown }).mealTime === null
          || (preset as { mealTime?: unknown }).mealTime === 'breakfast'
          || (preset as { mealTime?: unknown }).mealTime === 'lunch'
          || (preset as { mealTime?: unknown }).mealTime === 'dinner')
        && typeof (preset as { createdAt?: unknown }).createdAt === 'number'
      );
    });
  } catch {
    return [];
  }
};

const normalizeManualNames = (names: string[]) => (
  names
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name, index, list) => list.findIndex((entry) => entry.toLowerCase() === name.toLowerCase()) === index)
);

function App() {
  // State management
  const [selectedCategories, setSelectedCategories] = useState<FoodCategory[]>([]);
  const [selectedPriceRanges, setSelectedPriceRanges] = useState<Restaurant['priceRange'][]>([]);
  const [nonHalalOnly, setNonHalalOnly] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showSpinLimitWarning, setShowSpinLimitWarning] = useState(false);
  const [currentMealTime, setCurrentMealTime] = useState<MealTime>('none');
  const [isPremium, setIsPremium] = useState(false);
  const [showWheelSection, setShowWheelSection] = useState(false);
  const [wheelRestaurants, setWheelRestaurants] = useState<Restaurant[]>([]);
  const [roundRemovedRestaurantIds, setRoundRemovedRestaurantIds] = useState<string[]>([]);
  const [pendingAutoRemovalId, setPendingAutoRemovalId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SpinTab>(() => {
    if (typeof window === 'undefined') return 'auto';
    return new URLSearchParams(window.location.search).get('room') ? 'manual' : 'auto';
  });
  const [autoWheelKey, setAutoWheelKey] = useState(0);
  const [isReviewExpanded, setIsReviewExpanded] = useState(false);
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);

  const [manualInput, setManualInput] = useState('');
  const [manualRestaurants, setManualRestaurants] = useState<Restaurant[]>(() => loadManualRestaurants());
  const [manualWheelKey, setManualWheelKey] = useState(0);
  const [manualSpinResult, setManualSpinResult] = useState<Restaurant | null>(null);
  const [presetNameInput, setPresetNameInput] = useState('');
  const [presetMealTimeInput, setPresetMealTimeInput] = useState<PresetMealTime>(() => getPresetMealTime());
  const [manualPresets, setManualPresets] = useState<ManualPreset[]>(() => loadManualPresets());
  const autoLoadedMealTimeRef = useRef<PresetMealTime>(null);
  const seededRoomSyncIdRef = useRef('');
  const pendingRoomListSyncRef = useRef<{ roomId: string; signature: string; startedAt: number } | null>(null);

  const scrollToSection = useCallback((sectionId: string) => {
    if (typeof window === 'undefined') return;
    const section = document.getElementById(sectionId);
    if (!section) return;

    const navbarHeight = Number.parseInt(
      window.getComputedStyle(document.documentElement).getPropertyValue('--navbar-height'),
      10,
    );
    const offset = Number.isFinite(navbarHeight) ? navbarHeight : 72;
    const targetTop = window.scrollY + section.getBoundingClientRect().top - offset - 8;
    window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
  }, []);

  // Custom hooks
  const { location, error: locationError, isLoading: locationLoading, requestLocation } = useLocation();
  const { canSpin, recordSpin } = useSpinTracker();
  const {
    authUid: groupAuthUid,
    isFirebaseConfigured,
    firebaseConfigError,
    authLoading: groupAuthLoading,
    authError: groupAuthError,
    displayName: groupDisplayName,
    resolvedDisplayName: groupResolvedDisplayName,
    setDisplayName: setGroupDisplayName,
    roomId: groupRoomId,
    hostUid: groupHostUid,
    roomLink: groupRoomLink,
    isHost: isGroupHost,
    isCohost: isGroupCohost,
    canEditList: canEditGroupList,
    cohostUids: groupCohostUids,
    isBusy: groupRoomBusy,
    roomError: groupRoomError,
    clearRoomError: clearGroupRoomError,
    participants: groupParticipants,
    roomListNames: groupRoomListNames,
    currentSpin: groupCurrentSpin,
    createRoom: createGroupRoom,
    joinRoom: joinGroupRoom,
    leaveRoom: leaveGroupRoom,
    syncHostList,
    setParticipantCohost,
    requestHostSpin,
  } = useFirebaseGroupRoom();

  const priceOptions: Restaurant['priceRange'][] = ['$', '$$', '$$$', '$$$$'];
  const isGroupRoomActive = Boolean(groupRoomId);
  const isManualListReadOnly = isGroupRoomActive && !canEditGroupList;

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

  const roundRestaurants = useMemo(() => (
    filteredRestaurants.filter((restaurant) => !roundRemovedRestaurantIds.includes(restaurant.id))
  ), [filteredRestaurants, roundRemovedRestaurantIds]);

  const removeRestaurantForRound = (
    restaurantId: string,
    options?: { bumpKey?: boolean },
  ) => {
    const { bumpKey = true } = options ?? {};
    setRoundRemovedRestaurantIds((prev) => (prev.includes(restaurantId) ? prev : [...prev, restaurantId]));
    setWheelRestaurants((prev) => prev.filter((restaurant) => restaurant.id !== restaurantId));
    if (bumpKey) {
      setAutoWheelKey((prev) => prev + 1);
    }
  };

  const handleAutoSpinStart = useCallback(() => {
    if (!pendingAutoRemovalId) return null;

    setPendingAutoRemovalId(null);
    removeRestaurantForRound(pendingAutoRemovalId, { bumpKey: false });
    return wheelRestaurants.filter((restaurant) => restaurant.id !== pendingAutoRemovalId);
  }, [pendingAutoRemovalId, removeRestaurantForRound, wheelRestaurants]);

  // Handle spin complete
  const handleSpinComplete = useCallback((restaurant: Restaurant) => {
    recordSpin(restaurant.id, currentMealTime);
    setPendingAutoRemovalId(restaurant.id);
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
    setRoundRemovedRestaurantIds([]);
    setPendingAutoRemovalId(null);
    setShowWheelSection(false);
    setWheelRestaurants([]);
    setAutoWheelKey((prev) => prev + 1);
  };

  // Shuffle wheel restaurants
  const shuffleWheel = () => {
    const shuffled = [...roundRestaurants].sort(() => Math.random() - 0.5);
    const sliced = shuffled.slice(0, 12);
    const sortedByDistance = location
      ? [...sliced].sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
      : sliced;
    setWheelRestaurants(sortedByDistance);
  };

  const switchTab = (tab: SpinTab) => {
    setActiveTab(tab);
    if (tab === 'auto') {
      setWheelRestaurants([]);
      setShowWheelSection(false);
      setRoundRemovedRestaurantIds([]);
      setPendingAutoRemovalId(null);
      setAutoWheelKey((prev) => prev + 1);
    } else {
      setManualSpinResult(null);
      setManualWheelKey((prev) => prev + 1);
    }
  };

  const syncGroupListFromRestaurants = useCallback((restaurants: Restaurant[]) => {
    if (!isGroupRoomActive || !canEditGroupList || !groupRoomId) return;
    const normalizedNames = normalizeManualNames(restaurants.map((restaurant) => restaurant.name));
    const signature = JSON.stringify(normalizedNames);
    pendingRoomListSyncRef.current = {
      roomId: groupRoomId,
      signature,
      startedAt: Date.now(),
    };
    void syncHostList(normalizedNames);
  }, [canEditGroupList, groupRoomId, isGroupRoomActive, syncHostList]);

  const addManualRestaurant = () => {
    if (isManualListReadOnly) {
      toast.info('Only the host or co-host can edit the shared list.');
      return;
    }

    const name = manualInput.trim();
    if (!name) return;

    const exists = manualRestaurants.some(
      (restaurant) => restaurant.name.toLowerCase() === name.toLowerCase()
    );

    if (exists) {
      setManualInput('');
      return;
    }

    const nextRestaurants = [...manualRestaurants, createManualRestaurant(name)];
    setManualRestaurants(nextRestaurants);
    syncGroupListFromRestaurants(nextRestaurants);
    setManualInput('');
    setManualSpinResult(null);
    setManualWheelKey((prev) => prev + 1);
  };

  const buildRestaurantsFromNames = useCallback((names: string[]) => {
    const uniqueNames = names
      .map((name) => name.trim())
      .filter(Boolean)
      .filter((name, index, arr) => arr.findIndex((item) => item.toLowerCase() === name.toLowerCase()) === index);

    return uniqueNames.map((name) => createManualRestaurant(name));
  }, []);

  const loadPresetRestaurants = useCallback((preset: ManualPreset) => {
    if (isManualListReadOnly) {
      toast.info('Only the host or co-host can edit the shared list.');
      return;
    }

    const restaurants = buildRestaurantsFromNames(preset.restaurants);
    setManualRestaurants(restaurants);
    syncGroupListFromRestaurants(restaurants);
    setManualSpinResult(null);
    setManualWheelKey((prev) => prev + 1);
  }, [buildRestaurantsFromNames, isManualListReadOnly, syncGroupListFromRestaurants]);

  const saveCurrentAsPreset = () => {
    const trimmedName = presetNameInput.trim();
    if (!trimmedName || manualRestaurants.length === 0) return;

    const restaurantNames = manualRestaurants.map((restaurant) => restaurant.name.trim()).filter(Boolean);
    const newPreset: ManualPreset = {
      id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmedName,
      restaurants: restaurantNames,
      mealTime: presetMealTimeInput,
      createdAt: Date.now(),
    };

    setManualPresets((prev) => [newPreset, ...prev]);
    toast.success(`Preset "${trimmedName}" saved!`, {
      description: `${restaurantNames.length} restaurants saved${presetMealTimeInput ? ` for ${presetMealTimeTimeToLabel(presetMealTimeInput)}` : ''}`,
    });
    setPresetNameInput('');
    setPresetMealTimeInput(null);
  };

  const deletePreset = (presetId: string) => {
    setManualPresets((prev) => prev.filter((preset) => preset.id !== presetId));
  };

  const removeManualRestaurant = (id: string) => {
    if (isManualListReadOnly) {
      toast.info('Only the host or co-host can edit the shared list.');
      return;
    }

    const nextRestaurants = manualRestaurants.filter((restaurant) => restaurant.id !== id);
    setManualRestaurants(nextRestaurants);
    syncGroupListFromRestaurants(nextRestaurants);
    setManualSpinResult(null);
    setManualWheelKey((prev) => prev + 1);
  };

  const clearManualRestaurants = () => {
    if (isManualListReadOnly) {
      toast.info('Only the host or co-host can edit the shared list.');
      return;
    }

    if (!window.confirm('Clear all restaurants?')) return;
    setManualRestaurants([]);
    syncGroupListFromRestaurants([]);
    setManualSpinResult(null);
    setManualWheelKey((prev) => prev + 1);
  };

  const manualHelperText = useMemo(() => {
    if (isGroupRoomActive && !canEditGroupList) return 'Waiting for host or co-host to update list and start the spin';
    if (isGroupRoomActive && isGroupHost) return 'Host mode: your list changes sync to everyone in the room';
    if (isGroupRoomActive && isGroupCohost) return 'Co-host mode: your list changes sync to everyone in the room';
    if (manualRestaurants.length === 0) return 'Add restaurants to start';
    if (manualRestaurants.length === 1) return 'Add at least 2 restaurants to spin';
    return undefined;
  }, [canEditGroupList, isGroupCohost, isGroupHost, isGroupRoomActive, manualRestaurants.length]);

  const manualRestaurantNames = useMemo(
    () => normalizeManualNames(manualRestaurants.map((restaurant) => restaurant.name)),
    [manualRestaurants],
  );

  const shuffleManualRestaurants = useCallback(() => {
    if (isManualListReadOnly) return;
    const shuffledRestaurants = [...manualRestaurants].sort(() => Math.random() - 0.5);
    setManualRestaurants(shuffledRestaurants);
    syncGroupListFromRestaurants(shuffledRestaurants);
    setManualSpinResult(null);
    setManualWheelKey((prev) => prev + 1);
  }, [isManualListReadOnly, manualRestaurants, syncGroupListFromRestaurants]);

  const manualExternalSpin = useMemo(() => {
    if (!isGroupRoomActive || !groupCurrentSpin) return null;

    const normalizedWinner = groupCurrentSpin.winnerName.trim().toLowerCase();
    const winnerIndexFromName = manualRestaurants.findIndex(
      (restaurant) => restaurant.name.trim().toLowerCase() === normalizedWinner,
    );

    return {
      spinId: groupCurrentSpin.spinId,
      winnerIndex: winnerIndexFromName >= 0 ? winnerIndexFromName : groupCurrentSpin.winnerIndex,
    };
  }, [groupCurrentSpin, isGroupRoomActive, manualRestaurants]);

  const handleRequestGroupSpin = useCallback(async () => {
    if (!isGroupRoomActive) return;
    if (!isGroupHost) {
      toast.info('Only the room host can start the spin.');
      return;
    }

    if (manualRestaurantNames.length < 2) {
      toast.info('Add at least 2 restaurants before spinning.');
      return;
    }

    const spinResult = await requestHostSpin(manualRestaurantNames);
    if (!spinResult) return;
    toast.success(`Room spin started: ${spinResult.winnerName}`);
  }, [isGroupRoomActive, isGroupHost, manualRestaurantNames, requestHostSpin]);

  const handleCreateGroupRoom = useCallback(async () => {
    setActiveTab('manual');
    await createGroupRoom();
  }, [createGroupRoom]);

  const handleJoinGroupRoom = useCallback(async (value: string) => {
    setActiveTab('manual');
    await joinGroupRoom(value);
  }, [joinGroupRoom]);

  useEffect(() => {
    if (!isGroupRoomActive || !canEditGroupList || !groupRoomId) return;
    if (seededRoomSyncIdRef.current === groupRoomId) return;

    seededRoomSyncIdRef.current = groupRoomId;
    const normalizedRemoteNames = normalizeManualNames(groupRoomListNames);
    if (normalizedRemoteNames.length > 0 || manualRestaurantNames.length === 0) return;

    const signature = JSON.stringify(manualRestaurantNames);
    pendingRoomListSyncRef.current = {
      roomId: groupRoomId,
      signature,
      startedAt: Date.now(),
    };
    void syncHostList(manualRestaurantNames);
  }, [canEditGroupList, groupRoomId, groupRoomListNames, isGroupRoomActive, manualRestaurantNames, syncHostList]);

  useEffect(() => {
    if (!isGroupRoomActive) {
      seededRoomSyncIdRef.current = '';
      pendingRoomListSyncRef.current = null;
      return;
    }

    const normalizedRemoteNames = normalizeManualNames(groupRoomListNames);
    const remoteSignature = JSON.stringify(normalizedRemoteNames);
    const localSignature = JSON.stringify(manualRestaurantNames);

    const pendingSync = pendingRoomListSyncRef.current;
    if (pendingSync) {
      if (pendingSync.roomId !== groupRoomId) {
        pendingRoomListSyncRef.current = null;
      } else if (remoteSignature === pendingSync.signature) {
        pendingRoomListSyncRef.current = null;
      } else if (canEditGroupList && Date.now() - pendingSync.startedAt < ROOM_LIST_SYNC_GRACE_MS) {
        return;
      } else {
        pendingRoomListSyncRef.current = null;
      }
    }

    if (remoteSignature === localSignature) return;

    // Protect editable clients from being wiped by an initial empty list until room seed runs.
    if (
      canEditGroupList
      && seededRoomSyncIdRef.current !== groupRoomId
      && normalizedRemoteNames.length === 0
      && manualRestaurantNames.length > 0
    ) {
      return;
    }

    const syncedRestaurants = buildRestaurantsFromNames(normalizedRemoteNames);
    setManualRestaurants(syncedRestaurants);
    setManualSpinResult(null);
    setManualWheelKey((prev) => prev + 1);
  }, [buildRestaurantsFromNames, canEditGroupList, groupRoomId, groupRoomListNames, isGroupRoomActive, manualRestaurantNames]);

  useEffect(() => {
    window.localStorage.setItem(MANUAL_RESTAURANTS_STORAGE_KEY, JSON.stringify(manualRestaurants));
  }, [manualRestaurants]);

  useEffect(() => {
    window.localStorage.setItem(MANUAL_PRESETS_STORAGE_KEY, JSON.stringify(manualPresets));
  }, [manualPresets]);

  useEffect(() => {
    if (isGroupRoomActive) return;

    const currentPresetMealTime = getPresetMealTime();

    if (autoLoadedMealTimeRef.current === currentPresetMealTime) return;

    autoLoadedMealTimeRef.current = currentPresetMealTime;

    if (currentPresetMealTime === null) return;

    const matchedPreset = manualPresets.find((preset) => preset.mealTime === currentPresetMealTime);
    if (!matchedPreset) return;

    const timeoutId = window.setTimeout(() => {
      loadPresetRestaurants(matchedPreset);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [manualPresets, loadPresetRestaurants, currentMealTime, isGroupRoomActive]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const roomFromUrl = new URLSearchParams(window.location.search).get('room');
    if (!roomFromUrl) return;

    const timeoutId = window.setTimeout(() => {
      scrollToSection('group-spin');
      window.requestAnimationFrame(() => {
        scrollToSection('group-spin');
      });
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [scrollToSection]);


  return (
    <div className="min-h-screen bg-brand-linen">
      <Navbar
        isPremium={isPremium}
        onUpgradeClick={() => setShowSubscription(true)}
      />

      <Hero
        onGetStarted={() => scrollToSection('app')}
        onGroupSpin={() => scrollToSection('group-spin')}
      />

      <HowItWorks />
      <Features />

      <section id="app" className="py-8 sm:py-10 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-4">
            <h2 className="font-heading text-2xl sm:text-4xl font-bold text-brand-black mb-2">
              Let's Find You Something to Eat!
            </h2>
            <p className="text-sm sm:text-base text-eatspin-gray-1 max-w-md mx-auto">
              Choose whether you want suggestions or already know your options
            </p>
          </div>

          <div className="mb-4 flex justify-center">
            <MealTimeIndicator />
          </div>

          <div className="mb-5 flex justify-center">
            <div className="inline-flex items-center justify-center p-1 bg-brand-black rounded-2xl border-2 border-brand-black shadow-lg">
              <button
                type="button"
                onClick={() => switchTab('auto')}
                className={`min-h-11 px-5 py-2.5 rounded-xl text-[0.95rem] font-heading font-bold transition-all duration-200 ${
                  activeTab === 'auto'
                    ? 'bg-brand-orange text-white shadow-lg'
                    : 'bg-white text-brand-black hover:bg-eatspin-peach/30'
                }`}
              >
                <span className="inline-flex items-center gap-2"><Sparkles size={18} />Spin for me</span>
              </button>
              <button
                type="button"
                onClick={() => switchTab('manual')}
                className={`min-h-11 px-5 py-2.5 rounded-xl text-[0.95rem] font-heading font-bold transition-all duration-200 ${
                  activeTab === 'manual'
                    ? 'bg-brand-orange text-white shadow-lg'
                    : 'bg-white text-brand-black hover:bg-eatspin-peach/30'
                }`}
              >
                <span className="inline-flex items-center gap-2"><PencilLine size={18} />I know where</span>
              </button>
            </div>
          </div>

          {activeTab === 'auto' && (
            <>
              {!location && (
                <div className="mb-6">
                  <LocationPermission
                    isLoading={locationLoading}
                    error={locationError}
                    onRequestLocation={requestLocation}
                    location={location}
                  />
                </div>
              )}

              {location && (
                <div className="mb-6 rounded-2xl border border-eatspin-peach/60 bg-brand-linen/60 p-4 sm:p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full bg-eatspin-success/10 px-3 py-1.5">
                      <div className="h-2 w-2 rounded-full bg-eatspin-success animate-pulse" />
                      <MapPin size={15} className="text-eatspin-success" />
                      <span className="text-sm font-medium text-eatspin-success">Finding restaurants near you</span>
                    </div>
                    <p className="text-sm text-eatspin-gray-1">
                      <span className="font-semibold text-brand-orange">{roundRestaurants.length}</span> matches
                    </p>
                  </div>

                  <div className="mb-4">
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Search radius: <span className="font-bold text-brand-orange">{radiusKm} km</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={radiusKm}
                      onChange={(e) => setRadiusKm(Number(e.target.value))}
                      className="range-theme w-full"
                    />
                    <div className="mt-1 flex justify-between text-xs text-gray-500">
                      <span>1 km</span>
                      <span>10 km</span>
                      <span>20 km</span>
                    </div>
                  </div>

                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-eatspin-gray-1">Quick filters</span>
                    {priceOptions.map((price) => {
                      const isSelected = selectedPriceRanges.includes(price);
                      return (
                        <button
                          key={price}
                          type="button"
                          onClick={() => togglePriceRange(price)}
                          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                            isSelected
                              ? 'bg-brand-orange text-white shadow-md'
                              : 'border border-gray-200 bg-white text-brand-black hover:border-brand-orange hover:text-brand-orange'
                          }`}
                        >
                          {price}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setNonHalalOnly((prev) => !prev)}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                        nonHalalOnly
                          ? 'bg-brand-orange text-white shadow-md'
                          : 'border border-gray-200 bg-white text-brand-black hover:border-brand-orange hover:text-brand-orange'
                      }`}
                    >
                      Non-halal only
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsMoreFiltersOpen((prev) => !prev)}
                    className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-black hover:text-brand-orange"
                  >
                    <ChevronDown
                      size={16}
                      className={`transition-transform duration-200 ${isMoreFiltersOpen ? 'rotate-180' : ''}`}
                    />
                    More filters
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs text-eatspin-gray-1">
                      {selectedCategories.length}/3 cuisine tags
                    </span>
                  </button>

                  <div
                    className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out ${
                      isMoreFiltersOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                  >
                    <div className="min-h-0">
                      <FoodCategorySelector
                        selectedCategories={selectedCategories}
                        onCategoryChange={setSelectedCategories}
                        maxSelection={3}
                      />
                    </div>
                  </div>
                </div>
              )}

              {location && roundRestaurants.length > 0 && (
                <div className="mb-8 rounded-2xl border border-eatspin-peach/60 bg-white p-4 sm:p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {/* User TODO: Make this section collapsible by editing isReviewExpanded state */}
                      <button
                        type="button"
                        onClick={() => setIsReviewExpanded(!isReviewExpanded)}
                        className="flex items-center gap-2"
                      >
                        <ChevronDown
                          size={20}
                          className={`text-eatspin-gray-1 transition-transform duration-200 ${
                            isReviewExpanded ? 'rotate-180' : ''
                          }`}
                        />
                        <h3 className="font-heading text-lg font-semibold text-brand-black">Review this round</h3>
                      </button>
                    </div>
                    <p className="text-sm font-medium text-brand-black">
                      {roundRestaurants.length} restaurants remaining
                    </p>
                  </div>

                  <div
                    className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                      isReviewExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                  >
                    <ul className="max-h-72 overflow-y-auto overscroll-contain space-y-2 pr-1">
                      {roundRestaurants.map((restaurant) => (
                        <li key={restaurant.id} className="flex items-start justify-between gap-3 rounded-xl bg-brand-linen px-3 py-2">
                          <div>
                            <p className="font-medium text-brand-black">{restaurant.name}</p>
                            <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-eatspin-gray-1">
                              {restaurant.category.slice(0, 2).map((tag) => (
                                <span key={`${restaurant.id}-${tag}`} className="rounded-full bg-white px-2 py-0.5 capitalize">
                                  {tag}
                                </span>
                              ))}
                              <span className="rounded-full bg-white px-2 py-0.5">{restaurant.priceRange}</span>
                              {restaurant.distance !== undefined && (
                                <span className="rounded-full bg-white px-2 py-0.5">{restaurant.distance.toFixed(1)} km</span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeRestaurantForRound(restaurant.id)}
                            className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
                            aria-label={`Remove ${restaurant.name} for this round`}
                          >
                            <X size={14} /> Remove
                          </button>
                        </li>
                      ))}

                      </ul>
                    </div>
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

              {location && roundRestaurants.length > 0 && (
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
                    disabled={isSpinning || roundRestaurants.length === 0}
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
            <div id="wheel" className="py-4 pb-36 sm:pb-8">
              {isGroupRoomActive && (
                <div className="mb-4 rounded-xl border border-brand-orange/30 bg-brand-linen px-4 py-3 text-sm text-eatspin-gray-1">
                  <p className="font-semibold text-brand-black">
                    Room {groupRoomId} {isGroupHost ? '(Host)' : isGroupCohost ? '(Co-host)' : '(Participant)'}
                  </p>
                  <p>
                    {isGroupHost
                      ? 'Your list edits sync to everyone in this room.'
                      : isGroupCohost
                        ? 'You can edit the shared list as co-host. Only host can start spins.'
                        : 'List editing is host/co-host only. You will receive live list and spin updates.'}
                  </p>
                </div>
              )}
              {/* <div className="text-center mb-5">
                <h3 className="font-heading text-2xl font-bold text-brand-black mb-2">I know where</h3>
                <p className="text-sm text-eatspin-gray-1">Add any restaurants you like and spin.</p>
              </div> */}

              <RouletteWheel
                key={isGroupRoomActive ? `manual-room-${groupRoomId || 'none'}` : `manual-${manualWheelKey}-${manualRestaurants.length}`}
                restaurants={manualRestaurants}
                totalCount={manualRestaurants.length}
                onSpinComplete={handleManualSpinComplete}
                isSpinning={isSpinning}
                setIsSpinning={setIsSpinning}
                onShuffle={() => {
                  shuffleManualRestaurants();
                }}
                canSpin={manualRestaurants.length >= 2 && (!isGroupRoomActive || isGroupHost)}
                helperText={manualHelperText}
                spinButtonLabel={isGroupRoomActive ? (isGroupHost ? 'Spin for everyone' : 'Waiting for host spin') : 'Spin the Wheel!'}
                externalSpin={manualExternalSpin}
                onRequestSpin={isGroupRoomActive ? handleRequestGroupSpin : undefined}
                canRequestSpin={!isGroupRoomActive || isGroupHost}
                emptyStateTitle="Add restaurants to start"
                emptyStateSubtitle="Type any restaurant you like…"
              />

                <div id="manual-input" className="mt-8 max-w-xl mx-auto">
                  {manualSpinResult && (
                    <div className="mb-3 rounded-xl border border-eatspin-peach/60 bg-gradient-to-r from-white to-brand-linen px-4 py-3 text-center shadow-sm">
                      <p className="text-xs uppercase tracking-[0.18em] text-eatspin-gray-1">Last result</p>
                      <p className="font-heading text-lg text-brand-black">✨ {manualSpinResult.name}</p>
                    </div>
                  )}

                  <div className="sticky bottom-3 z-30 rounded-2xl border border-eatspin-peach/60 bg-white/95 p-3 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-white/85">
                  <div className="flex flex-col sm:flex-row gap-2">
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
                      className="h-12 text-base"
                      disabled={isManualListReadOnly}
                    />
                    <Button onClick={addManualRestaurant} disabled={isManualListReadOnly} className="h-12 px-6 text-base font-heading font-bold bg-brand-orange hover:bg-brand-orange/90">
                      <Plus size={18} className="mr-1" /> Add
                    </Button>
                  </div>
                </div>

                <div className="mt-4 bg-white rounded-xl border border-eatspin-peach/60 p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-heading font-semibold text-brand-black">Restaurant list ({manualRestaurants.length})</h4>
                    {manualRestaurants.length > 0 && (
                      <button
                        type="button"
                        className="text-xs font-medium text-eatspin-orange hover:underline"
                        onClick={clearManualRestaurants}
                        disabled={isManualListReadOnly}
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
                            disabled={isManualListReadOnly}
                          >
                            <X size={16} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-4 bg-white rounded-xl border border-eatspin-peach/60 p-4 space-y-3">
                  <div>
                    <h4 className="font-heading font-semibold text-brand-black">Quick Presets</h4>
                    <p className="text-xs text-eatspin-gray-1">Save this wheel and load it anytime. Meal presets auto-load by current time.</p>
                  </div>

                  <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2">
                    <Input
                      value={presetNameInput}
                      onChange={(e) => setPresetNameInput(e.target.value)}
                      placeholder="Preset name (e.g. Lunch Nearby)"
                      className="h-11"
                    />
                    <div className="relative">
                      <select
                        value={presetMealTimeInput ?? ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === 'breakfast' || value === 'lunch' || value === 'dinner') {
                            setPresetMealTimeInput(value);
                            return;
                          }
                          setPresetMealTimeInput(null);
                        }}
                        className="preset-select h-11 w-full rounded-md border border-eatspin-peach/70 bg-white px-3 pr-10 text-sm text-brand-black"
                      >
                        <option value="">🕒 No meal time</option>
                        <option value="breakfast">🌅 Breakfast</option>
                        <option value="lunch">☀️ Lunch</option>
                        <option value="dinner">🌙 Dinner</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-eatspin-gray-1" />
                    </div>
                    <Button
                      onClick={saveCurrentAsPreset}
                      disabled={manualRestaurants.length === 0 || !presetNameInput.trim()}
                      className="h-11 px-4 bg-brand-orange text-white font-semibold hover:bg-brand-orange/90"
                    >
                      Save Preset
                    </Button>
                  </div>

                  {manualPresets.length === 0 ? (
                    <p className="text-sm text-eatspin-gray-1">No saved presets yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {manualPresets.map((preset) => (
                        <li key={preset.id} className="flex items-center justify-between gap-2 rounded-lg bg-brand-linen px-3 py-2">
                          <button
                            type="button"
                            onClick={() => loadPresetRestaurants(preset)}
                            className="text-left flex-1"
                            disabled={isManualListReadOnly}
                          >
                            <p className="text-sm font-medium text-brand-black">
                              {preset.mealTime === 'breakfast' ? '🌅' : preset.mealTime === 'lunch' ? '☀️' : preset.mealTime === 'dinner' ? '🌙' : '🕒'} {preset.name}
                            </p>
                            <p className="text-xs text-eatspin-gray-1">
                              {preset.restaurants.length} picks{preset.mealTime ? ` • ${presetMealTimeTimeToLabel(preset.mealTime)}` : ''}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => deletePreset(preset.id)}
                            className="text-eatspin-gray-1 hover:text-red-500"
                            aria-label={`Delete preset ${preset.name}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                </div>
            </div>
          )}
        </div>
      </section>

      <GroupSpin
        isFirebaseConfigured={isFirebaseConfigured}
        firebaseConfigError={firebaseConfigError}
        authLoading={groupAuthLoading}
        authError={groupAuthError}
        authUid={groupAuthUid}
        displayName={groupDisplayName}
        resolvedDisplayName={groupResolvedDisplayName}
        setDisplayName={setGroupDisplayName}
        roomId={groupRoomId}
        hostUid={groupHostUid}
        roomLink={groupRoomLink}
        isHost={isGroupHost}
        isCohost={isGroupCohost}
        cohostUids={groupCohostUids}
        isBusy={groupRoomBusy}
        roomError={groupRoomError}
        participants={groupParticipants}
        onCreateRoom={handleCreateGroupRoom}
        onJoinRoom={handleJoinGroupRoom}
        onLeaveRoom={leaveGroupRoom}
        onSetParticipantCohost={setParticipantCohost}
        onClearRoomError={clearGroupRoomError}
      />

      {activeTab === 'auto' && showWheelSection && location && roundRestaurants.length > 0 && (
        <section id="wheel" className="py-16 px-4 sm:px-6 lg:px-8 bg-brand-linen">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-brand-black mb-2">
                Spin the Wheel!
              </h2>
              <p className="text-eatspin-gray-1">
                {roundRestaurants.length} restaurants ready for this round
              </p>
            </div>

            <RouletteWheel
              key={`auto-${autoWheelKey}`}
              restaurants={wheelRestaurants}
              totalCount={roundRestaurants.length}
              onSpinComplete={handleSpinComplete}
              isSpinning={isSpinning}
              setIsSpinning={setIsSpinning}
              onShuffle={shuffleWheel}
              onSpinStart={handleAutoSpinStart}
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

      <Toaster />
    </div>
  );
}

export default App;
