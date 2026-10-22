import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';

import { trackEvent } from '@/lib/analytics';
import { useSpinTracker } from '@/hooks/useSpinTracker';
import { useFirebaseGroupRoom } from '@/hooks/useFirebaseGroupRoom';
import { usePwaInstallPrompt } from '@/hooks/usePwaInstallPrompt';
import { getMealTimeEmoji, getSuggestedManualListName, useManualLists } from '@/hooks/useManualLists';
import type { ManualListMealTime, MealTime, Restaurant } from '@/types';
import { getCurrentMealTime } from '@/lib/utils';
import { RouletteWheel } from '@/components/RouletteWheel';
import { AppNavbar } from '@/sections/AppNavbar';
import { Footer } from '@/sections/Footer';
import { GroupSpin } from '@/sections/GroupSpin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Toaster } from '@/components/ui/sonner';
import { PencilLine, Plus, X, Trash2, ChevronDown, CheckCircle2, Heart } from 'lucide-react';
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

// Lazy-load marketing sections (only shown behind "Learn more" toggle)
const HowItWorks = lazy(() => import('@/sections/HowItWorks').then(m => ({ default: m.HowItWorks })));
const Features = lazy(() => import('@/sections/Features').then(m => ({ default: m.Features })));
const Testimonials = lazy(() => import('@/sections/Testimonials').then(m => ({ default: m.Testimonials })));
const CTA = lazy(() => import('@/sections/CTA').then(m => ({ default: m.CTA })));


const FIRST_RUN_ONBOARDING_SEEN_KEY = 'eatspin:first-run-onboarding-seen';
const ROOM_LIST_SYNC_GRACE_MS = 2_500;
const GROUP_SPIN_REPLAY_WINDOW_MS = 30_000;
const LATE_JOIN_NOTICE_MS = 5 * 60 * 1000;
const SPIN_HISTORY_PREVIEW_COUNT = 8;
const MANUAL_SUGGESTED_RESTAURANTS = ['Sushi Place', 'Burger Spot', 'Local Noodles', 'Pizza Corner'];
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

const toDateKey = (timestamp: Date | string | number): string => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentMealTime, setCurrentMealTime] = useState<MealTime>('none');
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !window.localStorage.getItem(FIRST_RUN_ONBOARDING_SEEN_KEY);
  });
  const [showAboutSections, setShowAboutSections] = useState(false);

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
  const autoLoadedMealTimeRef = useRef<ManualListMealTime>(null);
  const hasUserSelectedManualListRef = useRef(false);
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
  const { spins, recordSpin } = useSpinTracker();
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
  // Update current meal time
  useEffect(() => {
    const updateMealTime = () => {
      setCurrentMealTime(getCurrentMealTime());
    };

    updateMealTime();
    const interval = setInterval(updateMealTime, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const spinHistorySummary = useMemo(() => {
    const categoryCounter = new Map<string, number>();
    const restaurantIds = new Set<string>();

    for (const spin of spins) {
      const restaurant = spin.restaurant;
      const category = restaurant.category?.[0] ?? 'other';
      categoryCounter.set(category, (categoryCounter.get(category) ?? 0) + 1);
      restaurantIds.add(restaurant.id);
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

  const handleManualSpinComplete = useCallback((restaurant: Restaurant) => {
    trackEvent('spin_complete', { mode: 'manual', restaurant_name: restaurant.name });
    setManualSpinResult(restaurant);
    recordSpin(restaurant, currentMealTime);
  }, [currentMealTime, recordSpin]);

  const handleSaveFavourite = useCallback((restaurant: Restaurant) => {
    trackEvent('favourite_saved', { restaurant_name: restaurant.name });
    void saveFavourite(restaurant, 'spin-manual');
    toast.success(`${restaurant.name} saved to favourites!`, {
      description: 'Find it in the "I Know Where" tab under My Favourites.',
    });
  }, [saveFavourite]);

  const handleShareResult = useCallback(async (restaurant: Restaurant, cardElement: HTMLElement) => {
    trackEvent('share_result_open', { restaurant_name: restaurant.name });

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
        error: message,
      });
      toast.error('Unable to share this result right now.');
    }
  }, []);

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

  const handleLetsGo = useCallback((restaurant: Restaurant) => {
    trackEvent('lets_go_tapped', { restaurant_name: restaurant.name });
    void recordVisitAndSave(restaurant);

    // Enqueue feedback for next app open
    const favId = deriveFavouriteId(restaurant);
    enqueueFeedback({ favouriteId: favId, restaurantName: restaurant.name });

    // Plain Maps search link (no API key needed)
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.name)}`;
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
      {/* App-style navbar with built-in tab toggle */}
      <AppNavbar
        activeRoomId={groupRoomId}
        onGroupSpin={() => scrollToSection('group-spin')}
        onAbout={() => setShowAboutSections(prev => !prev)}
        onLeaveRoom={isGroupRoomActive ? handleLeaveGroupRoom : undefined}
      />

      {/* Main app section */}
      <section id="app-main-section" className="py-6 sm:py-8 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto">

          {/* PWA Install Banner */}
          {showPwaInstallBanner && isPwaPromptReady && (
            <div className="mb-4 rounded-2xl border border-brand-orange/40 bg-brand-linen px-4 py-3 shadow-sm">
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

          {/* MANUAL MODE */}
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
                          className="h-9 border-brand-orange/40 bg-white px-3 text-xs font-semibold text-brand-black hover:bg-brand-linen"
                        >
                          Add to my list
                        </Button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleLeaveGroupRoom();
                          }}
                          className="inline-flex items-center rounded-full border border-brand-orange/40 bg-white px-3 py-1.5 text-xs font-semibold text-brand-black hover:bg-brand-linen"
                        >
                          Leave room to spin on your own
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* ── Saved Lists: chip-based selector ── */}
              <div className="mb-6 max-w-2xl mx-auto rounded-2xl border border-eatspin-peach/60 bg-white p-4 shadow-sm">
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
                                : 'border border-eatspin-peach/70 bg-white text-brand-black hover:border-brand-orange/40 hover:bg-brand-linen'
                            } disabled:opacity-40`}
                          >
                            {emoji && <span>{emoji}</span>}
                            <span className="truncate max-w-[140px]">{list.name}</span>
                            <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                              isSelected
                                ? list.restaurants.length === 0 ? 'bg-white/20 text-white/90' : 'bg-white/25 text-white'
                                : list.restaurants.length === 0 ? 'bg-eatspin-peach/50 text-eatspin-gray-1' : 'bg-eatspin-peach/70 text-brand-black'
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
                        className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-eatspin-peach px-3 py-2 text-sm font-medium text-eatspin-gray-1 transition hover:border-brand-orange/50 hover:text-brand-orange disabled:opacity-40"
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
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-eatspin-gray-1 transition hover:bg-eatspin-peach/30 hover:text-brand-black disabled:opacity-40"
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
                    <div className="space-y-3 rounded-lg border border-eatspin-peach/50 bg-brand-linen/50 p-3">
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
                              className="preset-select h-10 w-full rounded-md border border-eatspin-peach/70 bg-white px-3 pr-10 text-sm text-brand-black"
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
                onSaveFavourite={handleSaveFavourite}
                onLetsGo={handleLetsGo}
                onShareResult={handleShareResult}
                isFavourite={isFavouriteCheck}
              />

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

                </div>
            </div>
        </div>
      </section>

      {/* Group Spin section */}
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

      {/* Spin Stats - show only when user has history */}
      {spinHistorySummary.totalSpins > 0 && (
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

      {/* About Sections (collapsible) */}
      <div className="border-t border-eatspin-peach/30">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            type="button"
            onClick={() => setShowAboutSections(prev => !prev)}
            className="flex items-center gap-2 text-sm font-medium text-eatspin-gray-1 hover:text-brand-orange transition-colors mx-auto"
          >
            <ChevronDown size={16} className={`transition-transform duration-200 ${showAboutSections ? 'rotate-180' : ''}`} />
            {showAboutSections ? 'Hide' : 'Learn more about EatSpin'}
          </button>
        </div>
        {showAboutSections && (
          <Suspense fallback={
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-brand-orange border-t-transparent" />
            </div>
          }>
            <HowItWorks />
            <Features />
            <Testimonials />
            <CTA />
          </Suspense>
        )}
      </div>

      <Footer />

      {/* Modals */}
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
      />

      <Toaster />
    </div>
  );
}

export default App;
