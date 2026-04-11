/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';

import type { FoodCategory, MealTime, Restaurant } from '@/types';
import { getCurrentMealTime } from '@/lib/utils';
import { useSpinTracker } from '@/hooks/useSpinTracker';
import { useFavourites } from '@/hooks/useFavourites';
import { useFeedbackPrompt } from '@/hooks/useFeedbackPrompt';
import type { FavouriteEntry } from '@/types/favourites';
import type { PendingFeedback } from '@/lib/feedbackStore';
import type { SpinResult } from '@/types';

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

export type SpinTab = 'auto' | 'manual';
export type AutoRangeMode = 'walk' | 'drive10' | 'drive20';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const AUTO_RANGE_MODE_STORAGE_KEY = 'eatspin:auto-range-mode';
export const DEFAULT_AUTO_RANGE_MODE: AutoRangeMode = 'drive10';

export const AUTO_RANGE_RADIUS_KM: Record<AutoRangeMode, number> = {
  walk: 1.2,
  drive10: 6,
  drive20: 12,
};

export const AUTO_RANGE_LABEL: Record<AutoRangeMode, string> = {
  walk: 'Walking distance',
  drive10: '10 min drive',
  drive20: '20 min drive',
};

export const AUTO_RANGE_OPTIONS: Array<{
  id: AutoRangeMode;
  label: string;
  helper: string;
}> = [
  { id: 'walk', label: 'Walking distance', helper: '~1.2 km' },
  { id: 'drive10', label: '10 min drive', helper: '~6 km' },
  { id: 'drive20', label: '20 min drive', helper: '~12 km' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Context value shape
// ---------------------------------------------------------------------------

interface AppContextValue {
  // Tab
  activeTab: SpinTab;
  switchTab: (tab: SpinTab) => void;

  // Meal time
  currentMealTime: MealTime;

  // Spinning
  isSpinning: boolean;
  setIsSpinning: React.Dispatch<React.SetStateAction<boolean>>;

  // Navigation
  scrollToSection: (sectionId: string) => void;

  // Spin tracker (from useSpinTracker)
  spins: SpinResult[];
  canSpin: (mealTime: MealTime) => boolean;
  recordSpin: (restaurant: Restaurant, mealTime: MealTime) => void;

  // Favourites (from useFavourites)
  favourites: FavouriteEntry[];
  isFavourite: (restaurant: Restaurant) => boolean;
  saveFavourite: (
    restaurant: Restaurant,
    savedFrom: FavouriteEntry['savedFrom'],
  ) => Promise<void>;
  removeFavouriteEntry: (id: string) => Promise<FavouriteEntry | undefined>;
  restoreFavouriteEntry: (entry: FavouriteEntry) => Promise<void>;
  recordVisitAndSave: (restaurant: Restaurant) => Promise<void>;
  updateFavouriteRating: (
    id: string,
    userRating: FavouriteEntry['userRating'],
  ) => Promise<void>;

  // Feedback prompt (from useFeedbackPrompt)
  feedbackPending: PendingFeedback | null;
  dismissFeedback: () => void;

  // Premium / Subscription
  isPremium: boolean;
  setIsPremium: React.Dispatch<React.SetStateAction<boolean>>;
  showSubscription: boolean;
  setShowSubscription: React.Dispatch<React.SetStateAction<boolean>>;

  // Range mode
  rangeMode: AutoRangeMode;
  setRangeMode: (mode: AutoRangeMode) => void;

  // Filters
  selectedCategories: FoodCategory[];
  setSelectedCategories: React.Dispatch<React.SetStateAction<FoodCategory[]>>;
  selectedPriceRanges: Restaurant['priceRange'][];
  setSelectedPriceRanges: React.Dispatch<
    React.SetStateAction<Restaurant['priceRange'][]>
  >;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AppContext = createContext<AppContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AppProvider({ children }: { children: ReactNode }) {
  // ── Tab ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<SpinTab>(() => {
    if (typeof window === 'undefined') return 'auto';
    return new URLSearchParams(window.location.search).get('room')
      ? 'manual'
      : 'auto';
  });

  const switchTab = useCallback((tab: SpinTab) => {
    setActiveTab(tab);
  }, []);

  // ── Meal time (refreshes every 60 s) ────────────────────────────────
  const [currentMealTime, setCurrentMealTime] = useState<MealTime>(
    () => getCurrentMealTime(),
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setCurrentMealTime(getCurrentMealTime());
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // ── Spinning ────────────────────────────────────────────────────────
  const [isSpinning, setIsSpinning] = useState(false);

  // ── Scroll helper ───────────────────────────────────────────────────
  const scrollToSection = useCallback((sectionId: string) => {
    if (typeof window === 'undefined') return;
    const section = document.getElementById(sectionId);
    if (!section) return;

    const navbarHeight = Number.parseInt(
      window
        .getComputedStyle(document.documentElement)
        .getPropertyValue('--navbar-height'),
      10,
    );
    const offset = Number.isFinite(navbarHeight) ? navbarHeight : 72;
    const targetTop =
      window.scrollY + section.getBoundingClientRect().top - offset - 8;
    window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
  }, []);

  // ── Spin tracker ────────────────────────────────────────────────────
  const { spins, canSpin, recordSpin } = useSpinTracker();

  // ── Favourites ──────────────────────────────────────────────────────
  const {
    favourites,
    isFavourite: isFavouriteCheck,
    save: saveFavourite,
    remove: removeFavouriteEntry,
    restore: restoreFavouriteEntry,
    recordVisitAndSave,
    updateRating: updateFavouriteRating,
  } = useFavourites();

  // ── Feedback prompt ─────────────────────────────────────────────────
  const { pending: feedbackPending, dismiss: dismissFeedback } =
    useFeedbackPrompt();

  // ── Premium / Subscription ──────────────────────────────────────────
  const [isPremium, setIsPremium] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);

  // ── Range mode (persisted to localStorage) ──────────────────────────
  const [rangeMode, setRangeModeRaw] = useState<AutoRangeMode>(
    () => loadAutoRangeMode(),
  );

  const setRangeMode = useCallback((mode: AutoRangeMode) => {
    setRangeModeRaw(mode);
    try {
      window.localStorage.setItem(AUTO_RANGE_MODE_STORAGE_KEY, mode);
    } catch {
      // Storage full or unavailable — ignore silently.
    }
  }, []);

  // ── Filters ─────────────────────────────────────────────────────────
  const [selectedCategories, setSelectedCategories] = useState<FoodCategory[]>(
    [],
  );
  const [selectedPriceRanges, setSelectedPriceRanges] = useState<
    Restaurant['priceRange'][]
  >([]);

  // ── Assemble context value ──────────────────────────────────────────
  const value: AppContextValue = {
    // Tab
    activeTab,
    switchTab,

    // Meal time
    currentMealTime,

    // Spinning
    isSpinning,
    setIsSpinning,

    // Navigation
    scrollToSection,

    // Spin tracker
    spins,
    canSpin,
    recordSpin,

    // Favourites
    favourites,
    isFavourite: isFavouriteCheck,
    saveFavourite,
    removeFavouriteEntry,
    restoreFavouriteEntry,
    recordVisitAndSave,
    updateFavouriteRating,

    // Feedback prompt
    feedbackPending,
    dismissFeedback,

    // Premium / Subscription
    isPremium,
    setIsPremium,
    showSubscription,
    setShowSubscription,

    // Range mode
    rangeMode,
    setRangeMode,

    // Filters
    selectedCategories,
    setSelectedCategories,
    selectedPriceRanges,
    setSelectedPriceRanges,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ---------------------------------------------------------------------------
// Consumer hook
// ---------------------------------------------------------------------------

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within an <AppProvider>');
  }
  return ctx;
}
