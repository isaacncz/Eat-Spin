import { useState } from 'react';
import { MapPin, Users, Sparkles, Loader2, Search, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trackEvent } from '@/lib/analytics';
import { CravingSearch } from '@/components/CravingSearch';
import type { MealTime, Restaurant } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FoodMood = 'quick-bite' | 'treat-myself' | 'healthy' | 'surprise-me';

export interface QuickSpinHeroProps {
  currentMealTime: MealTime;
  onQuickSpin: () => void;
  onMoodSelect: (mood: FoodMood) => void;
  isSpinning: boolean;
  hasLocation: boolean;
  onRequestLocation: () => void;
  isLocationLoading: boolean;
  locationError: string | null;
  restaurantCount: number;
  onGroupSpin: () => void;
  // Restaurant context (so hero can surface 0-results reason)
  isLoadingRestaurants: boolean;
  totalNearbyCount: number;
  closedNowCount: number;
  // Craving search
  searchQuery: string;
  onSearch: (text: string) => void;
  searchResults: Restaurant[];
  isSearching: boolean;
  searchError: string | null;
  recentSearches: string[];
  onLetsGo: (restaurant: Restaurant) => void;
  onClearSearch: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOOD_OPTIONS: { id: FoodMood; emoji: string; label: string }[] = [
  { id: 'quick-bite', emoji: '🎯', label: 'Quick Bite' },
  { id: 'treat-myself', emoji: '✨', label: 'Treat Myself' },
  { id: 'healthy', emoji: '🥗', label: 'Healthy' },
  { id: 'surprise-me', emoji: '🎲', label: 'Surprise Me!' },
];

const MEAL_LABELS: Record<MealTime, string> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  none: 'eating',
};

/** Decorative emoji positioned around the edges. */
const FLOATING_EMOJIS = [
  { emoji: '🍕', className: 'top-[12%] left-[6%]', delay: '0s', duration: '7s' },
  { emoji: '🍜', className: 'top-[18%] right-[8%]', delay: '1.5s', duration: '8s' },
  { emoji: '🍔', className: 'bottom-[22%] left-[10%]', delay: '3s', duration: '6s' },
  { emoji: '🌮', className: 'bottom-[16%] right-[6%]', delay: '2s', duration: '9s' },
  { emoji: '🍣', className: 'top-[40%] left-[3%]', delay: '4s', duration: '7.5s' },
  { emoji: '🧁', className: 'top-[55%] right-[4%]', delay: '0.5s', duration: '8.5s' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuickSpinHero({
  currentMealTime,
  onQuickSpin,
  onMoodSelect,
  isSpinning,
  hasLocation,
  onRequestLocation,
  isLocationLoading,
  locationError,
  restaurantCount,
  onGroupSpin,
  isLoadingRestaurants,
  totalNearbyCount,
  closedNowCount,
  searchQuery,
  onSearch,
  searchResults,
  isSearching,
  searchError,
  recentSearches,
  onLetsGo,
  onClearSearch,
}: QuickSpinHeroProps) {
  const [selectedMood, setSelectedMood] = useState<FoodMood | null>(null);
  const [isSearchMode, setIsSearchMode] = useState(false);

  const handleMoodSelect = (mood: FoodMood) => {
    const next = selectedMood === mood ? null : mood;
    setSelectedMood(next);
    if (next) {
      trackEvent('quick_spin_mood_select', { mood: next });
      onMoodSelect(next);
    }
  };

  const handleSpin = () => {
    trackEvent('quick_spin_hero_spin', { mood: selectedMood ?? 'none', mealTime: currentMealTime });
    onQuickSpin();
  };

  const handleGroupSpin = () => {
    trackEvent('quick_spin_hero_group');
    onGroupSpin();
  };

  return (
    <section
      className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden
                 bg-gradient-to-b from-[var(--eatspin-linen)] to-white"
      style={{ paddingTop: 'var(--navbar-height, 72px)' }}
    >
      {/* ── Floating food emoji decorations ─────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {FLOATING_EMOJIS.map(({ emoji, className, delay, duration }) => (
          <span
            key={emoji}
            className={`absolute text-2xl opacity-[0.18] select-none sm:text-3xl ${className}`}
            style={{
              animation: `float ${duration} ease-in-out ${delay} infinite`,
            }}
          >
            {emoji}
          </span>
        ))}
      </div>

      {/* ── Content container ────────────────────────────────────────── */}
      <div
        className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center gap-6 px-5
                    py-6 sm:gap-8 sm:px-6 md:max-w-lg"
      >
        {/* ── Group Spin shortcut (top-right) ──────────────────────── */}
        <button
          onClick={handleGroupSpin}
          className="absolute right-5 top-0 flex items-center gap-1.5 rounded-full border
                     border-[var(--eatspin-gray-3)] bg-white/80 px-3 py-1.5 text-xs font-medium
                     text-[var(--eatspin-gray-1)] shadow-xs backdrop-blur transition-colors
                     hover:border-[var(--eatspin-orange)] hover:text-[var(--eatspin-orange)]
                     sm:right-6 hero-enter hero-enter-delay-1"
          aria-label="Start group spin"
        >
          <Users size={14} />
          <span className="hidden min-[360px]:inline">Group</span>
        </button>

        {/* ── Heading ──────────────────────────────────────────────── */}
        <div className="mt-4 text-center hero-enter hero-enter-delay-1">
          <h1 className="font-heading text-4xl font-bold leading-tight text-[var(--eatspin-black)] sm:text-5xl">
            What's for{' '}
            <span className="text-brand-orange">{MEAL_LABELS[currentMealTime]}</span>
            ? 🍽️
          </h1>
          <p className="mt-2 text-sm text-[var(--eatspin-gray-1)] sm:text-base">
            Pick your mood, then spin to decide
          </p>
        </div>

        {/* ── Food mood grid (2×2) ─────────────────────────────────── */}
        <div className="grid w-full grid-cols-2 gap-3 hero-enter hero-enter-delay-2">
          {MOOD_OPTIONS.map(({ id, emoji, label }) => {
            const isSelected = selectedMood === id;
            return (
              <button
                key={id}
                onClick={() => handleMoodSelect(id)}
                className={`flex items-center gap-2.5 rounded-2xl border-2 px-4 py-3.5
                            text-left transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]
                            ${
                              isSelected
                                ? 'border-[var(--eatspin-orange)] bg-[var(--eatspin-orange)]/[0.07] shadow-md'
                                : 'border-[var(--eatspin-gray-3)] bg-white hover:border-[var(--eatspin-peach)] hover:shadow-sm'
                            }`}
                aria-pressed={isSelected}
              >
                <span className="text-2xl leading-none">{emoji}</span>
                <span
                  className={`text-sm font-semibold sm:text-base ${
                    isSelected ? 'text-[var(--eatspin-orange)]' : 'text-[var(--eatspin-black)]'
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Restaurant context (surface 0-results in hero) ──────── */}
        {hasLocation && !isSearchMode && (
          <div className="w-full hero-enter hero-enter-delay-2">
            {isLoadingRestaurants ? (
              <p className="flex items-center justify-center gap-2 text-xs text-[var(--eatspin-gray-2)]">
                <Loader2 className="size-3.5 animate-spin" />
                Finding restaurants nearby…
              </p>
            ) : restaurantCount === 0 && totalNearbyCount > 0 && closedNowCount >= totalNearbyCount ? (
              /* Every single nearby place is closed */
              <div className="rounded-xl border border-[var(--eatspin-gray-3)] bg-white/80 px-4 py-3 text-center">
                <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-[var(--eatspin-black)]">
                  <Moon className="size-4 text-[var(--eatspin-gray-1)]" />
                  {closedNowCount} place{closedNowCount === 1 ? '' : 's'} nearby — all closed now
                </p>
                <p className="mt-1 text-xs text-[var(--eatspin-gray-2)]">
                  Check back during meal hours, or try searching below
                </p>
              </div>
            ) : restaurantCount === 0 && totalNearbyCount > 0 ? (
              /* Some combination of filters + closures → 0 results */
              <div className="rounded-xl border border-[var(--eatspin-peach)]/60 bg-white/80 px-4 py-3 text-center">
                <p className="text-sm font-medium text-[var(--eatspin-black)]">
                  😕 No restaurants match right now
                </p>
                <p className="mt-1 text-xs text-[var(--eatspin-gray-2)]">
                  {closedNowCount > 0
                    ? `${closedNowCount} closed now · try different filters or a wider range`
                    : 'Try different categories or a wider range below'}
                </p>
              </div>
            ) : restaurantCount > 0 ? (
              /* Happy path */
              <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-[var(--eatspin-gray-1)] sm:text-sm">
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full
                                 bg-brand-orange/10 px-1.5 text-[11px] font-bold text-brand-orange">
                  {restaurantCount}
                </span>
                restaurants ready nearby
              </p>
            ) : null}
          </div>
        )}

        {/* ── Primary CTA area ─────────────────────────────────────── */}
        <div className="flex w-full flex-col items-center gap-3 hero-enter hero-enter-delay-3">
          {hasLocation ? (
            isSearchMode ? (
              /* ── Search mode ──────────────────────────────────────── */
              <div className="w-full space-y-3">
                <button
                  onClick={() => {
                    setIsSearchMode(false);
                    onClearSearch();
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold
                             text-brand-orange transition-colors hover:underline"
                >
                  ← Back to Spin
                </button>
                <CravingSearch
                  query={searchQuery}
                  onSearch={onSearch}
                  results={searchResults}
                  isLoading={isSearching}
                  error={searchError}
                  recentSearches={recentSearches}
                  onLetsGo={onLetsGo}
                  onClear={onClearSearch}
                />
              </div>
            ) : (
              <>
              {/* SPIN NOW button */}
              <Button
                onClick={handleSpin}
                disabled={isSpinning || restaurantCount === 0}
                className={`group relative h-16 w-full rounded-2xl text-lg font-bold
                            text-white shadow-lg transition-all duration-300
                            disabled:opacity-70 disabled:hover:scale-100
                            sm:h-[72px] sm:text-xl font-heading
                            ${restaurantCount > 0
                              ? 'bg-brand-orange hover:scale-105 hover:shadow-xl animate-cta-pulse'
                              : 'bg-[var(--eatspin-gray-2)] cursor-not-allowed'
                            }`}
              >
                {/* Pulsing ring (only when spinnable) */}
                {restaurantCount > 0 && (
                  <span
                    className="absolute inset-0 -z-10 rounded-2xl animate-pulse-ring"
                    aria-hidden
                  />
                )}

                {isSpinning ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-5 animate-spin" />
                    Spinning…
                  </span>
                ) : restaurantCount === 0 ? (
                  <span className="flex items-center gap-2 opacity-80">
                    No restaurants to spin
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Sparkles className="size-5 transition-transform group-hover:rotate-12" />
                    SPIN NOW!
                  </span>
                )}
              </Button>

              {/* Search toggle link */}
              <button
                onClick={() => {
                  setIsSearchMode(true);
                  trackEvent('search_mode_open');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold
                           text-brand-orange underline underline-offset-2
                           transition-colors hover:text-brand-orange/80"
              >
                <Search size={16} />
                Know what you want? Search instead
              </button>
            </>
            )
          ) : (
            /* ── Location request card ──────────────────────────────── */
            <div className="flex w-full flex-col items-center gap-3 rounded-2xl border
                            border-[var(--eatspin-gray-3)] bg-white p-5 shadow-sm">
              <MapPin className="size-8 text-brand-orange" />
              <p className="text-center text-sm text-[var(--eatspin-black)] sm:text-base">
                Enable location to find restaurants around you
              </p>

              {locationError && (
                <p className="text-center text-xs text-[var(--eatspin-error)]">
                  {locationError}
                </p>
              )}

              <Button
                onClick={() => {
                  trackEvent('quick_spin_hero_location_request');
                  onRequestLocation();
                }}
                disabled={isLocationLoading}
                className="h-12 w-full rounded-xl bg-brand-orange font-heading text-base font-bold
                           text-white shadow-md transition-all hover:scale-105 hover:shadow-lg
                           disabled:opacity-70 disabled:hover:scale-100"
              >
                {isLocationLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Locating…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <MapPin className="size-4" />
                    Share My Location
                  </span>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* ── Group Spin secondary CTA ─────────────────────────────── */}
        {hasLocation && (
          <div className="flex items-center gap-2 text-sm text-[var(--eatspin-gray-2)] hero-enter hero-enter-delay-4">
            <span>or</span>
            <button
              onClick={handleGroupSpin}
              className="inline-flex items-center gap-1 font-semibold text-[var(--eatspin-orange)]
                         underline-offset-2 transition-colors hover:underline"
            >
              Start Group Spin
              <span aria-hidden>→</span>
            </button>
          </div>
        )}

        {/* ── Scroll indicator (hide when nothing to customize) ────── */}
        {hasLocation && restaurantCount > 0 && (
          <div className="mt-auto pt-4 hero-enter hero-enter-delay-4">
            <button
              onClick={() => {
                const main = document.getElementById('app-main-section');
                if (main) main.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex flex-col items-center gap-1 text-[var(--eatspin-gray-2)]
                         transition-colors hover:text-[var(--eatspin-orange)]"
              aria-label="Scroll to filters"
            >
              <span className="text-[11px] font-medium uppercase tracking-wider">Customize</span>
              <svg
                width="20" height="20" viewBox="0 0 20 20" fill="none"
                className="animate-bounce"
              >
                <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* ── CSS keyframes for enter animations (scoped via class) ──── */}
      <style>{heroEnterCSS}</style>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Scoped CSS for staggered enter animations
// ---------------------------------------------------------------------------

const heroEnterCSS = /* css */ `
  @keyframes hero-fade-up {
    from {
      opacity: 0;
      transform: translateY(18px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .hero-enter {
    animation: hero-fade-up 0.6s ease-out both;
  }
  .hero-enter-delay-1 { animation-delay: 0.1s; }
  .hero-enter-delay-2 { animation-delay: 0.25s; }
  .hero-enter-delay-3 { animation-delay: 0.4s; }
  .hero-enter-delay-4 { animation-delay: 0.55s; }
`;
