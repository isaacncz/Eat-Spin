import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import { trackEvent } from '@/lib/analytics';
import { APP_FEATURES } from '@/lib/featureFlags';
import { useLocation } from '@/hooks/useLocation';
import { useNearbyRestaurants } from '@/hooks/useNearbyRestaurants';
import { useSpinTracker } from '@/hooks/useSpinTracker';
import { useFirebaseGroupRoom } from '@/hooks/useFirebaseGroupRoom';
import { usePwaInstallPrompt } from '@/hooks/usePwaInstallPrompt';
import { useSpinChallenge } from '@/hooks/useSpinChallenge';
import { useDiscoverFeed } from '@/hooks/useDiscoverFeed';
import type { FoodCategory, MealTime, Restaurant } from '@/types';
import { restaurants as localRestaurants } from '@/data/restaurants';
import {
  AUTO_SPIN_MINUTES_UNTIL_CLOSE_CUTOFF,
  enhancedFilterRestaurants,
  findNearbyFavourites,
} from '@/lib/restaurantUtils';
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
import { RotateCcw, Crown, MapPin, Utensils, Sparkles, PencilLine, Plus, X, Trash2, ChevronDown, CheckCircle2, Heart } from 'lucide-react';
import { useFavourites } from '@/hooks/useFavourites';
import { useFeedbackPrompt } from '@/hooks/useFeedbackPrompt';
import { enqueueFeedback } from '@/lib/feedbackStore';
import { deriveFavouriteId } from '@/types/favourites';
import { shareCard } from '@/lib/shareCard';
import { FeedbackPrompt } from '@/components/FeedbackPrompt';
import { FirstRunOnboarding } from '@/components/FirstRunOnboarding';
import { toast } from 'sonner';
import './App.css';

type SpinTab = 'auto' | 'manual';
type AutoRangeMode = 'walk' | 'drive10' | 'drive20';
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
const AUTO_RANGE_MODE_STORAGE_KEY = 'eatspin:auto-range-mode';
const SPIN_REJECTION_STORAGE_KEY = 'eatspin:spin-rejections';
const FIRST_RUN_ONBOARDING_SEEN_KEY = 'eatspin:first-run-onboarding-seen';
const ROOM_LIST_SYNC_GRACE_MS = 2_500;
const GROUP_SPIN_REPLAY_WINDOW_MS = 30_000;
const LATE_JOIN_NOTICE_MS = 5 * 60 * 1000;
const REVIEW_PREVIEW_COUNT = 30;
const SPIN_HISTORY_PREVIEW_COUNT = 8;
const MANUAL_SUGGESTED_RESTAURANTS = ['Sushi Place', 'Burger Spot', 'Local Noodles', 'Pizza Corner'];
const DEFAULT_AUTO_RANGE_MODE: AutoRangeMode = 'drive10';
const AUTO_RANGE_RADIUS_KM: Record<AutoRangeMode, number> = {
  walk: 1.2,
  drive10: 6,
  drive20: 12,
};
const AUTO_RANGE_LABEL: Record<AutoRangeMode, string> = {
  walk: 'Walking distance',
  drive10: '10 min drive',
  drive20: '20 min drive',
};
const AUTO_RANGE_OPTIONS: Array<{ id: AutoRangeMode; label: string; helper: string }> = [
  { id: 'walk', label: 'Walking distance', helper: '~1.2 km' },
  { id: 'drive10', label: '10 min drive', helper: '~6 km' },
  { id: 'drive20', label: '20 min drive', helper: '~12 km' },
];

const isAutoRangeMode = (value: string): value is AutoRangeMode =>
  value === 'walk' || value === 'drive10' || value === 'drive20';

const loadAutoRangeMode = (): AutoRangeMode => {
  if (typeof window === 'undefined') return DEFAULT_AUTO_RANGE_MODE;
  const storedMode = window.localStorage.getItem(AUTO_RANGE_MODE_STORAGE_KEY);
  if (!storedMode || !isAutoRangeMode(storedMode)) {
    return DEFAULT_AUTO_RANGE_MODE;
  }
  return storedMode;
};

const createManualRestaurant = (name: string): Restaurant => {
  const now = Date.now();
  return {
    id: `manual-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    category: ['street food'],
    address: 'Your custom pick',
    coordinates: { lat: 0, lng: 0 },
    hours: {
      daily: { windows: [{ open: '00:00', close: '23:59' }] },
    },
    rating: 5,
    priceRange: '$$',
    description: 'Great choice. Your next food adventure starts here.',
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

const formatRelativeSpinTime = (ageMs: number) => {
  const seconds = Math.max(0, Math.floor(ageMs / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const formatAbsoluteSpinTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const formatAbsoluteSyncTime = (timestamp: number) =>
  new Date(timestamp).toLocaleString([], { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' });

const toDateKey = (timestamp: Date | string | number): string => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatSpinTimestamp = (timestamp: Date | string | number): string =>
  new Date(timestamp).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const calculateCurrentSpinStreak = (timestamps: Array<Date | string | number>): number => {
  const uniqueDayKeys = Array.from(new Set(timestamps.map((value) => toDateKey(value))));
  if (uniqueDayKeys.length === 0) return 0;

  const availableDays = new Set(uniqueDayKeys);
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  let streak = 0;

  while (availableDays.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
};

function App() {
  // State management
  const [selectedCategories, setSelectedCategories] = useState<FoodCategory[]>([]);
  const [selectedPriceRanges, setSelectedPriceRanges] = useState<Restaurant['priceRange'][]>([]);
  const [rangeMode, setRangeMode] = useState<AutoRangeMode>(() => loadAutoRangeMode());
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
  const [showAllRoundRestaurants, setShowAllRoundRestaurants] = useState(false);
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !window.localStorage.getItem(FIRST_RUN_ONBOARDING_SEEN_KEY);
  });
  const [challengeJoinInput, setChallengeJoinInput] = useState('');
  const [uiNowMs, setUiNowMs] = useState(() => Date.now());

  const [manualInput, setManualInput] = useState('');
  const [personalManualRestaurants, setPersonalManualRestaurants] = useState<Restaurant[]>(() => loadManualRestaurants());
  const [roomManualRestaurants, setRoomManualRestaurants] = useState<Restaurant[]>([]);
  const [isManualRoomLeavePending, setIsManualRoomLeavePending] = useState(false);
  const [manualWheelKey, setManualWheelKey] = useState(0);
  const [, setManualSpinResult] = useState<Restaurant | null>(null);
  const [presetNameInput, setPresetNameInput] = useState('');
  const [presetMealTimeInput, setPresetMealTimeInput] = useState<PresetMealTime>(() => getPresetMealTime());
  const [manualPresets, setManualPresets] = useState<ManualPreset[]>(() => loadManualPresets());
  const [groupSpinNow, setGroupSpinNow] = useState(() => Date.now());
  // Fetch radius follows the selected range mode so each mode gets its own
  // focused 20-place pool from Google. Cached separately per radius — repeat
  // visits cost nothing for 7 days.
  const fetchRadiusKm = AUTO_RANGE_RADIUS_KM[rangeMode];
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

  const handleHeroGetStarted = useCallback(() => {
    trackEvent('hero_get_started');
    setActiveTab('auto');
    scrollToSection('app');
  }, [scrollToSection]);

  // Custom hooks
  const { location, error: locationError, isLoading: locationLoading, requestLocation } = useLocation();
  const { spins, canSpin, recordSpin } = useSpinTracker();
  const {
    favourites,
    isFavourite: isFavouriteCheck,
    save: saveFavourite,
    remove: removeFavouriteEntry,
    restore: restoreFavouriteEntry,
    recordVisitAndSave,
    updateRating: updateFavouriteRating,
  } = useFavourites();
  const { pending: feedbackPending, dismiss: dismissFeedback } = useFeedbackPrompt();
  const {
    restaurants: nearbyRestaurants,
    isLoading: nearbyRestaurantsLoading,
    error: nearbyRestaurantsError,
    source: nearbyRestaurantsSource,
    shouldUseLocalFallback,
    lastSyncedAt: nearbyLastSyncedAt,
  } = useNearbyRestaurants({
    enabled: activeTab === 'auto' && Boolean(location),
    location,
    radiusKm: fetchRadiusKm,
    openNowOnly: true,
    selectedCategories,
  });
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
    roomStatus: groupRoomStatus,
    reactions: groupReactions,
    votes: groupVotes,
    createRoom: createGroupRoom,
    joinRoom: joinGroupRoom,
    leaveRoom: leaveGroupRoom,
    syncHostList,
    setParticipantCohost,
    requestHostSpin,
    sendReaction: sendGroupReaction,
    setGoingVote: setGroupGoingVote,
  } = useFirebaseGroupRoom();
  const {
    shouldShowBanner: showPwaInstallBanner,
    isPromptReady: isPwaPromptReady,
    dismissBanner: dismissPwaInstallBanner,
    promptInstall,
  } = usePwaInstallPrompt({
    spinCount: spins.length,
    showAfterSpins: 2,
  });
  const {
    challengeId,
    challengeLink,
    leaderboard: challengeLeaderboard,
    myParticipant: myChallengeParticipant,
    meta: challengeMeta,
    isBusy: challengeBusy,
    error: challengeError,
    createChallenge,
    joinChallenge,
    leaveChallenge,
    recordDailySpin,
  } = useSpinChallenge(groupAuthUid, groupResolvedDisplayName, {
    enabled: APP_FEATURES.spinChallenge,
  });
  const {
    events: discoverEvents,
    error: discoverFeedError,
    geoKey: discoverGeoKey,
    publishSpin: publishDiscoverSpin,
  } = useDiscoverFeed(location, groupAuthUid, {
    enabled: APP_FEATURES.discoverFeed,
  });

  const priceOptions: Restaurant['priceRange'][] = ['$', '$$', '$$$', '$$$$'];
  const isGroupRoomActive = Boolean(groupRoomId);
  const shouldShowRoomManualRestaurants = isGroupRoomActive && !isManualRoomLeavePending;
  const displayedManualRestaurants = useMemo(
    () => (shouldShowRoomManualRestaurants ? roomManualRestaurants : personalManualRestaurants),
    [personalManualRestaurants, roomManualRestaurants, shouldShowRoomManualRestaurants],
  );
  const personalManualRestaurantNames = useMemo(
    () => normalizeManualNames(personalManualRestaurants.map((restaurant) => restaurant.name)),
    [personalManualRestaurants],
  );
  const roomManualRestaurantNames = useMemo(
    () => normalizeManualNames(roomManualRestaurants.map((restaurant) => restaurant.name)),
    [roomManualRestaurants],
  );
  const displayedManualRestaurantNames = useMemo(
    () => normalizeManualNames(displayedManualRestaurants.map((restaurant) => restaurant.name)),
    [displayedManualRestaurants],
  );
  const isManualListReadOnly = shouldShowRoomManualRestaurants && !canEditGroupList;
  const localFallbackAutoRestaurants = useMemo(
    () => localRestaurants.map((restaurant) => ({
      ...restaurant,
      source: 'local-fallback' as const,
      categoryConfidence: 'high' as const,
    })),
    []
  );
  const autoSourceRestaurants = useMemo(() => {
    if (!location) return [];
    if (nearbyRestaurants.length > 0) return nearbyRestaurants;
    if (shouldUseLocalFallback) return localFallbackAutoRestaurants;
    return [];
  }, [location, nearbyRestaurants, shouldUseLocalFallback, localFallbackAutoRestaurants]);
  const autoDataSourceLabel = useMemo(() => {
    if (!location) return null;
    if (nearbyRestaurantsLoading) return 'Loading nearby restaurants...';
    if (nearbyRestaurantsSource === 'google-cache') {
      if (!nearbyLastSyncedAt) return 'Using cached nearby results (refresh after moving >100m).';
      return `Using cached nearby results (refresh after moving >100m, last sync ${formatAbsoluteSyncTime(nearbyLastSyncedAt)}).`;
    }
    if (nearbyRestaurantsSource === 'google-live') {
      if (!nearbyLastSyncedAt) return 'Using live nearby results.';
      return `Using live nearby results (synced ${formatAbsoluteSyncTime(nearbyLastSyncedAt)}).`;
    }
    if (shouldUseLocalFallback) return 'Google unavailable. Using local fallback results.';
    return null;
  }, [
    location,
    nearbyLastSyncedAt,
    nearbyRestaurantsLoading,
    nearbyRestaurantsSource,
    shouldUseLocalFallback,
  ]);

  const togglePriceRange = (price: Restaurant['priceRange']) => {
    setSelectedPriceRanges((prev) =>
      prev.includes(price) ? prev.filter((p) => p !== price) : [...prev, price]
    );
    setShowAllRoundRestaurants(false);
  };

  const handleCategoryChange = useCallback((categories: FoodCategory[]) => {
    setSelectedCategories(categories);
    setShowAllRoundRestaurants(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(AUTO_RANGE_MODE_STORAGE_KEY, rangeMode);
  }, [rangeMode]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setUiNowMs(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  // Update current meal time
  useEffect(() => {
    const updateMealTime = () => {
      setCurrentMealTime(getCurrentMealTime());
    };

    updateMealTime();
    const interval = setInterval(updateMealTime, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const avoidedRestaurantIds = useMemo(() => {
    const ids = new Set<string>();
    for (const fav of favourites) {
      if (fav.userRating === 'avoid') {
        ids.add(fav.id);
        if (fav.restaurant.googlePlaceId) ids.add(fav.restaurant.googlePlaceId);
      }
    }
    return ids;
  }, [favourites]);

  // Nearby favourites: favourites within ~1.5 km of the user's current location
  const nearbyFavourites = useMemo(() => {
    if (!location) return [];
    return findNearbyFavourites(favourites, location.lat, location.lng);
  }, [favourites, location]);

  const spinHistorySummary = useMemo(() => {
    const categoryCounter = new Map<string, number>();
    const restaurantIds = new Set<string>();

    for (const spin of spins) {
      const restaurant = spin.restaurant;
      const category = restaurant.category?.[0] ?? 'other';
      categoryCounter.set(category, (categoryCounter.get(category) ?? 0) + 1);
      restaurantIds.add(restaurant.googlePlaceId ?? restaurant.id);
    }

    const topCategory = [...categoryCounter.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const monthKey = new Date().toLocaleString([], { month: 'short', year: 'numeric' });
    const spinsThisMonth = spins.filter((spin) => (
      new Date(spin.timestamp).toLocaleString([], { month: 'short', year: 'numeric' }) === monthKey
    )).length;

    const recentSpins = [...spins]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, SPIN_HISTORY_PREVIEW_COUNT);

    return {
      totalSpins: spins.length,
      uniqueRestaurants: restaurantIds.size,
      topCategory,
      currentStreak: calculateCurrentSpinStreak(spins.map((spin) => spin.timestamp)),
      spinsThisMonth,
      recentSpins,
    };
  }, [spins]);

  const filterResult = useMemo(() => (
    enhancedFilterRestaurants(
      autoSourceRestaurants,
      location,
      selectedCategories,
      rangeMode,
      selectedPriceRanges,
      'all',
      undefined,
      avoidedRestaurantIds,
    )
  ), [autoSourceRestaurants, location, selectedCategories, rangeMode, selectedPriceRanges, avoidedRestaurantIds]);

  const filteredRestaurants = filterResult.results;
  const closingSoonExcludedCount = filterResult.closingSoonExcludedCount;
  const closedNowExcludedCount = filterResult.closedNowExcludedCount;

  const autoAvailabilityHelperText = useMemo(() => {
    const messages: string[] = [];

    if (closingSoonExcludedCount > 0) {
      messages.push(
        `${closingSoonExcludedCount} place${closingSoonExcludedCount === 1 ? '' : 's'} will close in under ${AUTO_SPIN_MINUTES_UNTIL_CLOSE_CUTOFF} min, so they were skipped.`
      );
    }

    if (closedNowExcludedCount > 0) {
      messages.push(
        `${closedNowExcludedCount} place${closedNowExcludedCount === 1 ? '' : 's'} are closed right now.`
      );
    }

    return messages.join(' ');
  }, [closedNowExcludedCount, closingSoonExcludedCount]);

  const autoEmptyStateSubtitle = useMemo(() => {
    if (closingSoonExcludedCount > 0 && filteredRestaurants.length === 0) {
      return `Everything nearby is either closed or shutting within ${AUTO_SPIN_MINUTES_UNTIL_CLOSE_CUTOFF} min. Try a wider range or check back soon.`;
    }

    if (closedNowExcludedCount > 0 && filteredRestaurants.length === 0) {
      return 'Everything matching your filters is closed right now. Try widening your filters or check back soon.';
    }

    return 'Try selecting different categories or check back during meal hours';
  }, [closedNowExcludedCount, closingSoonExcludedCount, filteredRestaurants.length]);

  const roundRestaurants = useMemo(() => (
    filteredRestaurants.filter((restaurant) => !roundRemovedRestaurantIds.includes(restaurant.id))
  ), [filteredRestaurants, roundRemovedRestaurantIds]);

  const displayedRoundRestaurants = useMemo(() => (
    showAllRoundRestaurants
      ? roundRestaurants
      : roundRestaurants.slice(0, REVIEW_PREVIEW_COUNT)
  ), [roundRestaurants, showAllRoundRestaurants]);

  const removeRestaurantForRound = useCallback((
    restaurantId: string,
    options?: { bumpKey?: boolean },
  ) => {
    const { bumpKey = true } = options ?? {};
    setRoundRemovedRestaurantIds((prev) => (prev.includes(restaurantId) ? prev : [...prev, restaurantId]));
    setWheelRestaurants((prev) => prev.filter((restaurant) => restaurant.id !== restaurantId));
    if (bumpKey) {
      setAutoWheelKey((prev) => prev + 1);
    }
  }, []);

  const handleAutoSpinStart = useCallback(() => {
    if (!pendingAutoRemovalId) return null;

    setPendingAutoRemovalId(null);
    removeRestaurantForRound(pendingAutoRemovalId, { bumpKey: false });
    return wheelRestaurants.filter((restaurant) => restaurant.id !== pendingAutoRemovalId);
  }, [pendingAutoRemovalId, removeRestaurantForRound, wheelRestaurants]);

  // Handle spin complete
  const handleSpinComplete = useCallback((restaurant: Restaurant) => {
    trackEvent('spin_complete', { mode: 'auto', restaurant_name: restaurant.name, category: restaurant.category?.[0] ?? '' });
    recordSpin(restaurant, currentMealTime);
    void recordDailySpin();
    void publishDiscoverSpin(restaurant.name, currentMealTime);
    setPendingAutoRemovalId(restaurant.id);
  }, [currentMealTime, publishDiscoverSpin, recordDailySpin, recordSpin]);

  const handleManualSpinComplete = useCallback((restaurant: Restaurant) => {
    trackEvent('spin_complete', { mode: 'manual', restaurant_name: restaurant.name });
    setManualSpinResult(restaurant);
    void recordDailySpin();
    void publishDiscoverSpin(restaurant.name, currentMealTime);
  }, [currentMealTime, publishDiscoverSpin, recordDailySpin]);

  const handleSaveFavourite = useCallback((restaurant: Restaurant, mode: 'auto' | 'manual') => {
    trackEvent('favourite_saved', { restaurant_name: restaurant.name, mode });
    void saveFavourite(restaurant, mode === 'auto' ? 'spin-auto' : 'spin-manual');
    toast.success(`${restaurant.name} saved to favourites!`, {
      description: 'Find it in the "I Know Where" tab under My Favourites.',
    });
  }, [saveFavourite]);

  const handleShareResult = useCallback(async (restaurant: Restaurant, cardElement: HTMLElement) => {
    trackEvent('share_result_open', { restaurant_name: restaurant.name, tab: activeTab });

    try {
      const shareMethod = await shareCard({
        element: cardElement,
        fileName: `eatspin-${restaurant.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'result'}`,
        title: `EatSpin picked ${restaurant.name}`,
        text: `We spun ${restaurant.name} on EatSpin. Try your luck!`,
        url: typeof window !== 'undefined' ? window.location.origin : '',
      });

      trackEvent('share_result_success', {
        restaurant_name: restaurant.name,
        method: shareMethod,
        tab: activeTab,
      });

      toast.success('Share ready!', {
        description: shareMethod === 'download'
          ? 'Image downloaded. Share it in your group chat.'
          : 'Shared successfully.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      trackEvent('share_result_failure', {
        restaurant_name: restaurant.name,
        tab: activeTab,
        error: message,
      });
      toast.error('Unable to share this result right now.');
    }
  }, [activeTab]);

  const handleAutoSpinAgain = useCallback((restaurant: Restaurant) => {
    trackEvent('spin_again_requested', {
      restaurant_name: restaurant.name,
      round_size: wheelRestaurants.length,
    });

    if (typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(SPIN_REJECTION_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) as Record<string, number> : {};
      const key = restaurant.googlePlaceId ?? restaurant.id;
      parsed[key] = (parsed[key] ?? 0) + 1;
      window.localStorage.setItem(SPIN_REJECTION_STORAGE_KEY, JSON.stringify(parsed));
    } catch {
      // Best-effort local signal; analytics still tracks action.
    }
  }, [wheelRestaurants.length]);

  const handlePwaInstall = useCallback(async () => {
    trackEvent('pwa_install_prompt_open', { spin_count: spins.length });
    const outcome = await promptInstall();

    if (outcome === 'accepted') {
      trackEvent('pwa_install_accepted', { spin_count: spins.length });
      toast.success('App installation started.');
      return;
    }

    if (outcome === 'dismissed') {
      trackEvent('pwa_install_dismissed', { spin_count: spins.length });
      toast('Install prompt dismissed for now.');
      return;
    }

    toast('Install prompt is unavailable on this browser right now.');
  }, [promptInstall, spins.length]);

  const handleDismissPwaBanner = useCallback(() => {
    dismissPwaInstallBanner();
    trackEvent('pwa_install_banner_dismissed', { spin_count: spins.length });
  }, [dismissPwaInstallBanner, spins.length]);

  const handleShareSpinWrapped = useCallback(async () => {
    const topCategoryLabel = spinHistorySummary.topCategory ?? 'mixed cuisines';
    const summaryText = `I spun ${spinHistorySummary.totalSpins} times on EatSpin with a ${spinHistorySummary.currentStreak}-day streak. Top category: ${topCategoryLabel}.`;
    trackEvent('spin_wrapped_share_open', {
      total_spins: spinHistorySummary.totalSpins,
      current_streak: spinHistorySummary.currentStreak,
    });

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'My EatSpin Wrapped',
          text: summaryText,
          url: window.location.origin,
        });
        trackEvent('spin_wrapped_share_success');
        return;
      } catch {
        trackEvent('spin_wrapped_share_cancelled');
        return;
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(`${summaryText} ${window.location.origin}`);
      toast.success('Wrapped summary copied to clipboard.');
      trackEvent('spin_wrapped_share_copied');
    }
  }, [spinHistorySummary]);

  const dismissFirstRunOnboarding = useCallback(() => {
    setShowOnboarding(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(FIRST_RUN_ONBOARDING_SEEN_KEY, '1');
    }
    trackEvent('first_run_onboarding_dismissed');
  }, []);

  const handleOnboardingOpenAutoMode = useCallback(() => {
    setActiveTab('auto');
    scrollToSection('app');
    trackEvent('first_run_onboarding_auto_mode_opened');
  }, [scrollToSection]);

  const handleCreateChallenge = useCallback(() => {
    trackEvent('challenge_create_requested');
    void createChallenge();
  }, [createChallenge]);

  const handleJoinChallenge = useCallback(() => {
    if (!challengeJoinInput.trim()) return;
    trackEvent('challenge_join_requested');
    void joinChallenge(challengeJoinInput);
    setChallengeJoinInput('');
  }, [challengeJoinInput, joinChallenge]);

  const handleCopyChallengeLink = useCallback(async () => {
    if (!challengeLink || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(challengeLink);
    toast.success('Challenge link copied.');
    trackEvent('challenge_link_copied');
  }, [challengeLink]);

  const handleLeaveChallenge = useCallback(() => {
    trackEvent('challenge_left');
    void leaveChallenge();
  }, [leaveChallenge]);

  const handleLetsGo = useCallback((restaurant: Restaurant) => {
    trackEvent('lets_go_tapped', { restaurant_name: restaurant.name });
    void recordVisitAndSave(restaurant);

    // Enqueue feedback for next app open
    const favId = deriveFavouriteId(restaurant);
    enqueueFeedback({ favouriteId: favId, restaurantName: restaurant.name });

    // Open Google Maps navigation
    const { lat, lng } = restaurant.coordinates;
    const query = encodeURIComponent(restaurant.name);
    const mapsUrl = lat && lng
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${restaurant.googlePlaceId ?? ''}&query=${query}`
      : `https://www.google.com/maps/search/?api=1&query=${query}`;
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');

    toast.success(`Navigating to ${restaurant.name}!`, {
      description: 'We\'ll ask how it was next time you open the app.',
    });
  }, [recordVisitAndSave]);

  const handleRemoveFavourite = useCallback((id: string, name: string) => {
    trackEvent('favourite_removed', { favourite_id: id });
    void removeFavouriteEntry(id).then((deleted) => {
      toast(`Removed ${name} from favourites`, {
        duration: 5000,
        action: deleted
          ? {
              label: 'Undo',
              onClick: () => {
                void restoreFavouriteEntry(deleted).then(() => {
                  toast.success(`${name} restored to favourites`);
                });
              },
            }
          : undefined,
      });
    });
  }, [removeFavouriteEntry, restoreFavouriteEntry]);

  const setDisplayedManualRestaurants = useCallback((restaurants: Restaurant[]) => {
    if (shouldShowRoomManualRestaurants) {
      setRoomManualRestaurants(restaurants);
      return;
    }

    setPersonalManualRestaurants(restaurants);
  }, [shouldShowRoomManualRestaurants]);

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

  const addManualRestaurantByName = useCallback((restaurantName: string) => {
    if (isManualListReadOnly) {
      toast.info('Only the host or co-host can edit the shared list.');
      return;
    }

    const name = restaurantName.trim();
    if (!name) return;

    const exists = displayedManualRestaurants.some(
      (restaurant) => restaurant.name.toLowerCase() === name.toLowerCase()
    );

    if (exists) {
      setManualInput('');
      return;
    }

    const nextRestaurants = [...displayedManualRestaurants, createManualRestaurant(name)];
    setDisplayedManualRestaurants(nextRestaurants);
    syncGroupListFromRestaurants(nextRestaurants);
    trackEvent('manual_restaurant_added', { name });
    setManualInput('');
    setManualSpinResult(null);
    setManualWheelKey((prev) => prev + 1);
  }, [displayedManualRestaurants, isManualListReadOnly, setDisplayedManualRestaurants, syncGroupListFromRestaurants]);

  const handleAddFavouriteToManualList = useCallback((name: string) => {
    addManualRestaurantByName(name);
    toast.success(`${name} added to spin list!`);
  }, [addManualRestaurantByName]);

  const handleFeedbackRate = useCallback((rating: 'suggest' | 'neutral' | 'avoid') => {
    if (!feedbackPending) return;
    trackEvent('feedback_given', { rating, restaurant_name: feedbackPending.restaurantName });
    void updateFavouriteRating(feedbackPending.favouriteId, rating);
    dismissFeedback();
    if (rating === 'suggest') {
      toast.success(`Great! We'll suggest ${feedbackPending.restaurantName} when you're nearby.`);
    } else if (rating === 'avoid') {
      toast(`${feedbackPending.restaurantName} won't be suggested again.`);
    }
  }, [dismissFeedback, feedbackPending, updateFavouriteRating]);

  const handleFeedbackDidntGo = useCallback(() => {
    if (!feedbackPending) return;
    trackEvent('feedback_didnt_go', { restaurant_name: feedbackPending.restaurantName });
    dismissFeedback();
  }, [dismissFeedback, feedbackPending]);

  // Handle spin attempt
  const handleSpinAttempt = () => {
    if (!canSpin(currentMealTime)) {
      trackEvent('spin_blocked', { mode: activeTab });
      setShowSpinLimitWarning(true);
      return false;
    }
    trackEvent('spin_start', { mode: activeTab, restaurant_count: activeTab === 'auto' ? wheelRestaurants.length : displayedManualRestaurants.length });
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

  const handleAutoRangeModeChange = (nextMode: AutoRangeMode) => {
    if (nextMode === rangeMode) return;
    trackEvent('range_mode_changed', { mode: nextMode });
    setRangeMode(nextMode);
    setShowAllRoundRestaurants(false);
    resetAutoWheel();
  };

  // Shuffle wheel restaurants
  const shuffleWheel = () => {
    trackEvent('shuffle_wheel', { restaurant_count: roundRestaurants.length });
    const shuffled = [...roundRestaurants].sort(() => Math.random() - 0.5);
    const sliced = shuffled.slice(0, 12);
    const sortedByDistance = location
      ? [...sliced].sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
      : sliced;
    setWheelRestaurants(sortedByDistance);
  };

  const switchTab = (tab: SpinTab) => {
    trackEvent('tab_switched', { tab });
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

  const addManualRestaurant = () => {
    addManualRestaurantByName(manualInput);
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
    setDisplayedManualRestaurants(restaurants);
    syncGroupListFromRestaurants(restaurants);
    trackEvent('preset_loaded', { preset_name: preset.name, count: preset.restaurants.length });
    setManualSpinResult(null);
    setManualWheelKey((prev) => prev + 1);
  }, [buildRestaurantsFromNames, isManualListReadOnly, setDisplayedManualRestaurants, syncGroupListFromRestaurants]);

  const saveCurrentAsPreset = () => {
    const trimmedName = presetNameInput.trim();
    if (!trimmedName || displayedManualRestaurants.length === 0) return;

    const restaurantNames = displayedManualRestaurants.map((restaurant) => restaurant.name.trim()).filter(Boolean);
    const newPreset: ManualPreset = {
      id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmedName,
      restaurants: restaurantNames,
      mealTime: presetMealTimeInput,
      createdAt: Date.now(),
    };

    setManualPresets((prev) => [newPreset, ...prev]);
    trackEvent('preset_saved', { preset_name: trimmedName, meal_time: presetMealTimeInput ?? 'none', count: restaurantNames.length });
    toast.success(`Preset "${trimmedName}" saved!`, {
      description: `${restaurantNames.length} restaurants saved${presetMealTimeInput ? ` for ${presetMealTimeTimeToLabel(presetMealTimeInput)}` : ''}`,
    });
    setPresetNameInput('');
    setPresetMealTimeInput(null);
  };

  const deletePreset = (presetId: string) => {
    trackEvent('preset_deleted');
    setManualPresets((prev) => prev.filter((preset) => preset.id !== presetId));
  };

  const removeManualRestaurant = (id: string) => {
    if (isManualListReadOnly) {
      toast.info('Only the host or co-host can edit the shared list.');
      return;
    }

    const nextRestaurants = displayedManualRestaurants.filter((restaurant) => restaurant.id !== id);
    const removed = displayedManualRestaurants.find((r) => r.id === id);
    if (removed) trackEvent('manual_restaurant_removed', { name: removed.name });
    setDisplayedManualRestaurants(nextRestaurants);
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
    setDisplayedManualRestaurants([]);
    syncGroupListFromRestaurants([]);
    setManualSpinResult(null);
    setManualWheelKey((prev) => prev + 1);
  };

  const manualHelperText = useMemo(() => {
    if (isGroupRoomActive && !canEditGroupList) return 'Waiting for host or co-host to update list and start the spin';
    if (isGroupRoomActive && isGroupHost) return 'Host mode: your list changes sync to everyone in the room';
    if (isGroupRoomActive && isGroupCohost) return 'Co-host mode: your list changes sync to everyone in the room';
    if (displayedManualRestaurants.length === 0) return 'Add restaurants to start';
    if (displayedManualRestaurants.length === 1) return 'Add at least 2 restaurants to spin';
    return undefined;
  }, [canEditGroupList, displayedManualRestaurants.length, isGroupCohost, isGroupHost, isGroupRoomActive]);

  const groupSpinDisplay = useMemo(() => {
    if (!isGroupRoomActive || !groupCurrentSpin) return null;

    const ageMs = Math.max(0, groupSpinNow - groupCurrentSpin.startedAt);
    return {
      winnerName: groupCurrentSpin.winnerName,
      startedAt: groupCurrentSpin.startedAt,
      ageMs,
      shouldReplay: ageMs <= GROUP_SPIN_REPLAY_WINDOW_MS,
      relativeText: formatRelativeSpinTime(ageMs),
      absoluteText: formatAbsoluteSpinTime(groupCurrentSpin.startedAt),
    };
  }, [groupCurrentSpin, groupSpinNow, isGroupRoomActive]);

  const shuffleManualRestaurants = useCallback(() => {
    if (isManualListReadOnly) return;
    const shuffledRestaurants = [...displayedManualRestaurants].sort(() => Math.random() - 0.5);
    setDisplayedManualRestaurants(shuffledRestaurants);
    syncGroupListFromRestaurants(shuffledRestaurants);
    setManualSpinResult(null);
    setManualWheelKey((prev) => prev + 1);
  }, [displayedManualRestaurants, isManualListReadOnly, setDisplayedManualRestaurants, syncGroupListFromRestaurants]);

  const manualExternalSpin = useMemo(() => {
    if (!isGroupRoomActive || !groupCurrentSpin || !groupSpinDisplay?.shouldReplay) return null;

    const normalizedWinner = groupCurrentSpin.winnerName.trim().toLowerCase();
    const winnerIndexFromName = displayedManualRestaurants.findIndex(
      (restaurant) => restaurant.name.trim().toLowerCase() === normalizedWinner,
    );

    return {
      spinId: groupCurrentSpin.spinId,
      winnerIndex: winnerIndexFromName >= 0 ? winnerIndexFromName : groupCurrentSpin.winnerIndex,
    };
  }, [displayedManualRestaurants, groupCurrentSpin, groupSpinDisplay?.shouldReplay, isGroupRoomActive]);

  useEffect(() => {
    if (!isGroupRoomActive || !groupCurrentSpin) return;

    const intervalId = window.setInterval(() => {
      setGroupSpinNow(Date.now());
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [groupCurrentSpin, isGroupRoomActive]);

  const handleRequestGroupSpin = useCallback(async () => {
    if (!isGroupRoomActive) return;
    if (!isGroupHost && !isGroupCohost) {
      toast.info('Only the room host or a co-host can start the spin.');
      return;
    }

    if (displayedManualRestaurantNames.length < 2) {
      toast.info('Add at least 2 restaurants before spinning.');
      return;
    }

    const spinResult = await requestHostSpin(displayedManualRestaurantNames);
    if (!spinResult) return;
    trackEvent('group_spin_requested', { room_id: groupRoomId, restaurant_count: displayedManualRestaurantNames.length });
    toast.success(`Room spin started: ${spinResult.winnerName}`);
  }, [displayedManualRestaurantNames, groupRoomId, isGroupCohost, isGroupRoomActive, isGroupHost, requestHostSpin]);

  const handleCreateGroupRoom = useCallback(async () => {
    trackEvent('group_room_created');
    setActiveTab('manual');
    setIsManualRoomLeavePending(false);
    setRoomManualRestaurants([]);
    await createGroupRoom();
  }, [createGroupRoom]);

  const handleJoinGroupRoom = useCallback(async (value: string) => {
    trackEvent('group_room_joined', { room_id: value });
    setActiveTab('manual');
    setIsManualRoomLeavePending(false);
    setRoomManualRestaurants([]);
    await joinGroupRoom(value);
  }, [joinGroupRoom]);

  const handleLeaveGroupRoom = useCallback(async () => {
    trackEvent('group_room_left', { room_id: groupRoomId });
    setIsManualRoomLeavePending(true);
    setRoomManualRestaurants([]);
    try {
      await leaveGroupRoom();
    } finally {
      setIsManualRoomLeavePending(false);
    }
  }, [groupRoomId, leaveGroupRoom]);

  useEffect(() => {
    if (!isGroupRoomActive || !canEditGroupList || !groupRoomId) return;
    if (seededRoomSyncIdRef.current === groupRoomId) return;

    seededRoomSyncIdRef.current = groupRoomId;
    const normalizedRemoteNames = normalizeManualNames(groupRoomListNames);
    if (normalizedRemoteNames.length > 0 || personalManualRestaurantNames.length === 0) return;

    const signature = JSON.stringify(personalManualRestaurantNames);
    pendingRoomListSyncRef.current = {
      roomId: groupRoomId,
      signature,
      startedAt: Date.now(),
    };
    void syncHostList(personalManualRestaurantNames);
  }, [canEditGroupList, groupRoomId, groupRoomListNames, isGroupRoomActive, personalManualRestaurantNames, syncHostList]);

  useEffect(() => {
    if (!isGroupRoomActive) {
      seededRoomSyncIdRef.current = '';
      pendingRoomListSyncRef.current = null;
      return;
    }

    const normalizedRemoteNames = normalizeManualNames(groupRoomListNames);
    const remoteSignature = JSON.stringify(normalizedRemoteNames);
    const localSignature = JSON.stringify(roomManualRestaurantNames);

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
      && personalManualRestaurantNames.length > 0
    ) {
      return;
    }

    const syncedRestaurants = buildRestaurantsFromNames(normalizedRemoteNames);
    const timeoutId = window.setTimeout(() => {
      setRoomManualRestaurants(syncedRestaurants);
      setManualSpinResult(null);
      setManualWheelKey((prev) => prev + 1);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [buildRestaurantsFromNames, canEditGroupList, groupRoomId, groupRoomListNames, isGroupRoomActive, personalManualRestaurantNames, roomManualRestaurantNames]);


  useEffect(() => {
    window.localStorage.setItem(MANUAL_RESTAURANTS_STORAGE_KEY, JSON.stringify(personalManualRestaurants));
  }, [personalManualRestaurants]);

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
    <div className="min-h-screen overflow-x-clip bg-brand-linen">
      <Navbar
        activeRoomId={groupRoomId}
      />

      <Hero
        onGetStarted={handleHeroGetStarted}
        onGroupSpin={() => { trackEvent('hero_group_spin'); scrollToSection('group-spin'); }}
      />

      <section id="app" className="py-8 sm:py-10 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-3 sm:mb-4">
            <h2 className="font-heading text-2xl sm:text-4xl font-bold text-brand-black mb-1.5 sm:mb-2">
              Pick a mode and spin faster.
            </h2>
            <p className="text-sm sm:text-base text-eatspin-gray-1 max-w-md mx-auto">
              Auto suggests nearby places. Manual spins your own shortlist.
            </p>
          </div>

          <div className="mb-2.5 sm:mb-3 flex justify-center">
            <MealTimeIndicator />
          </div>

          <div className="mb-4 sm:mb-5 flex justify-center">
            <div className="inline-flex items-center justify-center p-1 bg-brand-black rounded-2xl border-2 border-brand-black shadow-lg">
              <button
                type="button"
                onClick={() => switchTab('auto')}
                className={`min-h-11 px-5 py-2.5 rounded-xl text-[0.95rem] font-heading font-bold transition-all duration-200 ${
                  activeTab === 'auto'
                    ? 'bg-brand-orange text-white shadow-lg ring-2 ring-white/80'
                    : 'bg-white text-brand-black hover:bg-eatspin-peach/30'
                }`}
              >
                <span className={`inline-flex items-center gap-2 ${activeTab === 'auto' ? 'font-extrabold' : ''}`}><Sparkles size={18} className={activeTab === 'auto' ? 'scale-105' : ''} />Spin for me</span>
                {activeTab === 'auto' && <span className="block text-[11px] font-medium text-white/90">Smart nearby picks</span>}
              </button>
              <button
                type="button"
                onClick={() => switchTab('manual')}
                className={`min-h-11 px-5 py-2.5 rounded-xl text-[0.95rem] font-heading font-bold transition-all duration-200 ${
                  activeTab === 'manual'
                    ? 'bg-brand-orange text-white shadow-lg ring-2 ring-white/80'
                    : 'bg-white text-brand-black hover:bg-eatspin-peach/30'
                }`}
              >
                <span className={`inline-flex items-center gap-2 ${activeTab === 'manual' ? 'font-extrabold' : ''}`}><PencilLine size={18} className={activeTab === 'manual' ? 'scale-105' : ''} />I know where</span>
                {activeTab === 'manual' && <span className="block text-[11px] font-medium text-white/90">Add your own shortlist</span>}
              </button>
            </div>
          </div>

          {showPwaInstallBanner && isPwaPromptReady && (
            <div className="mb-6 rounded-2xl border border-brand-orange/40 bg-brand-linen px-4 py-3 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-heading text-base font-bold text-brand-black">Install EatSpin for faster lunch decisions</p>
                  <p className="text-sm text-eatspin-gray-1">
                    You have spun {spins.length} times. Add EatSpin to your home screen for one-tap access.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    className="bg-brand-orange text-white hover:bg-brand-orange/90"
                    onClick={() => { void handlePwaInstall(); }}
                  >
                    Install App
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-brand-orange/50 text-brand-black hover:bg-brand-linen"
                    onClick={handleDismissPwaBanner}
                  >
                    Later
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="mb-6 rounded-2xl border border-eatspin-peach/60 bg-brand-linen/70 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-heading text-lg font-bold text-brand-black">My Spins</h3>
                <p className="text-sm text-eatspin-gray-1">Your personal stats and recent spin timeline.</p>
              </div>
              {spinHistorySummary.totalSpins > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  className="border-brand-orange/40 text-brand-orange hover:bg-brand-orange/10"
                  onClick={() => { void handleShareSpinWrapped(); }}
                >
                  Share Wrapped
                </Button>
              )}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              <div className="rounded-xl bg-white px-3 py-2">
                <p className="text-xs text-eatspin-gray-1">Total spins</p>
                <p className="font-heading text-xl font-bold text-brand-black">{spinHistorySummary.totalSpins}</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-2">
                <p className="text-xs text-eatspin-gray-1">Unique places</p>
                <p className="font-heading text-xl font-bold text-brand-black">{spinHistorySummary.uniqueRestaurants}</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-2">
                <p className="text-xs text-eatspin-gray-1">Current streak</p>
                <p className="font-heading text-xl font-bold text-brand-black">{spinHistorySummary.currentStreak} day{spinHistorySummary.currentStreak === 1 ? '' : 's'}</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-2">
                <p className="text-xs text-eatspin-gray-1">Top category</p>
                <p className="font-heading text-xl font-bold text-brand-black">{spinHistorySummary.topCategory ?? 'N/A'}</p>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-eatspin-peach/50 bg-white">
              <div className="flex items-center justify-between px-3 py-2 text-xs text-eatspin-gray-1">
                <span>This month: <strong className="text-brand-black">{spinHistorySummary.spinsThisMonth}</strong></span>
                <span>Recent {spinHistorySummary.recentSpins.length}</span>
              </div>
              <ul className="max-h-56 divide-y divide-eatspin-peach/30 overflow-y-auto px-3 pb-2">
                {spinHistorySummary.recentSpins.length === 0 && (
                  <li className="py-3 text-sm text-eatspin-gray-1">No spins yet. Spin now to build your history.</li>
                )}
                {spinHistorySummary.recentSpins.map((spin, index) => (
                  <li key={`${spin.restaurant.id}-${index}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-brand-black">{spin.restaurant.name}</p>
                      <p className="text-xs text-eatspin-gray-1">
                        {spin.mealTime !== 'none' ? `${spin.mealTime} • ` : ''}
                        {spin.restaurant.category?.[0] ?? 'uncategorized'}
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-xs text-eatspin-gray-1">{formatSpinTimestamp(spin.timestamp)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {APP_FEATURES.spinChallenge && (
            <div className="mb-6 rounded-2xl border border-brand-orange/35 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-heading text-lg font-bold text-brand-black">7-Day Challenge a Friend</h3>
                <p className="text-sm text-eatspin-gray-1">Challenge friends to spin daily and compare streak progress.</p>
              </div>
              {challengeId && (
                <span className="rounded-full bg-brand-orange/10 px-3 py-1 text-xs font-semibold text-brand-orange">
                  Challenge {challengeId}
                </span>
              )}
            </div>

            {challengeError && (
              <p className="mt-2 text-sm text-eatspin-error">{challengeError}</p>
            )}

            {!challengeId ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-[auto_1fr_auto]">
                <Button
                  type="button"
                  className="bg-brand-orange text-white hover:bg-brand-orange/90"
                  disabled={challengeBusy}
                  onClick={handleCreateChallenge}
                >
                  {challengeBusy ? 'Working...' : 'Create 7-day challenge'}
                </Button>
                <Input
                  value={challengeJoinInput}
                  onChange={(event) => setChallengeJoinInput(event.target.value)}
                  placeholder="Paste challenge link or code"
                  className="h-11"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="border-brand-orange/40 text-brand-black hover:bg-brand-linen"
                  disabled={challengeBusy || !challengeJoinInput.trim()}
                  onClick={handleJoinChallenge}
                >
                  Join
                </Button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-brand-orange/40 text-brand-orange hover:bg-brand-orange/10"
                    onClick={() => { void handleCopyChallengeLink(); }}
                  >
                    Copy invite link
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-gray-300 text-gray-700 hover:bg-gray-100"
                    onClick={handleLeaveChallenge}
                  >
                    Leave challenge
                  </Button>
                  {challengeMeta && (
                    <span className="text-xs text-eatspin-gray-1">
                      Ends in {Math.max(0, Math.ceil((challengeMeta.endsAt - uiNowMs) / (24 * 60 * 60 * 1000)))} day(s)
                    </span>
                  )}
                </div>

                <div className="rounded-xl border border-eatspin-peach/50 bg-brand-linen/60 px-3 py-2">
                  <p className="text-xs text-eatspin-gray-1">
                    Your completed days: <strong className="text-brand-black">{myChallengeParticipant?.completedDayKeys.length ?? 0}</strong>/7
                  </p>
                </div>

                <ul className="space-y-2">
                  {challengeLeaderboard.map((participant) => (
                    <li
                      key={participant.uid}
                      className="flex items-center justify-between rounded-lg border border-eatspin-peach/50 bg-brand-linen px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-brand-black">
                        {participant.name} {participant.uid === groupAuthUid ? '(You)' : ''}
                      </span>
                      <span className="text-eatspin-gray-1">{participant.completedDayKeys.length}/7 days</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            </div>
          )}

          {APP_FEATURES.discoverFeed && (
            <div className="mb-6 rounded-2xl border border-eatspin-peach/60 bg-brand-linen/70 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-heading text-lg font-bold text-brand-black">Discover Feed</h3>
                <p className="text-sm text-eatspin-gray-1">See what others nearby are spinning right now.</p>
              </div>
              {discoverGeoKey && (
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-eatspin-gray-1">
                  Area: {discoverGeoKey}
                </span>
              )}
            </div>

            {discoverFeedError && (
              <p className="mt-2 text-xs text-eatspin-error">{discoverFeedError}</p>
            )}

            <ul className="mt-3 space-y-2">
              {discoverEvents.length === 0 && (
                <li className="rounded-lg bg-white px-3 py-2 text-sm text-eatspin-gray-1">
                  No nearby spins yet. Your next spin can kick off the feed.
                </li>
              )}
              {discoverEvents.map((event) => (
                <li key={event.id} className="rounded-lg bg-white px-3 py-2 text-sm">
                  <p className="font-medium text-brand-black">
                    Someone nearby spun {event.restaurantName}
                    {event.mealTime !== 'none' ? ` • ${event.mealTime}` : ''}
                  </p>
                  <p className="text-xs text-eatspin-gray-1">{formatSpinTimestamp(event.createdAt)}</p>
                </li>
              ))}
            </ul>
            </div>
          )}

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

                  {(autoDataSourceLabel || nearbyRestaurantsError) && (
                    <div className="mb-3 space-y-1">
                      {autoDataSourceLabel && (
                        <p className="text-xs font-medium text-eatspin-gray-1">{autoDataSourceLabel}</p>
                      )}
                      {nearbyRestaurantsError && (
                        <p className="text-xs text-eatspin-error">{nearbyRestaurantsError}</p>
                      )}
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Search range: <span className="font-bold text-brand-orange">{AUTO_RANGE_LABEL[rangeMode]}</span>
                    </label>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {AUTO_RANGE_OPTIONS.map((option) => {
                        const isSelected = rangeMode === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => handleAutoRangeModeChange(option.id)}
                            className={`rounded-xl px-3 py-2 text-left transition-all duration-200 ${
                              isSelected
                                ? 'bg-brand-orange text-white shadow-md'
                                : 'border border-gray-200 bg-white text-brand-black hover:border-brand-orange hover:text-brand-orange'
                            }`}
                          >
                            <span className="block text-sm font-semibold">{option.label}</span>
                            <span className={`block text-xs ${isSelected ? 'text-white/90' : 'text-eatspin-gray-1'}`}>
                              {option.helper}
                            </span>
                          </button>
                        );
                      })}
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
                  </div>

                  {selectedPriceRanges.length > 0 && (
                    <p className="mb-2 text-xs text-eatspin-gray-1">
                      Some places may not appear if Google hasn't mapped their price tier.
                    </p>
                  )}

                  {filterResult.expanded && filterResult.expandedLabel && (
                    <p className="mb-2 text-xs text-eatspin-gray-1">{filterResult.expandedLabel}</p>
                  )}

                  {autoAvailabilityHelperText && (
                    <p className="mb-2 text-xs text-eatspin-gray-1">{autoAvailabilityHelperText}</p>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsMoreFiltersOpen((prev) => !prev)}
                    className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-black hover:text-brand-orange"
                    aria-expanded={isMoreFiltersOpen}
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
                        onCategoryChange={handleCategoryChange}
                        maxSelection={3}
                      />
                    </div>
                  </div>
                </div>
              )}

              {location && filteredRestaurants.length === 0 && !nearbyRestaurantsLoading && autoSourceRestaurants.length > 0 && (
                <div className="mb-5 rounded-2xl border border-eatspin-peach/60 bg-white p-4 text-center">
                  <p className="text-sm font-medium text-brand-black">
                    {closingSoonExcludedCount > 0 || closedNowExcludedCount > 0
                      ? 'No open spots left for the wheel right now.'
                      : 'No matches — try clearing a filter.'}
                  </p>
                  <p className="mt-1 text-xs text-eatspin-gray-1">
                    {autoEmptyStateSubtitle}
                  </p>
                  {selectedPriceRanges.length > 0 && (
                    <p className="mt-1 text-xs text-eatspin-gray-1">
                      Price filter is active.
                    </p>
                  )}
                </div>
              )}

              {location && roundRestaurants.length > 0 && (
                <div className="mb-5 flex flex-col sm:flex-row gap-3 justify-center">
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
                    className="w-full sm:w-auto bg-brand-orange hover:bg-brand-orange/90 text-white font-heading text-base sm:text-lg font-bold px-6 sm:px-8 py-4 sm:py-5 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 disabled:opacity-70"
                  >
                    <Utensils size={20} className="mr-2" />
                    Spin for {currentMealTime !== 'none' ? currentMealTime : 'Food'}
                  </Button>

                  <Button
                    onClick={resetAutoWheel}
                    variant="outline"
                    className="w-full sm:w-auto border-eatspin-orange text-eatspin-orange hover:bg-eatspin-orange/10 font-medium px-6 py-4 sm:py-5 rounded-2xl"
                  >
                    <RotateCcw size={18} className="mr-2" />
                    Reset Wheel
                  </Button>
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
                      {displayedRoundRestaurants.map((restaurant) => (
                        <li key={restaurant.id} className="flex items-center justify-between gap-3 rounded-xl bg-brand-linen px-3 py-2">
                          <div>
                            <p className="font-medium text-brand-black">
                              {restaurant.name}
                              {isFavouriteCheck(restaurant) && (
                                <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-pink-100 px-1.5 py-0.5 text-[10px] font-semibold text-pink-600 align-middle">
                                  <Heart size={10} className="fill-pink-500 text-pink-500" /> Fave
                                </span>
                              )}
                            </p>
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
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isFavouriteCheck(restaurant) ? (
                              <span
                                className="inline-flex items-center gap-1 rounded-full bg-pink-50 border border-pink-200 px-2.5 py-1 text-xs font-medium text-pink-500"
                                title="Already in My Favourites"
                              >
                                <Heart size={12} className="fill-pink-500 text-pink-500" /> Saved
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSaveFavourite(restaurant, 'auto')}
                                className="inline-flex items-center gap-1 rounded-full border border-pink-200 bg-white px-2.5 py-1 text-xs font-medium text-pink-500 hover:bg-pink-50"
                                aria-label={`Save ${restaurant.name} to favourites`}
                              >
                                <Heart size={12} /> Save
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeRestaurantForRound(restaurant.id)}
                              className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
                              aria-label={`Remove ${restaurant.name} for this round`}
                            >
                              <X size={14} /> Remove
                            </button>
                          </div>
                        </li>
                      ))}

                      </ul>
                      {roundRestaurants.length > REVIEW_PREVIEW_COUNT && (
                        <div className="mt-3 flex justify-center">
                          <button
                            type="button"
                            onClick={() => setShowAllRoundRestaurants((prev) => !prev)}
                            className="rounded-full border border-eatspin-peach/80 bg-white px-3 py-1.5 text-xs font-medium text-eatspin-gray-1 hover:bg-brand-linen"
                          >
                            {showAllRoundRestaurants
                              ? `Show first ${REVIEW_PREVIEW_COUNT}`
                              : `Show all ${roundRestaurants.length}`}
                          </button>
                        </div>
                      )}
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
            <div id="wheel" className="py-4 pb-14 sm:pb-8">
              {isGroupRoomActive && (
                <div className="mb-4 rounded-xl border border-brand-orange/30 bg-brand-linen px-4 py-3 text-sm text-eatspin-gray-1">
                  <p className="font-semibold text-brand-black">
                    Room {groupRoomId} {isGroupHost ? '(Host)' : isGroupCohost ? '(Co-host)' : '(Participant)'}
                  </p>
                  <p>
                    {isGroupHost
                      ? 'Your list edits sync to everyone in this room.'
                      : isGroupCohost
                        ? 'You can edit the shared list as co-host and start spins for everyone.'
                        : "You are viewing the room's shared list. Leave the room anytime to return to your saved personal list."}
                  </p>
                  <p className="mt-1 text-xs text-brand-black/80">
                    {groupSpinDisplay
                      ? `Last spin: ${groupSpinDisplay.relativeText} (${groupSpinDisplay.absoluteText})`
                      : 'No spin yet.'}
                  </p>
                  {groupSpinDisplay && groupSpinDisplay.ageMs >= LATE_JOIN_NOTICE_MS && (
                    <p className="mt-1 text-xs font-medium text-brand-black/80">Result was decided earlier.</p>
                  )}

                  {!canEditGroupList && (
                    <button
                      type="button"
                      onClick={() => {
                        void handleLeaveGroupRoom();
                      }}
                      className="mt-2 inline-flex items-center rounded-full border border-brand-orange/40 bg-white px-3 py-1.5 text-xs font-semibold text-brand-black hover:bg-brand-linen"
                    >
                      Leave room to spin on your own
                    </button>
                  )}
                </div>
              )}
              {/* <div className="text-center mb-5">
                <h3 className="font-heading text-2xl font-bold text-brand-black mb-2">I know where</h3>
                <p className="text-sm text-eatspin-gray-1">Add any restaurants you like and spin.</p>
              </div> */}

              <RouletteWheel
                key={isGroupRoomActive ? `manual-room-${groupRoomId || 'none'}` : `manual-${manualWheelKey}-${displayedManualRestaurants.length}`}
                restaurants={displayedManualRestaurants}
                totalCount={displayedManualRestaurants.length}
                onSpinComplete={handleManualSpinComplete}
                isSpinning={isSpinning}
                setIsSpinning={setIsSpinning}
                onShuffle={() => {
                  shuffleManualRestaurants();
                }}
                canSpin={displayedManualRestaurants.length >= 2 && (!isGroupRoomActive || isGroupHost || isGroupCohost)}
                helperText={manualHelperText}
                spinButtonLabel={isGroupRoomActive
                  ? (isGroupHost || isGroupCohost ? 'Spin for everyone' : 'Waiting for host or co-host spin')
                  : 'Spin the Wheel!'}
                externalSpin={manualExternalSpin}
                onRequestSpin={isGroupRoomActive ? handleRequestGroupSpin : undefined}
                canRequestSpin={!isGroupRoomActive || isGroupHost || isGroupCohost}
                emptyStateTitle="Add restaurants to start"
                emptyStateSubtitle="Type any restaurant you like…"
                onSaveFavourite={(r) => handleSaveFavourite(r, 'manual')}
                onLetsGo={handleLetsGo}
                onShareResult={handleShareResult}
                isFavourite={isFavouriteCheck}
              />

                {/* Nearby Favourites Section */}
                {nearbyFavourites.length > 0 && (
                  <div className="mt-6 max-w-xl mx-auto">
                    <div className="bg-white rounded-xl border border-green-200/60 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-2 w-2 rounded-full bg-eatspin-success animate-pulse" />
                        <h4 className="font-heading font-semibold text-brand-black flex items-center gap-2">
                          <MapPin size={16} className="text-eatspin-success" />
                          Nearby Favourites
                        </h4>
                      </div>
                      <p className="text-xs text-eatspin-gray-1 mb-3">
                        You're close to places you've saved before!
                      </p>
                      <ul className="space-y-2">
                        {nearbyFavourites.map((nf) => {
                          const alreadyInList = displayedManualRestaurants.some(
                            (r) => r.name.toLowerCase() === nf.restaurantName.toLowerCase()
                          );
                          return (
                            <li key={nf.favouriteId} className="flex items-center justify-between gap-2 rounded-lg bg-green-50 px-3 py-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-brand-black truncate">{nf.restaurantName}</p>
                                <p className="text-xs text-eatspin-gray-1">{nf.distanceKm.toFixed(1)} km away</p>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {!alreadyInList && !isManualListReadOnly && (
                                  <button
                                    type="button"
                                    onClick={() => handleAddFavouriteToManualList(nf.restaurantName)}
                                    className="inline-flex items-center gap-1 rounded-full border border-brand-orange/40 bg-white px-2.5 py-1 text-xs font-medium text-brand-orange hover:bg-brand-orange/10"
                                    aria-label={`Add ${nf.restaurantName} to spin list`}
                                  >
                                    <Plus size={12} /> Add
                                  </button>
                                )}
                                {alreadyInList && (
                                  <span className="text-xs text-eatspin-success font-medium">In list ✓</span>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                )}

                {/* My Favourites Section */}
                {favourites.length > 0 && (
                  <div className="mt-6 max-w-xl mx-auto">
                    <div className="bg-white rounded-xl border border-pink-200/60 p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-heading font-semibold text-brand-black flex items-center gap-2">
                          <Heart size={16} className="text-pink-500 fill-pink-500" />
                          My Favourites ({favourites.length})
                        </h4>
                      </div>
                      <p className="text-xs text-eatspin-gray-1 mb-3">
                        Places you saved from spinning. Tap <Plus size={12} className="inline" /> to add to your current spin list.
                      </p>
                      <ul className="space-y-2 max-h-64 overflow-y-auto overscroll-contain pr-1">
                        {favourites
                          .filter((f) => f.userRating !== 'avoid')
                          .map((fav) => {
                            const alreadyInList = displayedManualRestaurants.some(
                              (r) => r.name.toLowerCase() === fav.restaurant.name.toLowerCase()
                            );
                            return (
                              <li key={fav.id} className="flex items-center justify-between gap-2 rounded-lg bg-brand-linen px-3 py-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-brand-black truncate">{fav.restaurant.name}</p>
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {fav.restaurant.rating > 0 && (
                                      <span className="text-xs text-eatspin-gray-1">⭐ {fav.restaurant.rating}</span>
                                    )}
                                    {fav.visitCount > 0 && (
                                      <span className="text-xs text-eatspin-gray-1">
                                        · Visited {fav.visitCount}×
                                      </span>
                                    )}
                                    {fav.userRating === 'neutral' && (
                                      <span className="text-xs text-eatspin-gray-2">· Neutral</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {!alreadyInList && !isManualListReadOnly && (
                                    <button
                                      type="button"
                                      onClick={() => handleAddFavouriteToManualList(fav.restaurant.name)}
                                      className="inline-flex items-center gap-1 rounded-full border border-brand-orange/40 bg-white px-2.5 py-1 text-xs font-medium text-brand-orange hover:bg-brand-orange/10"
                                      aria-label={`Add ${fav.restaurant.name} to spin list`}
                                    >
                                      <Plus size={12} /> Add
                                    </button>
                                  )}
                                  {alreadyInList && (
                                    <span className="text-xs text-eatspin-success font-medium">In list ✓</span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFavourite(fav.id, fav.restaurant.name)}
                                    className="text-eatspin-gray-2 hover:text-red-500"
                                    aria-label={`Remove ${fav.restaurant.name} from favourites`}
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                      </ul>
                      {favourites.some((f) => f.userRating === 'avoid') && (
                        <p className="mt-2 text-xs text-eatspin-gray-2">
                          {favourites.filter((f) => f.userRating === 'avoid').length} hidden (marked "don't suggest")
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div id="manual-input" className="mt-8 max-w-xl mx-auto">
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
                    <h4 className="font-heading font-semibold text-brand-black">Restaurant list ({displayedManualRestaurants.length})</h4>
                    {displayedManualRestaurants.length > 0 && (
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

                  {displayedManualRestaurants.length === 0 ? (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-eatspin-gray-1">Add at least 2 places to spin.</p>
                      {!isManualListReadOnly && (
                        <div className="flex flex-wrap gap-2">
                          {MANUAL_SUGGESTED_RESTAURANTS.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => {
                                addManualRestaurantByName(suggestion);
                              }}
                              className="inline-flex items-center gap-1 rounded-full border border-eatspin-peach/80 bg-brand-linen px-3 py-1.5 text-xs font-medium text-brand-black hover:border-brand-orange hover:text-brand-orange"
                            >
                              <CheckCircle2 size={12} /> {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {displayedManualRestaurants.map((restaurant) => (
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

                {!isManualListReadOnly && (
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
                        disabled={displayedManualRestaurants.length === 0 || !presetNameInput.trim()}
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
                )}

                </div>
            </div>
          )}
        </div>
      </section>

      {activeTab === 'auto' && showWheelSection && location && roundRestaurants.length > 0 && (
        <section id="wheel" className="py-10 sm:py-12 px-4 sm:px-6 lg:px-8 bg-brand-linen">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-5 sm:mb-6">
              <h2 className="font-heading text-xl sm:text-2xl font-bold text-brand-black mb-1.5">
                Spin the Wheel!
              </h2>
              <p className="text-sm sm:text-base text-eatspin-gray-1">
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
              onSaveFavourite={(r) => handleSaveFavourite(r, 'auto')}
              onLetsGo={handleLetsGo}
              onShareResult={handleShareResult}
              onSpinAgain={handleAutoSpinAgain}
              canSpinAgain={wheelRestaurants.length > 2}
              isFavourite={isFavouriteCheck}
              helperText={autoAvailabilityHelperText || undefined}
              emptyStateTitle="No open restaurants ready to spin"
              emptyStateSubtitle={autoEmptyStateSubtitle}
            />
          </div>
        </section>
      )}


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
        reactions={groupReactions}
        votes={groupVotes}
        canStartRoomSpin={isGroupRoomActive && (isGroupHost || isGroupCohost) && displayedManualRestaurantNames.length >= 2}
        onCreateRoom={handleCreateGroupRoom}
        onJoinRoom={handleJoinGroupRoom}
        onLeaveRoom={handleLeaveGroupRoom}
        onStartRoomSpin={handleRequestGroupSpin}
        onSetParticipantCohost={setParticipantCohost}
        onSendReaction={sendGroupReaction}
        onSetGoingVote={setGroupGoingVote}
        onClearRoomError={clearGroupRoomError}
        showCompletedListReminder={isGroupRoomActive && !isGroupHost && !isGroupCohost && groupRoomStatus === 'completed' && Boolean(groupCurrentSpin)}
      />

      <HowItWorks />
      <Features />
      <Testimonials />
      <CTA />
      <Footer />

      <SubscriptionModal
        isOpen={showSubscription}
        onClose={() => setShowSubscription(false)}
        onSubscribe={handleSubscribe}
      />

      {feedbackPending && (
        <FeedbackPrompt
          restaurantName={feedbackPending.restaurantName}
          open={true}
          onRate={handleFeedbackRate}
          onDidntGo={handleFeedbackDidntGo}
        />
      )}

      <FirstRunOnboarding
        open={showOnboarding}
        onClose={dismissFirstRunOnboarding}
        onRequestLocation={requestLocation}
        onOpenAutoMode={handleOnboardingOpenAutoMode}
      />

      <Toaster />
    </div>
  );
}

export default App;
