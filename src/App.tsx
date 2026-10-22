import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import { trackEvent } from '@/lib/analytics';
import { APP_FEATURES } from '@/lib/featureFlags';
import { useLocation } from '@/hooks/useLocation';
import { useNearbyRestaurants } from '@/hooks/useNearbyRestaurants';
import { useTextSearch } from '@/hooks/useTextSearch';
import { useSpinTracker } from '@/hooks/useSpinTracker';
import { useFirebaseGroupRoom } from '@/hooks/useFirebaseGroupRoom';
import { usePwaInstallPrompt } from '@/hooks/usePwaInstallPrompt';
import { usePlacesBudget } from '@/hooks/usePlacesBudget';
import { useGame } from '@/hooks/useGame';
import { GameHud } from '@/components/GameHud';
import { QuestCard } from '@/components/QuestCard';
import { RarityBadge } from '@/components/RarityBadge';
import { getRarity, getRarityMultiplier, RARITY_LABEL, type Rarity } from '@/lib/rarity';
import { buildLetsGoReward, type LetsGoReward } from '@/lib/letsGoReward';
import { getMapsUrl } from '@/lib/maps';
import type { QuestEvent } from '@/lib/quests';
import { getMealTimeEmoji, getSuggestedManualListName, useManualLists } from '@/hooks/useManualLists';
import { useSpinChallenge } from '@/hooks/useSpinChallenge';
import { useDiscoverFeed } from '@/hooks/useDiscoverFeed';
import type { FoodCategory, ManualListMealTime, MealTime, Restaurant } from '@/types';
import { restaurants as localRestaurants } from '@/data/restaurants';
import {
  AUTO_SPIN_MINUTES_UNTIL_CLOSE_CUTOFF,
  enhancedFilterRestaurants,
  findNearbyFavourites,
} from '@/lib/restaurantUtils';
import { getCurrentMealTime } from '@/lib/utils';
import { RouletteWheel, type RouletteWheelHandle } from '@/components/RouletteWheel';
import { SpinScreen } from '@/components/SpinScreen';
import { RoundReview } from '@/components/RoundReview';
import { PwaInstallBanner } from '@/components/PwaInstallBanner';
import { SubscriptionModal } from '@/components/SubscriptionModal';
import { SpinLimitWarning } from '@/components/SpinLimitWarning';
import { BottomNav } from '@/components/BottomNav';
import { AboutEatSpin } from '@/sections/AboutEatSpin';
import { getInitialAppTab, getSpinMode, getTabAnalyticsName, type AppTab } from '@/lib/appTabs';
import type { FoodMood } from '@/lib/foodMoods';
import { SPIN_SCREEN_WHEEL_SIZE } from '@/lib/spinLayout';
import { applyServesFilters, SERVES_FILTERS, type ServesFilterId } from '@/lib/servesFilters';
import { getTimeOfDayFilters } from '@/lib/timeOfDayDefaults';
import { GroupSpin } from '@/sections/GroupSpin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Toaster } from '@/components/ui/sonner';
import { MapPin, PencilLine, Plus, X, Trash2, ChevronDown, CheckCircle2, Heart } from 'lucide-react';
import { useFavourites } from '@/hooks/useFavourites';
import { useFeedbackPrompt } from '@/hooks/useFeedbackPrompt';
import { enqueueFeedback } from '@/lib/feedbackStore';
import { deriveFavouriteId } from '@/types/favourites';
import { shareCard } from '@/lib/shareCard';
import { FeedbackPrompt } from '@/components/FeedbackPrompt';
import { FirstRunOnboarding } from '@/components/FirstRunOnboarding';
import SpinStatsPanel from '@/components/SpinStatsPanel';
import { toast } from 'sonner';
import './App.css';

type SpinTab = 'auto' | 'manual';
type AutoRangeMode = 'walk' | 'drive10' | 'drive20';

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
  walk: 0.85,
  drive10: 4.3,
  drive20: 8.5,
};

const isAutoRangeMode = (value: string): value is AutoRangeMode =>
  value === 'walk' || value === 'drive10' || value === 'drive20';

/** Estimate travel time from straight-line distance using road detour factor. */
const estimateTravelTime = (straightLineKm: number): string => {
  const roadKm = straightLineKm * 1.4;
  if (roadKm <= 1.2) {
    const minutes = Math.round((roadKm / 5) * 60);
    return `~${Math.max(1, minutes)} min walk`;
  }
  const minutes = Math.round((roadKm / 30) * 60);
  return `~${Math.max(1, minutes)} min drive`;
};

/** Switching tabs opens a new screen, so jump to its top. Re-tapping the active tab scrolls up smoothly. */
const scrollPageToTop = (smooth: boolean) => {
  if (typeof window === 'undefined') return;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: smooth && !prefersReducedMotion ? 'smooth' : 'instant' });
};

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

const getPreferredManualMealTime = (): ManualListMealTime => {
  const mealTime = getCurrentMealTime();
  return mealTime === 'none' ? null : mealTime;
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
  const respinCountRef = useRef(0);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showSpinLimitWarning, setShowSpinLimitWarning] = useState(false);
  const [currentMealTime, setCurrentMealTime] = useState<MealTime>('none');
  const [isPremium, setIsPremium] = useState(false);
  const wheelRef = useRef<RouletteWheelHandle>(null);
  const seededWheelKeyRef = useRef('');
  const [wheelRestaurants, setWheelRestaurants] = useState<Restaurant[]>([]);
  const [roundRemovedRestaurantIds, setRoundRemovedRestaurantIds] = useState<string[]>([]);
  const [pendingAutoRemovalId, setPendingAutoRemovalId] = useState<string | null>(null);
  const [appTab, setAppTab] = useState<AppTab>(() => (
    getInitialAppTab(typeof window === 'undefined' ? '' : window.location.search)
  ));
  // Spin runs on nearby places ('auto'); My list, Group and Me work from the manual or room list.
  const activeTab: SpinTab = getSpinMode(appTab);
  const [autoWheelKey, setAutoWheelKey] = useState(0);
  const [showAllRoundRestaurants, setShowAllRoundRestaurants] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !window.localStorage.getItem(FIRST_RUN_ONBOARDING_SEEN_KEY);
  });
  const [challengeJoinInput, setChallengeJoinInput] = useState('');
  const [uiNowMs, setUiNowMs] = useState(() => Date.now());
  const [, setSelectedMood] = useState<FoodMood | null>(null);
  const [activeServesFilters, setActiveServesFilters] = useState<ServesFilterId[]>(getTimeOfDayFilters);

  const [manualInput, setManualInput] = useState('');
  const {
    manualLists,
    selectedManualList,
    selectedManualListId,
    selectManualList,
    createNewManualList,
    updateSelectedManualList,
    deleteManualList,
    selectDeterministicManualList,
  } = useManualLists();
  const [roomManualRestaurants, setRoomManualRestaurants] = useState<Restaurant[]>([]);
  const [isManualRoomLeavePending, setIsManualRoomLeavePending] = useState(false);
  const [manualWheelKey, setManualWheelKey] = useState(0);
  const [, setManualSpinResult] = useState<Restaurant | null>(null);
  const [listNameInput, setListNameInput] = useState('');
  const [listMealTimeInput, setListMealTimeInput] = useState<ManualListMealTime>(() => getPreferredManualMealTime());
  const [isEditingListDetails, setIsEditingListDetails] = useState(false);
  const [isCreatingNewList, setIsCreatingNewList] = useState(false);
  const [groupSpinNow, setGroupSpinNow] = useState(() => Date.now());
  // Fetch radius follows the selected range mode so each mode gets its own
  // focused 20-place pool from Google. Cached separately per radius — repeat
  // visits cost nothing for 7 days.
  const fetchRadiusKm = AUTO_RANGE_RADIUS_KM[rangeMode];
  const autoLoadedMealTimeRef = useRef<ManualListMealTime>(null);
  const hasUserSelectedManualListRef = useRef(false);
  const seededRoomSyncIdRef = useRef('');
  const pendingRoomListSyncRef = useRef<{ roomId: string; signature: string; startedAt: number } | null>(null);

  const handleMoodSelect = useCallback((mood: FoodMood) => {
    setSelectedMood(mood);
    trackEvent('mood_selected', { mood });

    const moodToCategoriesMap: Record<FoodMood, FoodCategory[]> = {
      'quick-bite': ['street food', 'noodles', 'rice'],
      'treat-myself': ['western', 'japanese', 'korean'],
      'healthy': ['vegetarian', 'cafe'],
      'surprise-me': [],
    };

    const categories = moodToCategoriesMap[mood];
    setSelectedCategories(categories);

    if (mood === 'surprise-me') {
      setSelectedPriceRanges([]);
      setActiveServesFilters([]);
    }
  }, []);

  const handleToggleServesFilter = useCallback((id: ServesFilterId) => {
    setActiveServesFilters((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );
    trackEvent('serves_filter_toggle', { filter: id });
  }, []);

  // Custom hooks
  const { location, error: locationError, isLoading: locationLoading, requestLocation } = useLocation();
  const { spins, canSpin, recordSpin } = useSpinTracker();
  const placesBudget = usePlacesBudget();
  const game = useGame();
  const {
    favourites,
    isFavourite: isFavouriteCheck,
    getLastVisitedAt,
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

  const textSearch = useTextSearch({ location });

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

  const isGroupRoomActive = Boolean(groupRoomId);
  const shouldShowRoomManualRestaurants = isGroupRoomActive && !isManualRoomLeavePending;
  const selectedPersonalManualRestaurants = useMemo(
    () => selectedManualList?.restaurants ?? [],
    [selectedManualList],
  );
  const displayedManualRestaurants = useMemo(
    () => (shouldShowRoomManualRestaurants ? roomManualRestaurants : selectedPersonalManualRestaurants),
    [roomManualRestaurants, selectedPersonalManualRestaurants, shouldShowRoomManualRestaurants],
  );
  const personalManualRestaurantNames = useMemo(
    () => normalizeManualNames(selectedPersonalManualRestaurants.map((restaurant) => restaurant.name)),
    [selectedPersonalManualRestaurants],
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

  // Favourite category visit counts — used to boost popular categories in selector
  const favouriteCategoryCounts = useMemo(() => {
    const counts: Partial<Record<FoodCategory, number>> = {};
    for (const fav of favourites) {
      if (fav.userRating === 'avoid') continue;
      for (const cat of fav.restaurant.category) {
        counts[cat] = (counts[cat] ?? 0) + fav.visitCount;
      }
    }
    return counts;
  }, [favourites]);

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

  const filteredRestaurants = useMemo(
    () => applyServesFilters(filterResult.results, activeServesFilters),
    [filterResult.results, activeServesFilters],
  );
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
    // Check if serves-filters are the culprit
    if (activeServesFilters.length > 0 && filterResult.results.length > 0 && filteredRestaurants.length === 0) {
      const labels = activeServesFilters.map(
        (id) => SERVES_FILTERS.find((f) => f.id === id)?.label ?? id,
      );
      return `None of the nearby places match your ${labels.join(' + ')} filter${labels.length > 1 ? 's' : ''}. Try removing a filter pill.`;
    }

    if (closingSoonExcludedCount > 0 && filteredRestaurants.length === 0) {
      return `Everything nearby is either closed or shutting within ${AUTO_SPIN_MINUTES_UNTIL_CLOSE_CUTOFF} min. Try a wider range or check back soon.`;
    }

    if (closedNowExcludedCount > 0 && filteredRestaurants.length === 0) {
      return 'Everything matching your filters is closed right now. Try widening your filters or check back soon.';
    }

    return 'Try selecting different categories or check back during meal hours';
  }, [closedNowExcludedCount, closingSoonExcludedCount, filteredRestaurants.length, activeServesFilters, filterResult.results.length]);

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

  // Report an event to the daily quest and celebrate if it completes the quest.
  const { recordQuestEvent } = game;
  const reportQuestEvent = useCallback((event: QuestEvent) => {
    const result = recordQuestEvent(event);
    if (!result.completed || !result.quest) return;
    toast.success(`Quest complete: ${result.quest.title}`, {
      description: result.leveledUp
        ? `+${result.xp} XP. Level up! You are now level ${result.level}.`
        : `+${result.xp} XP`,
    });
  }, [recordQuestEvent]);

  // Handle spin complete
  const handleSpinComplete = useCallback((restaurant: Restaurant) => {
    trackEvent('spin_complete', { mode: 'auto', restaurant_name: restaurant.name, category: restaurant.category?.[0] ?? '' });
    recordSpin(restaurant, currentMealTime);
    void recordDailySpin();
    void publishDiscoverSpin(restaurant.name, currentMealTime);
    setPendingAutoRemovalId(restaurant.id);
    reportQuestEvent({ type: 'spin' });
  }, [currentMealTime, publishDiscoverSpin, recordDailySpin, recordSpin, reportQuestEvent]);

  const handleManualSpinComplete = useCallback((restaurant: Restaurant) => {
    trackEvent('spin_complete', { mode: 'manual', restaurant_name: restaurant.name });
    setManualSpinResult(restaurant);
    void recordDailySpin();
    void publishDiscoverSpin(restaurant.name, currentMealTime);
    reportQuestEvent({ type: 'spin' });
  }, [currentMealTime, publishDiscoverSpin, recordDailySpin, reportQuestEvent]);

  const handleSaveFavourite = useCallback((restaurant: Restaurant, mode: 'auto' | 'manual') => {
    trackEvent('favourite_saved', { restaurant_name: restaurant.name, mode });
    const isNewFavourite = !isFavouriteCheck(restaurant);
    void saveFavourite(restaurant, mode === 'auto' ? 'spin-auto' : 'spin-manual');
    toast.success(`${restaurant.name} saved to favourites!`, {
      description: 'Find it in the "I Know Where" tab under My Favourites.',
    });
    if (isNewFavourite) reportQuestEvent({ type: 'favourite-saved' });
  }, [isFavouriteCheck, reportQuestEvent, saveFavourite]);

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
    respinCountRef.current += 1;
    trackEvent('spin_again_requested', {
      restaurant_name: restaurant.name,
      round_size: wheelRestaurants.length,
      respin_count: respinCountRef.current,
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
      trackEvent('pwa_install_prompt_dismissed', { spin_count: spins.length });
      toast('Install prompt dismissed for now.');
      return;
    }

    toast('Install prompt is unavailable on this browser right now.');
  }, [promptInstall, spins.length]);

  const handleDismissPwaBanner = useCallback(() => {
    dismissPwaInstallBanner();
    trackEvent('pwa_install_banner_closed', { spin_count: spins.length });
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
    setAppTab('spin');
    scrollPageToTop(false);
    trackEvent('first_run_onboarding_auto_mode_opened');
  }, []);

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

  const handleLetsGo = useCallback((restaurant: Restaurant, shownRarity?: Rarity): LetsGoReward => {
    trackEvent('lets_go_tapped', { restaurant_name: restaurant.name });

    // Rarity must be read before the visit is recorded below, which resets it to common.
    // The result card passes the tier it showed; other entry points derive it from the favourite.
    const lastVisitedAt = getLastVisitedAt(restaurant);
    const rarity = shownRarity ?? getRarity(lastVisitedAt);
    void recordVisitAndSave(restaurant);

    const reward = game.awardForLetsGo(restaurant.id, getRarityMultiplier(rarity));
    // The result card shows reward tiles (and a level-up modal) itself, so only callers that
    // do not pass a tier, such as craving search, still get the XP toast.
    if (reward.awarded && shownRarity === undefined) {
      const xpText = reward.multiplier > 1
        ? `+${reward.xp} XP (${RARITY_LABEL[rarity]} ${reward.multiplier}x)`
        : `+${reward.xp} XP`;
      toast.success(`${xpText}, +${reward.coins} coins`, {
        description: reward.leveledUp ? `Level up! You are now level ${game.level + 1}.` : undefined,
      });
    }
    reportQuestEvent({ type: 'lets-go', rarity, neverVisited: lastVisitedAt === undefined });

    // Enqueue feedback for next app open
    const favId = deriveFavouriteId(restaurant);
    enqueueFeedback({ favouriteId: favId, restaurantName: restaurant.name });

    // Open Google Maps navigation — prefer the official URI from the API
    window.open(getMapsUrl(restaurant), '_blank', 'noopener,noreferrer');

    toast.success(`Navigating to ${restaurant.name}!`, {
      description: 'We\'ll ask how it was next time you open the app.',
    });

    return buildLetsGoReward(reward, rarity, spinHistorySummary.currentStreak);
  }, [game, getLastVisitedAt, recordVisitAndSave, reportQuestEvent, spinHistorySummary.currentStreak]);

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

    updateSelectedManualList({ restaurants });
  }, [shouldShowRoomManualRestaurants, updateSelectedManualList]);

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
    if (activeTab === 'auto' && placesBudget.nearbyBlocked) {
      trackEvent('spin_blocked', { mode: 'budget' });
      toast.error('Nearby spins are paused: monthly search budget reached. Try My List, or come back next month.');
      return false;
    }
    if (!canSpin(currentMealTime)) {
      trackEvent('spin_blocked', { mode: activeTab });
      setShowSpinLimitWarning(true);
      return false;
    }
    trackEvent('spin_start', { mode: activeTab, restaurant_count: activeTab === 'auto' ? wheelRestaurants.length : displayedManualRestaurants.length });
    respinCountRef.current = 0;
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

  // Filters sheet "Reset": no cuisine, price or serves filter, and the default range.
  const handleResetFilters = () => {
    setSelectedCategories([]);
    setSelectedPriceRanges([]);
    setActiveServesFilters([]);
    setShowAllRoundRestaurants(false);
    handleAutoRangeModeChange(DEFAULT_AUTO_RANGE_MODE);
  };

  // The pinned Spin button runs the wheel through here. The first spin of a round goes
  // through the budget guard; spinning again after a result does not, as it did before.
  const handleWheelSpinStart = () => {
    if (!pendingAutoRemovalId && !handleSpinAttempt()) return [];
    return handleAutoSpinStart();
  };

  // Pick up to 12 of this round's places for the wheel, nearest first.
  const sampleWheelRestaurants = () => {
    const shuffled = [...roundRestaurants].sort(() => Math.random() - 0.5);
    const sliced = shuffled.slice(0, 12);
    return location
      ? [...sliced].sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
      : sliced;
  };

  // Shuffle wheel restaurants
  const shuffleWheel = () => {
    trackEvent('shuffle_wheel', { restaurant_count: roundRestaurants.length });
    setWheelRestaurants(sampleWheelRestaurants());
  };

  // The Spin screen always shows a wheel. Fill it as soon as there are places, and fill it
  // again when the range, filters or the nearby results change what can be on it. A winner
  // waiting to be dropped belongs to the old wheel, so a refill starts a fresh round.
  const wheelSeedKey = [
    rangeMode,
    selectedCategories.join(','),
    selectedPriceRanges.join(','),
    activeServesFilters.join(','),
    autoSourceRestaurants.length,
  ].join('|');
  useEffect(() => {
    if (appTab !== 'spin' || !location || isSpinning || roundRestaurants.length === 0) return;
    const roundIds = new Set(roundRestaurants.map((restaurant) => restaurant.id));
    const isStale = wheelRestaurants.length === 0 || wheelRestaurants.some((restaurant) => !roundIds.has(restaurant.id));
    if (!isStale && seededWheelKeyRef.current === wheelSeedKey) return;
    seededWheelKeyRef.current = wheelSeedKey;
    setPendingAutoRemovalId(null);
    setWheelRestaurants(sampleWheelRestaurants());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appTab, isSpinning, location, roundRestaurants, wheelRestaurants, wheelSeedKey]);

  const handleTabChange = (tab: AppTab) => {
    if (tab === appTab) {
      scrollPageToTop(true);
      return;
    }

    trackEvent('tab_switched', { tab: getTabAnalyticsName(tab) });
    setAppTab(tab);
    if (tab === 'spin') {
      setWheelRestaurants([]);
      setRoundRemovedRestaurantIds([]);
      setPendingAutoRemovalId(null);
      setAutoWheelKey((prev) => prev + 1);
    } else if (tab === 'list') {
      setManualSpinResult(null);
      setManualWheelKey((prev) => prev + 1);
    }
    scrollPageToTop(false);
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

  const listNameSuggestion = useMemo(
    () => getSuggestedManualListName(listNameInput, listMealTimeInput),
    [listMealTimeInput, listNameInput],
  );

  const normalizeManualListName = useCallback((name: string) => name.trim().toLowerCase(), []);

  const duplicateManualListForSave = useMemo(() => {
    const nextName = listNameSuggestion.trim();
    if (!nextName || !selectedManualList) return null;

    return manualLists.find((list) => (
      list.id !== selectedManualList.id
      && normalizeManualListName(list.name) === normalizeManualListName(nextName)
    )) ?? null;
  }, [listNameSuggestion, manualLists, normalizeManualListName, selectedManualList]);

  const buildUniqueManualListName = useCallback((baseName: string) => {
    const trimmedBaseName = baseName.trim();
    if (!trimmedBaseName) return 'My list';

    let candidateName = trimmedBaseName;
    let duplicateIndex = 2;

    while (manualLists.some((list) => normalizeManualListName(list.name) === normalizeManualListName(candidateName))) {
      candidateName = `${trimmedBaseName} (${duplicateIndex})`;
      duplicateIndex += 1;
    }

    return candidateName;
  }, [manualLists, normalizeManualListName]);

  const handleSelectSavedManualList = useCallback((listId: string) => {
    const nextList = manualLists.find((list) => list.id === listId);
    if (!nextList) return;

    hasUserSelectedManualListRef.current = true;
    setIsEditingListDetails(false);
    setIsCreatingNewList(false);
    selectManualList(listId);
    setManualSpinResult(null);
    setManualWheelKey((prev) => prev + 1);

    if (isGroupRoomActive && canEditGroupList) {
      setRoomManualRestaurants(nextList.restaurants);
      syncGroupListFromRestaurants(nextList.restaurants);
    }

    trackEvent('manual_list_selected', {
      list_id: nextList.id,
      list_name: nextList.name,
      count: nextList.restaurants.length,
    });
  }, [canEditGroupList, isGroupRoomActive, manualLists, selectManualList, syncGroupListFromRestaurants]);

  const handleCreateManualList = useCallback(() => {
    if (isManualListReadOnly) {
      toast.info('Only the host or co-host can edit the shared list.');
      return;
    }

    const baseName = getSuggestedManualListName('', listMealTimeInput);
    const suggestedName = buildUniqueManualListName(baseName);
    setListNameInput(suggestedName);
    setIsEditingListDetails(true);
    setIsCreatingNewList(true);
  }, [buildUniqueManualListName, isManualListReadOnly, listMealTimeInput]);

  const handleSaveManualListDetails = useCallback(() => {
    if (isManualListReadOnly) {
      toast.info('Only the host or co-host can edit the shared list.');
      return;
    }

    const nextName = listNameSuggestion.trim();
    if (duplicateManualListForSave) {
      toast.error(`A saved list named "${duplicateManualListForSave.name}" already exists.`);
      return;
    }

    if (isCreatingNewList) {
      const newList = createNewManualList({ name: nextName, mealTime: listMealTimeInput });
      hasUserSelectedManualListRef.current = true;
      setIsEditingListDetails(false);
      setIsCreatingNewList(false);
      setManualSpinResult(null);
      setManualWheelKey((prev) => prev + 1);
      trackEvent('manual_list_created', {
        list_id: newList.id,
        list_name: newList.name,
        meal_time: newList.mealTime ?? 'none',
      });
      if (isGroupRoomActive && canEditGroupList) {
        setRoomManualRestaurants([]);
        syncGroupListFromRestaurants([]);
      }
      toast.success(`Created "${newList.name}".`);
      return;
    }

    if (!selectedManualList) return;

    updateSelectedManualList({
      name: nextName,
      mealTime: listMealTimeInput,
    });
    trackEvent('manual_list_updated', {
      list_id: selectedManualList.id,
      list_name: nextName,
      meal_time: listMealTimeInput ?? 'none',
      count: selectedManualList.restaurants.length,
    });
    setIsEditingListDetails(false);
    toast.success(`Saved details for "${nextName}".`);
  }, [canEditGroupList, createNewManualList, duplicateManualListForSave, isCreatingNewList, isGroupRoomActive, isManualListReadOnly, listMealTimeInput, listNameSuggestion, selectedManualList, syncGroupListFromRestaurants, updateSelectedManualList]);

  const handleCancelEditListDetails = useCallback(() => {
    if (isCreatingNewList) {
      setIsEditingListDetails(false);
      setIsCreatingNewList(false);
      if (selectedManualList) {
        setListNameInput(selectedManualList.name);
        setListMealTimeInput(selectedManualList.mealTime);
      }
      return;
    }
    if (!selectedManualList) return;
    setListNameInput(selectedManualList.name);
    setListMealTimeInput(selectedManualList.mealTime);
    setIsEditingListDetails(false);
  }, [isCreatingNewList, selectedManualList]);

  const handleSaveRoomListToManualLists = useCallback(() => {
    if (!isGroupRoomActive || displayedManualRestaurantNames.length === 0) return;

    const roomMealTime = getPreferredManualMealTime();
    const roomListBaseName = getSuggestedManualListName(groupRoomId ? `Room ${groupRoomId}` : 'Saved room', roomMealTime);
    const nextName = buildUniqueManualListName(roomListBaseName);
    const newList = createNewManualList({
      name: nextName,
      mealTime: roomMealTime,
      restaurants: buildRestaurantsFromNames(displayedManualRestaurantNames),
    });

    trackEvent('manual_list_saved_from_room', {
      room_id: groupRoomId,
      list_id: newList.id,
      list_name: newList.name,
      count: displayedManualRestaurantNames.length,
    });
    toast.success(`Saved this room list as "${newList.name}".`, {
      description: 'Leave the room anytime to find it in your saved manual lists.',
    });
  }, [
    buildRestaurantsFromNames,
    buildUniqueManualListName,
    createNewManualList,
    displayedManualRestaurantNames,
    groupRoomId,
    isGroupRoomActive,
  ]);

  const handleDeleteManualList = useCallback(() => {
    if (!selectedManualList || isManualListReadOnly) {
      if (isManualListReadOnly) {
        toast.info('Only the host or co-host can edit the shared list.');
      }
      return;
    }

    if (!window.confirm(`Delete "${selectedManualList.name}"?`)) return;

    const fallbackList = deleteManualList(selectedManualList.id);
    hasUserSelectedManualListRef.current = true;
    setManualSpinResult(null);
    setManualWheelKey((prev) => prev + 1);
    trackEvent('manual_list_deleted', {
      list_id: selectedManualList.id,
      list_name: selectedManualList.name,
    });

    const nextRestaurants = fallbackList?.restaurants ?? [];
    if (isGroupRoomActive && canEditGroupList) {
      setRoomManualRestaurants(nextRestaurants);
      syncGroupListFromRestaurants(nextRestaurants);
    }

    toast.success(`Deleted "${selectedManualList.name}".`);
  }, [canEditGroupList, deleteManualList, isGroupRoomActive, isManualListReadOnly, selectedManualList, syncGroupListFromRestaurants]);
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

  useEffect(() => {
    if (!selectedManualList) return;
    setListNameInput(selectedManualList.name);
    setListMealTimeInput(selectedManualList.mealTime);
  }, [selectedManualList]);

  const hasManualListDetailsChanged = useMemo(() => {
    if (!selectedManualList) return false;
    return selectedManualList.name !== listNameSuggestion.trim() || selectedManualList.mealTime !== listMealTimeInput;
  }, [listMealTimeInput, listNameSuggestion, selectedManualList]);

  const manualListNameHelperText = duplicateManualListForSave
    ? `List name already used by ${duplicateManualListForSave.name}.`
    : listNameSuggestion.trim() !== listNameInput.trim()
      ? `Use suggestion: ${listNameSuggestion}`
      : '';

  // selectedManualListLabel removed — chip bar shows names inline

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
    setIsManualRoomLeavePending(false);
    setRoomManualRestaurants([]);
    await createGroupRoom();
  }, [createGroupRoom]);

  const handleJoinGroupRoom = useCallback(async (value: string) => {
    trackEvent('group_room_joined', { room_id: value });
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
    if (isGroupRoomActive || hasUserSelectedManualListRef.current) return;

    const preferredMealTime = getPreferredManualMealTime();

    if (autoLoadedMealTimeRef.current === preferredMealTime) return;

    autoLoadedMealTimeRef.current = preferredMealTime;

    const matchedList = selectDeterministicManualList(preferredMealTime);
    if (!matchedList) return;

    const timeoutId = window.setTimeout(() => {
      setManualSpinResult(null);
      setManualWheelKey((prev) => prev + 1);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentMealTime, isGroupRoomActive, selectDeterministicManualList]);

  // Why the Spin screen has nothing to spin although places were found nearby.
  const autoEmptyState = autoSourceRestaurants.length === 0
    ? null
    : filteredRestaurants.length > 0
      ? {
          title: 'Every place was removed from this round.',
          subtitle: 'Reset the round to bring them back.',
          action: { label: 'Reset round', onClick: resetAutoWheel },
        }
      : {
          title: closingSoonExcludedCount > 0 || closedNowExcludedCount > 0
            ? 'No open spots left for the wheel right now.'
            : 'No matches — try clearing a filter.',
          subtitle: autoEmptyStateSubtitle,
        };

  return (
    <div
      className="mx-auto min-h-dvh w-full max-w-[480px] overflow-x-clip bg-arcade-yellow"
      style={{ paddingBottom: 'var(--bottom-nav-height)' }}
    >
      <main>
        {/* Me screen heading */}
        {appTab === 'me' && (
          <div className="px-4 pt-6 sm:px-6">
            <h1 className="font-heading text-3xl font-bold leading-[1.1] text-brand-ink">Me</h1>
          </div>
        )}

        {/* Level, streak, coins and today's quest - Me screen (Spin has its own compact HUD) */}
        {appTab === 'me' && (
          <>
            <GameHud
              level={game.level}
              xpIntoLevel={game.xpIntoLevel}
              xpPerLevel={game.xpPerLevel}
              coins={game.coins}
              streak={spinHistorySummary.currentStreak}
            />
            <QuestCard
              title={game.quest.quest.title}
              rewardXp={game.quest.quest.rewardXp}
              progress={game.quest.progress}
              target={game.quest.quest.target}
              completed={game.quest.completed}
            />
          </>
        )}

        {/* Spin screen */}
        {appTab === 'spin' && (
          <SpinScreen
            hud={{
              level: game.level,
              xpIntoLevel: game.xpIntoLevel,
              xpPerLevel: game.xpPerLevel,
              coins: game.coins,
              streak: spinHistorySummary.currentStreak,
            }}
            quest={{
              title: game.quest.quest.title,
              rewardXp: game.quest.quest.rewardXp,
              progress: game.quest.progress,
              target: game.quest.quest.target,
              completed: game.quest.completed,
            }}
            mealTime={currentMealTime}
            onMoodSelect={handleMoodSelect}
            hasLocation={Boolean(location)}
            isLocationLoading={locationLoading}
            locationError={locationError}
            onRequestLocation={requestLocation}
            filters={{
              rangeMode,
              onRangeModeChange: handleAutoRangeModeChange,
              selectedPriceRanges,
              onTogglePriceRange: togglePriceRange,
              selectedCategories,
              onCategoryChange: handleCategoryChange,
              activeServesFilters,
              onToggleServesFilter: handleToggleServesFilter,
              onReset: handleResetFilters,
              favouriteCategoryCounts,
              dataSourceLabel: autoDataSourceLabel,
              nearbyError: nearbyRestaurantsError,
              closingSoonCount: closingSoonExcludedCount,
              closedNowCount: closedNowExcludedCount,
            }}
            placeCount={roundRestaurants.length}
            isLoadingPlaces={nearbyRestaurantsLoading}
            emptyState={autoEmptyState}
            budgetBlocked={placesBudget.nearbyBlocked ? { used: placesBudget.nearbyUsed, cap: placesBudget.cap } : null}
            canSpin={wheelRestaurants.length >= 2}
            isSpinning={isSpinning}
            onSpin={() => wheelRef.current?.spin()}
            wheel={(
              <RouletteWheel
                ref={wheelRef}
                key={`auto-${autoWheelKey}`}
                hideSpinButton
                scrollOnSpin={false}
                wheelMaxSize={SPIN_SCREEN_WHEEL_SIZE}
                restaurants={wheelRestaurants}
                totalCount={roundRestaurants.length}
                onSpinComplete={handleSpinComplete}
                isSpinning={isSpinning}
                setIsSpinning={setIsSpinning}
                onShuffle={shuffleWheel}
                onSpinStart={handleWheelSpinStart}
                onSaveFavourite={(r) => handleSaveFavourite(r, 'auto')}
                onLetsGo={handleLetsGo}
                onShareResult={handleShareResult}
                onSpinAgain={handleAutoSpinAgain}
                canSpinAgain={wheelRestaurants.length >= 2}
                isFavourite={isFavouriteCheck}
                getLastVisitedAt={getLastVisitedAt}
                helperText={autoAvailabilityHelperText || undefined}
                emptyStateTitle="No open restaurants ready to spin"
                emptyStateSubtitle={autoEmptyStateSubtitle}
              />
            )}
            limitWarning={showSpinLimitWarning && currentMealTime !== 'none' ? (
              <SpinLimitWarning
                mealTime={currentMealTime}
                onUpgrade={() => setShowSubscription(true)}
                onClose={() => setShowSpinLimitWarning(false)}
              />
            ) : null}
            isPremium={isPremium}
            roundReview={(
              <RoundReview
                remainingCount={roundRestaurants.length}
                restaurants={displayedRoundRestaurants}
                previewCount={REVIEW_PREVIEW_COUNT}
                showAll={showAllRoundRestaurants}
                onToggleShowAll={() => setShowAllRoundRestaurants((prev) => !prev)}
                isFavourite={isFavouriteCheck}
                onSave={(restaurant) => handleSaveFavourite(restaurant, 'auto')}
                onRemove={removeRestaurantForRound}
                onResetRound={resetAutoWheel}
                formatTravel={estimateTravelTime}
              />
            )}
            pwaBanner={showPwaInstallBanner && isPwaPromptReady ? (
              <PwaInstallBanner
                spinCount={spins.length}
                onInstall={() => { void handlePwaInstall(); }}
                onDismiss={handleDismissPwaBanner}
              />
            ) : null}
            search={{
              query: textSearch.query,
              onSearch: textSearch.search,
              results: textSearch.results,
              isLoading: textSearch.isLoading,
              error: textSearch.error,
              recentSearches: textSearch.recentSearches,
              onLetsGo: handleLetsGo,
              onClear: textSearch.clearResults,
            }}
          />
        )}

        {/* My list screen (the Spin screen has its own layout above) */}
        {appTab === 'list' && (
          <section id="app-main-section" className="py-6 sm:py-8 px-4 sm:px-6 lg:px-8 bg-white">
            <div className="max-w-4xl mx-auto">

              {/* PWA Install Banner */}
              {showPwaInstallBanner && isPwaPromptReady && (
                <div className="mb-4">
                  <PwaInstallBanner
                    spinCount={spins.length}
                    onInstall={() => { void handlePwaInstall(); }}
                    onDismiss={handleDismissPwaBanner}
                  />
                </div>
              )}

              {/* MANUAL MODE */}
              {activeTab === 'manual' && (
                <div id="wheel" className="py-4 pb-14 sm:pb-8">
                  {isGroupRoomActive && (
                    <div className="mb-4 rounded-xl border-2 border-brand-ink bg-brand-linen px-4 py-3 text-sm text-eatspin-gray-1">
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
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-xs font-medium text-brand-black/80">Like this list? Save it to your own manual lists and spin it later.</p>
                            <p className="text-[11px] text-eatspin-gray-1">We'll save a copy without changing the host's room list.</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleSaveRoomListToManualLists}
                              disabled={displayedManualRestaurantNames.length === 0}
                              className="h-9 border-brand-ink bg-white px-3 text-xs font-semibold text-brand-black hover:bg-brand-linen"
                            >
                              Add to my list
                            </Button>
                            <button
                              type="button"
                              onClick={() => {
                                void handleLeaveGroupRoom();
                              }}
                              className="inline-flex items-center rounded-full border-2 border-brand-ink bg-white px-3 py-1.5 text-xs font-semibold text-brand-black hover:bg-brand-linen"
                            >
                              Leave room to spin on your own
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {/* ── Saved Lists: chip-based selector ── */}
                  <div className="mb-6 max-w-2xl mx-auto rounded-2xl border-2 border-brand-ink bg-white p-4 shadow-pop">
                    <div className="flex flex-col gap-3">
                      {/* Header */}
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-eatspin-gray-1">Saved lists</p>

                      {/* Horizontal chip bar with overflow fade hint */}
                      <div className="relative">
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide" role="listbox" aria-label="Saved lists">
                          {manualLists.map((list) => {
                            const isSelected = list.id === selectedManualListId;
                            const emoji = getMealTimeEmoji(list.mealTime);
                            return (
                              <button
                                key={list.id}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                title={`${list.name} — ${list.restaurants.length} picks`}
                                onClick={() => {
                                  if (!isSelected) handleSelectSavedManualList(list.id);
                                }}
                                disabled={isManualListReadOnly}
                                className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                                  isSelected
                                    ? 'bg-brand-orange text-white shadow-sm'
                                    : 'border-2 border-brand-ink bg-white text-brand-black hover:border-brand-ink hover:bg-brand-linen'
                                } disabled:opacity-40`}
                              >
                                {emoji && <span>{emoji}</span>}
                                <span className="truncate max-w-[140px]">{list.name}</span>
                                <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                                  isSelected
                                    ? list.restaurants.length === 0 ? 'bg-white/20 text-white/90' : 'bg-white/25 text-white'
                                    : list.restaurants.length === 0 ? 'bg-arcade-yellow/30 text-eatspin-gray-1' : 'bg-arcade-yellow/30 text-brand-black'
                                }`}>
                                  {list.restaurants.length}
                                </span>
                              </button>
                            );
                          })}
                          {/* New list chip */}
                          <button
                            type="button"
                            onClick={handleCreateManualList}
                            disabled={isManualListReadOnly}
                            className="flex shrink-0 items-center gap-1 rounded-full border-2 border-dashed border-brand-ink/40 px-3 py-2 text-sm font-medium text-eatspin-gray-1 transition hover:border-brand-ink hover:text-brand-orange disabled:opacity-40"
                            aria-label="Create new list"
                          >
                            <Plus size={14} />
                            <span>New</span>
                          </button>
                        </div>
                        {/* Right fade hint when many lists */}
                        {manualLists.length > 3 && (
                          <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-white to-transparent" aria-hidden="true" />
                        )}
                      </div>

                      {/* Inline actions for selected list (view mode) */}
                      {!isEditingListDetails && selectedManualList && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsEditingListDetails(true)}
                            disabled={isManualListReadOnly}
                            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-eatspin-gray-1 transition hover:bg-arcade-yellow/60 hover:text-brand-black disabled:opacity-40"
                            aria-label="Edit list name and meal time"
                          >
                            <PencilLine size={13} />
                            <span>Rename</span>
                          </button>
                          {manualLists.length > 1 && (
                            <button
                              type="button"
                              onClick={handleDeleteManualList}
                              disabled={isManualListReadOnly}
                              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                              aria-label={`Delete ${selectedManualList.name}`}
                            >
                              <Trash2 size={13} />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Edit mode (inline expansion) */}
                      {isEditingListDetails && (
                        <div className="space-y-3 rounded-lg border-2 border-brand-ink bg-brand-linen/50 p-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-eatspin-gray-1" htmlFor="saved-manual-name">List name</label>
                              <Input
                                id="saved-manual-name"
                                value={listNameInput}
                                onChange={(e) => setListNameInput(e.target.value)}
                                placeholder="Isaac lunch list"
                                className="h-10"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-eatspin-gray-1" htmlFor="saved-manual-mealtime">Meal time</label>
                              <div className="relative">
                                <select
                                  id="saved-manual-mealtime"
                                  value={listMealTimeInput ?? ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === 'breakfast' || value === 'lunch' || value === 'dinner') {
                                      setListMealTimeInput(value);
                                      return;
                                    }
                                    setListMealTimeInput(null);
                                  }}
                                  className="preset-select h-10 w-full rounded-md border-2 border-brand-ink bg-white px-3 pr-10 text-sm text-brand-black"
                                >
                                  <option value="">🕒 No meal time</option>
                                  <option value="breakfast">🌅 Breakfast</option>
                                  <option value="lunch">☀️ Lunch</option>
                                  <option value="dinner">🌙 Dinner</option>
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-eatspin-gray-1" />
                              </div>
                            </div>
                          </div>
                          {duplicateManualListForSave ? (
                            <p className="text-xs text-red-600">{manualListNameHelperText}</p>
                          ) : listNameSuggestion.trim() !== listNameInput.trim() ? (
                            <button
                              type="button"
                              onClick={() => setListNameInput(listNameSuggestion)}
                              className="text-left text-xs text-brand-orange hover:underline"
                            >
                              {manualListNameHelperText}
                            </button>
                          ) : null}
                          <div className="flex items-center justify-between gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleDeleteManualList}
                              disabled={isManualListReadOnly || !selectedManualList}
                              className="h-9 border-red-200 px-3 text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={14} className="mr-1" /> Delete
                            </Button>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleCancelEditListDetails}
                                className="h-9 px-3 text-xs font-semibold"
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                onClick={handleSaveManualListDetails}
                                disabled={isManualListReadOnly || (!isCreatingNewList && (!selectedManualList || !hasManualListDetailsChanged)) || Boolean(duplicateManualListForSave)}
                                className="h-9 bg-brand-orange px-3 text-xs font-semibold text-white hover:bg-brand-orange/90"
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

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
                    getLastVisitedAt={getLastVisitedAt}
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
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="text-xs text-eatspin-gray-1">{estimateTravelTime(nf.distanceKm)}</span>
                                      <RarityBadge rarity={getRarity(favourites.find((f) => f.id === nf.favouriteId)?.lastVisitedAt)} />
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {!alreadyInList && !isManualListReadOnly && (
                                      <button
                                        type="button"
                                        onClick={() => handleAddFavouriteToManualList(nf.restaurantName)}
                                        className="inline-flex items-center gap-1 rounded-full border-2 border-brand-ink bg-white px-2.5 py-1 text-xs font-medium text-brand-orange hover:bg-brand-orange/10"
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
                        <div className="bg-white rounded-xl border-2 border-brand-ink shadow-pop p-4">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="font-heading font-semibold text-brand-black flex items-center gap-2">
                              <Heart size={16} className="text-brand-ink fill-arcade-pink" />
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
                                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                        <RarityBadge rarity={getRarity(fav.lastVisitedAt)} />
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
                                          className="inline-flex items-center gap-1 rounded-full border-2 border-brand-ink bg-white px-2.5 py-1 text-xs font-medium text-brand-orange hover:bg-brand-orange/10"
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
                      <div className="sticky bottom-[calc(var(--bottom-nav-height)_+_0.75rem)] z-30 rounded-2xl border-2 border-brand-ink bg-white/95 p-3 shadow-pop backdrop-blur supports-[backdrop-filter]:bg-white/85">
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

                    <div className="mt-4 bg-white rounded-xl border-2 border-brand-ink p-4">
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
                                  className="inline-flex items-center gap-1 rounded-full border-2 border-brand-ink bg-brand-linen px-3 py-1.5 text-xs font-medium text-brand-black hover:border-brand-ink hover:text-brand-orange"
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

                    </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Group screen */}
        {appTab === 'group' && (
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
        )}

        {/* Challenge + Discover Feed (feature-flagged) - Group screen */}
        {APP_FEATURES.spinChallenge && appTab === 'group' && (
          <section className="py-6 px-4 sm:px-6 lg:px-8 bg-arcade-yellow">
            <div className="max-w-4xl mx-auto">
              <div className="rounded-2xl border-2 border-brand-ink bg-white p-4 sm:p-5">
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
                    className="border-brand-ink text-brand-black hover:bg-brand-linen"
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
                      className="border-brand-ink text-brand-orange hover:bg-brand-orange/10"
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

                  <div className="rounded-xl border-2 border-brand-ink bg-brand-linen/60 px-3 py-2">
                    <p className="text-xs text-eatspin-gray-1">
                      Your completed days: <strong className="text-brand-black">{myChallengeParticipant?.completedDayKeys.length ?? 0}</strong>/7
                    </p>
                  </div>

                  <ul className="space-y-2">
                    {challengeLeaderboard.map((participant) => (
                      <li
                        key={participant.uid}
                        className="flex items-center justify-between rounded-lg border-2 border-brand-ink bg-brand-linen px-3 py-2 text-sm"
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
            </div>
          </section>
        )}

        {APP_FEATURES.discoverFeed && appTab === 'group' && (
          <section className="py-6 px-4 sm:px-6 lg:px-8 bg-white">
            <div className="max-w-4xl mx-auto">
              <div className="rounded-2xl border-2 border-brand-ink bg-brand-linen/70 p-4 sm:p-5">
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
            </div>
          </section>
        )}

        {/* Spin Stats - Me screen, only when user has history */}
        {appTab === 'me' && spinHistorySummary.totalSpins > 0 && (
          <section className="py-6 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-4xl mx-auto">
            <SpinStatsPanel
              totalSpins={spinHistorySummary.totalSpins}
              uniqueRestaurants={spinHistorySummary.uniqueRestaurants}
              currentStreak={spinHistorySummary.currentStreak}
              topCategory={spinHistorySummary.topCategory}
              spinsThisMonth={spinHistorySummary.spinsThisMonth}
              recentSpins={spinHistorySummary.recentSpins}
              onShareWrapped={() => { void handleShareSpinWrapped(); }}
            />
          </div>
        </section>
        )}

        {/* About EatSpin - the landing sections, collapsed by default (Me screen) */}
        {appTab === 'me' && <AboutEatSpin onStartSpinning={() => handleTabChange('spin')} />}
      </main>

      <BottomNav
        activeTab={appTab}
        onTabChange={handleTabChange}
        hasActiveRoom={isGroupRoomActive}
      />

      {/* Modals */}
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

      {/* Toasts sit above the fixed bottom tab bar */}
      <Toaster
        offset={{ bottom: 'calc(var(--bottom-nav-height) + 16px)' }}
        mobileOffset={{ bottom: 'calc(var(--bottom-nav-height) + 12px)' }}
      />
    </div>
  );
}

export default App;
