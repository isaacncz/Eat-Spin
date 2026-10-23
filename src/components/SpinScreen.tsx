import { useEffect, useState, type ReactNode } from 'react';
import { ChevronRight, Crown, Loader2, MapPin, Search, SlidersHorizontal } from 'lucide-react';

import { DestinationPicker, type DestinationPickerProps } from '@/components/DestinationPicker';
import { CravingSearch } from '@/components/CravingSearch';
import { FiltersSheet, type FiltersSheetProps } from '@/components/FiltersSheet';
import { QuestCard } from '@/components/QuestCard';
import { SpinHud } from '@/components/SpinHud';
import { trackEvent } from '@/lib/analytics';
import {
  buildFilterButtonLabel,
  buildFilterSummary,
  countActiveFilters,
} from '@/lib/filterSummary';
import { MEAL_HEADING_WORD, MOOD_OPTIONS, type FoodMood } from '@/lib/foodMoods';
import { cn } from '@/lib/utils';
import type { MealTime, Restaurant } from '@/types';

type FilterControls = Pick<
  FiltersSheetProps,
  | 'radiusKm'
  | 'onRadiusChange'
  | 'openNowOnly'
  | 'onOpenNowChange'
  | 'selectedPriceRanges'
  | 'onTogglePriceRange'
  | 'selectedCategories'
  | 'onCategoryChange'
  | 'activeServesFilters'
  | 'onToggleServesFilter'
  | 'onReset'
  | 'favouriteCategoryCounts'
  | 'dataSourceLabel'
  | 'nearbyError'
  | 'closingSoonCount'
  | 'closedNowCount'
>;

export interface SpinScreenProps {
  destinationSearch?: DestinationPickerProps;
  hud: { level: number; xpIntoLevel: number; xpPerLevel: number; coins: number; streak: number };
  quest: { title: string; rewardXp: number; progress: number; target: number; completed: boolean };
  mealTime: MealTime;
  onMoodSelect: (mood: FoodMood) => void;

  hasLocation: boolean;
  isLocationLoading: boolean;
  locationError: string | null;
  onRequestLocation: () => void;

  filters: FilterControls;
  /** Places that pass the filters right now (what "N places" means). */
  placeCount: number;
  isLoadingPlaces: boolean;
  /** Why the wheel is empty when places exist but none pass the filters. */
  emptyState: { title: string; subtitle: string; action?: { label: string; onClick: () => void } } | null;
  /** Set while the monthly nearby-search budget is used up. */
  budgetBlocked: { used: number; cap: number } | null;

  /** The wheel (and its result card), or null while there is nothing to spin. */
  wheel: ReactNode;
  /** Wheel has at least two places on it. */
  canSpin: boolean;
  isSpinning: boolean;
  onSpin: () => void;

  limitWarning: ReactNode;
  isPremium: boolean;
  roundReview: ReactNode;
  pwaBanner: ReactNode;

  search: {
    query: string;
    onSearch: (text: string) => void;
    results: Restaurant[];
    isLoading: boolean;
    error: string | null;
    recentSearches: string[];
    onLetsGo: (restaurant: Restaurant) => void;
    onClear: () => void;
  };
}

const CTA_BASE =
  'flex h-16 w-full items-center justify-center gap-2 rounded-[20px] border-4 border-brand-ink bg-arcade-pink font-heading font-bold text-brand-ink shadow-pop-lg outline-none ' +
  'transition-transform focus-visible:ring-[3px] focus-visible:ring-brand-ink focus-visible:ring-offset-2 active:translate-y-[3px] active:shadow-none ' +
  'disabled:cursor-not-allowed disabled:bg-white disabled:opacity-70 disabled:shadow-none motion-reduce:transition-none';

/**
 * Spin tab: HUD, "What's for lunch?", quick picks, a one-line Filters button, the wheel and
 * one Spin button pinned above the tab bar. All state lives in App; this only lays it out.
 */
export function SpinScreen({
  destinationSearch,
  hud,
  quest,
  mealTime,
  onMoodSelect,
  hasLocation,
  isLocationLoading,
  locationError,
  onRequestLocation,
  filters,
  placeCount,
  isLoadingPlaces,
  emptyState,
  budgetBlocked,
  wheel,
  canSpin,
  isSpinning,
  onSpin,
  limitWarning,
  isPremium,
  roundReview,
  pwaBanner,
  search,
}: SpinScreenProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedMood, setSelectedMood] = useState<FoodMood | null>(null);
  const [isSearchMode, setIsSearchMode] = useState(false);

  // The pinned button sits over the bottom of the page, so anything scrolled into view (such as
  // the "Your pick" button that takes focus when the result view closes) must clear it as well
  // as the tab bar.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('scroll-padding-bottom', 'calc(var(--bottom-nav-height) + 5.5rem)');
    return () => {
      root.style.removeProperty('scroll-padding-bottom');
    };
  }, []);

  const isEmpty = hasLocation && !isLoadingPlaces && placeCount === 0;
  const showWheel = hasLocation && placeCount > 0;

  const summary = buildFilterSummary(filters.radiusKm, hasLocation ? placeCount : null, hasLocation && isLoadingPlaces);
  const activeFilterCount = countActiveFilters({
    categories: filters.selectedCategories,
    priceRanges: filters.selectedPriceRanges,
    servesFilters: filters.activeServesFilters,
  });

  const handleMood = (mood: FoodMood) => {
    const next = selectedMood === mood ? null : mood;
    setSelectedMood(next);
    if (!next) return;
    trackEvent('quick_spin_mood_select', { mood: next });
    onMoodSelect(next);
  };

  const handleFiltersOpenChange = (open: boolean) => {
    if (open) trackEvent('filters_sheet_open');
    setFiltersOpen(open);
  };

  const openSearch = () => {
    trackEvent('search_mode_open');
    setIsSearchMode(true);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  };

  const closeSearch = () => {
    setIsSearchMode(false);
    search.onClear();
  };

  // Pinned button: it is always the next useful step, so it also covers the states
  // where there is nothing to spin yet.
  let cta: { label: string; disabled: boolean; onClick: () => void; spin: boolean; icon?: ReactNode };
  if (!hasLocation) {
    cta = {
      label: isLocationLoading ? 'Locating…' : 'Share My Location',
      disabled: isLocationLoading,
      onClick: () => {
        trackEvent('quick_spin_hero_location_request');
        onRequestLocation();
      },
      spin: false,
      icon: isLocationLoading ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <MapPin className="size-5" aria-hidden="true" />,
    };
  } else if (isLoadingPlaces && placeCount === 0) {
    cta = { label: 'Finding places…', disabled: true, onClick: onSpin, spin: false, icon: <Loader2 className="size-5 animate-spin" aria-hidden="true" /> };
  } else if (placeCount === 0) {
    // Nothing to spin: the pinned button becomes the fix (widen, include closed, reset round).
    cta = emptyState?.action
      ? { label: emptyState.action.label, disabled: false, onClick: emptyState.action.onClick, spin: false }
      : { label: 'Open filters', disabled: false, onClick: () => handleFiltersOpenChange(true), spin: false, icon: <SlidersHorizontal className="size-5" aria-hidden="true" /> };
  } else if (isSpinning) {
    cta = { label: 'Spinning…', disabled: true, onClick: onSpin, spin: false, icon: <Loader2 className="size-5 animate-spin" aria-hidden="true" /> };
  } else if (placeCount < 2) {
    cta = { label: 'Need 2+ places', disabled: true, onClick: onSpin, spin: false };
  } else {
    cta = { label: 'Spin!', disabled: !canSpin, onClick: onSpin, spin: true };
  }

  return (
    <div className="flex min-h-[calc(100dvh-var(--bottom-nav-height))] flex-col">
      {!isSearchMode && <SpinHud {...hud} />}

      {!isSearchMode && <div className="flex items-start justify-between gap-3 px-5 pt-3">
        <h1 className="font-heading text-[30px] font-bold leading-[1.1] text-brand-ink">
          What's for {MEAL_HEADING_WORD[mealTime]}?
        </h1>
        {hasLocation && !isSearchMode && (
          <button
            type="button"
            onClick={openSearch}
            aria-label="Search instead"
            title="Know what you want? Search instead"
            className="-mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full border-[3px] border-brand-ink bg-white text-brand-ink outline-none hover:bg-arcade-yellow/50 focus-visible:ring-[3px] focus-visible:ring-brand-ink focus-visible:ring-offset-2"
          >
            <Search size={20} strokeWidth={2.5} aria-hidden="true" />
          </button>
        )}
      </div>}


      {isSearchMode ? (
        <div className="space-y-2 px-5 pb-6 pt-2">
          <button
            type="button"
            onClick={closeSearch}
            className="inline-flex min-h-11 items-center rounded-lg font-heading text-sm font-semibold text-brand-ink underline underline-offset-2 outline-none focus-visible:ring-[3px] focus-visible:ring-brand-ink"
          >
            ← Back to Spin
          </button>
          {destinationSearch && <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-ink" aria-label="Food search area">Within {filters.radiusKm} km of {destinationSearch.destination?.label ?? 'your current location'}</p>
            <DestinationPicker {...destinationSearch} triggerLabel="Change area" />
          </div>}
          <CravingSearch
            areaSearchAction={destinationSearch && search.query.trim() ? <DestinationPicker {...destinationSearch} triggerLabel={`Search “${search.query.trim()}” as an area`} initialQuery={search.query.trim()} /> : undefined}
            query={search.query}
            distanceOrigin={destinationSearch?.destination?.label}
            onSearch={search.onSearch}
            results={search.results}
            isLoading={search.isLoading}
            error={search.error}
            recentSearches={search.recentSearches}
            onLetsGo={search.onLetsGo}
            onClear={search.onClear}
          />
        </div>
      ) : (
        <>
          <div className="flex items-center">
          {destinationSearch && <DestinationPicker {...destinationSearch} />}
          <div
            role="group"
            aria-label="Quick picks"
            className={cn('mt-2 flex min-w-0 flex-1 gap-2 overflow-x-auto overscroll-x-contain py-1 pr-5 scrollbar-hide', destinationSearch ? 'pl-2' : 'pl-5')}
          >
            {MOOD_OPTIONS.map(({ id, label }) => {
              const pressed = selectedMood === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => handleMood(id)}
                  className={cn(
                    'inline-flex h-11 shrink-0 items-center rounded-full border-[3px] border-brand-ink px-4 font-heading text-[15px] font-semibold text-brand-ink outline-none',
                    'transition-colors focus-visible:ring-[3px] focus-visible:ring-brand-ink focus-visible:ring-offset-2 motion-reduce:transition-none',
                    pressed ? 'bg-arcade-pink font-bold' : 'bg-white hover:bg-arcade-yellow/50',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          </div>

          <div className="px-5 pt-2">
            <FiltersSheet
              open={filtersOpen}
              onOpenChange={handleFiltersOpenChange}
              {...filters}
              destinationLabel={destinationSearch?.destination?.label ?? null}
              emptyAction={emptyState?.action}
              onCategoryChange={(categories) => {
                setSelectedMood(null);
                filters.onCategoryChange(categories);
              }}
              onReset={() => {
                setSelectedMood(null);
                filters.onReset();
              }}
              placeCount={hasLocation ? placeCount : null}
              isLoading={hasLocation && isLoadingPlaces}
              trigger={(
                <button
                  type="button"
                  aria-label={buildFilterButtonLabel(summary, activeFilterCount)}
                  className="flex h-12 w-full items-center gap-2.5 rounded-2xl border-[3px] border-brand-ink bg-white px-3.5 font-heading text-[15px] font-semibold text-brand-ink shadow-[0_3px_0_#1E1B4B] outline-none transition-transform focus-visible:ring-[3px] focus-visible:ring-brand-ink focus-visible:ring-offset-2 active:translate-y-[2px] active:shadow-[0_1px_0_#1E1B4B] motion-reduce:transition-none"
                >
                  <SlidersHorizontal size={20} strokeWidth={2.5} aria-hidden="true" className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-left">{summary}</span>
                  {activeFilterCount > 0 && (
                    <span
                      aria-hidden="true"
                      className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-orange text-xs font-bold text-white"
                    >
                      {activeFilterCount}
                    </span>
                      )}
                      <ChevronRight size={18} strokeWidth={3} aria-hidden="true" className="shrink-0" />
                    </button>
              )}
            />
            {destinationSearch?.destination && (
              <p translate="no" className="mt-1 text-right font-sans text-[11px] font-normal leading-none text-[#5E5E5E]">Google Maps</p>
            )}
          </div>

          {budgetBlocked && (
            <div
              role="alert"
              className="mx-5 mt-3 rounded-2xl border-[3px] border-brand-ink bg-white px-4 py-3 text-sm font-semibold text-brand-ink"
            >
              Nearby spins are paused: the monthly search budget is used up ({budgetBlocked.used}/{budgetBlocked.cap}). Your own list still works, and nearby spins return next month.
            </div>
          )}

          <div className="flex flex-1 flex-col justify-center px-5">
            {!hasLocation && (
              <div className="my-4 rounded-2xl border-[3px] border-brand-ink bg-white p-5 text-center shadow-pop">
                <MapPin size={32} aria-hidden="true" className="mx-auto text-brand-orange" />
                <p className="mt-2 font-heading text-lg font-semibold text-brand-ink">
                  Choose a destination or use your location
                </p>
                <p className="mt-1 text-sm text-eatspin-gray-1">
                  Search an area above, or share your current location to find nearby food.
                </p>
                {locationError && (
                  <p role="alert" className="mt-2 text-sm font-semibold text-eatspin-error">
                    {locationError}
                  </p>
                )}
              </div>
            )}

            {hasLocation && isLoadingPlaces && placeCount === 0 && (
              <p
                role="status"
                className="my-6 flex items-center justify-center gap-2 font-heading text-base font-semibold text-brand-ink"
              >
                <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                Finding restaurants nearby…
              </p>
            )}

            {isEmpty && (
              <div className="my-4 rounded-2xl border-[3px] border-brand-ink bg-white p-5 text-center shadow-pop">
                <p className="font-heading text-lg font-semibold text-brand-ink">
                  {emptyState?.title ?? 'No restaurants found nearby yet.'}
                </p>
                <p className="mt-1 text-sm text-eatspin-gray-1">
                  {emptyState?.subtitle ?? 'Try a wider range in Filters, or check back during meal hours.'}
                </p>
                {emptyState?.action && (
                  <button
                    type="button"
                    onClick={() => handleFiltersOpenChange(true)}
                    className="mt-3 inline-flex min-h-11 items-center rounded-full border-[3px] border-brand-ink bg-white px-4 font-heading text-[15px] font-bold text-brand-ink outline-none focus-visible:ring-[3px] focus-visible:ring-brand-ink focus-visible:ring-offset-2"
                  >
                    Open filters
                  </button>
                )}
              </div>
            )}

            {showWheel && wheel}
          </div>

          <div className="space-y-3 px-5 pb-4 pt-2">
            {limitWarning}
            {showWheel && roundReview}
            {pwaBanner}
            {isPremium && (
              <div className="text-center">
                <div className="inline-flex items-center gap-2 rounded-full border-2 border-brand-ink bg-arcade-yellow px-4 py-2 text-sm font-semibold text-brand-ink shadow-pop">
                  <Crown size={16} aria-hidden="true" />
                  Premium Member - Unlimited Spins
                </div>
              </div>
            )}
          </div>

          <div className="px-1">
            <QuestCard {...quest} />
          </div>
          <div className="h-4" aria-hidden="true" />

          {/* Pinned above the tab bar. --bottom-nav-height already includes the safe area. */}
          <div className="sticky bottom-[var(--bottom-nav-height)] z-30 mt-auto bg-arcade-yellow px-5 pb-3 pt-2 before:pointer-events-none before:absolute before:inset-x-0 before:-top-4 before:h-4 before:bg-gradient-to-t before:from-arcade-yellow before:to-transparent">
            <button
              type="button"
              onClick={cta.onClick}
              disabled={cta.disabled}
              className={cn(
                CTA_BASE,
                cta.spin ? 'text-[28px] uppercase tracking-[0.06em]' : 'text-xl',
              )}
            >
              {cta.icon}
              {cta.label}
            </button>
          </div>

        </>
      )}
    </div>
  );
}
