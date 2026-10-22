import { memo, useMemo, type ButtonHTMLAttributes, type ReactNode } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AUTO_RANGE_OPTIONS, type AutoRangeMode } from '@/contexts/AppContext';
import { cuisineCategories, foodCategories } from '@/data/restaurants';
import { trackEvent } from '@/lib/analytics';
import {
  buildShowPlacesLabel,
  MAX_CATEGORY_SELECTION,
  RANGE_SHORT_LABEL,
} from '@/lib/filterSummary';
import { SERVES_FILTERS, type ServesFilterId } from '@/lib/servesFilters';
import { cn } from '@/lib/utils';
import type { FoodCategory, Restaurant } from '@/types';

const PRICE_OPTIONS: Restaurant['priceRange'][] = ['$', '$$', '$$$', '$$$$'];

export interface FiltersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The button that opens the sheet. Focus returns to it when the sheet closes. */
  trigger: ReactNode;

  rangeMode: AutoRangeMode;
  onRangeModeChange: (mode: AutoRangeMode) => void;
  selectedPriceRanges: Restaurant['priceRange'][];
  onTogglePriceRange: (price: Restaurant['priceRange']) => void;
  selectedCategories: FoodCategory[];
  onCategoryChange: (categories: FoodCategory[]) => void;
  activeServesFilters: ServesFilterId[];
  onToggleServesFilter: (id: ServesFilterId) => void;
  /** Puts every filter, including the range, back to its default. */
  onReset: () => void;
  /** Visit counts per category from favourites; the most visited cuisines are listed first. */
  favouriteCategoryCounts?: Partial<Record<FoodCategory, number>>;

  /** Places that would be on the wheel right now; null until there is a location. */
  placeCount: number | null;
  isLoading: boolean;
  dataSourceLabel: string | null;
  nearbyError: string | null;
  closingSoonCount: number;
  closedNowCount: number;
}

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pressed: boolean;
  /** Background of the chip while it is on. Text stays ink on every bright colour. */
  tone: string;
}

/** 44px toggle chip. Selected state is carried by aria-pressed, a bolder weight and a fill. */
function Chip({ pressed, tone, className, children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border-[3px] border-brand-ink px-4 font-heading text-[15px] text-brand-ink',
        'outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-brand-ink focus-visible:ring-offset-2 motion-reduce:transition-none',
        'disabled:cursor-not-allowed disabled:opacity-40',
        pressed ? cn(tone, 'font-bold') : 'bg-white font-semibold hover:bg-arcade-yellow/50',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h3 className="font-heading text-sm font-semibold text-eatspin-gray-1">{title}</h3>
        {hint && <span className="font-heading text-xs font-semibold text-eatspin-gray-1">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/**
 * Filters as a bottom sheet (Radix dialog, so focus is trapped and Esc closes it).
 * Every tap applies at once: the count in the pinned button is the live number of
 * places on the wheel, and the button only closes the sheet. The handle is decoration.
 */
export const FiltersSheet = memo(function FiltersSheet({
  open,
  onOpenChange,
  trigger,
  rangeMode,
  onRangeModeChange,
  selectedPriceRanges,
  onTogglePriceRange,
  selectedCategories,
  onCategoryChange,
  activeServesFilters,
  onToggleServesFilter,
  onReset,
  favouriteCategoryCounts,
  placeCount,
  isLoading,
  dataSourceLabel,
  nearbyError,
  closingSoonCount,
  closedNowCount,
}: FiltersSheetProps) {
  const sortedCategories = useMemo(() => {
    // Quick picks can select dish types (rice, vegetarian...) that are not in the cuisine list.
    // Show them first so they can be turned off here.
    const extras = foodCategories.filter(
      (category) => selectedCategories.includes(category.id) && !cuisineCategories.includes(category),
    );
    const cuisines = favouriteCategoryCounts
      ? [...cuisineCategories].sort(
          (a, b) => (favouriteCategoryCounts[b.id] ?? 0) - (favouriteCategoryCounts[a.id] ?? 0),
        )
      : cuisineCategories;
    return [...extras, ...cuisines];
  }, [favouriteCategoryCounts, selectedCategories]);

  const toggleCategory = (id: FoodCategory) => {
    if (selectedCategories.includes(id)) {
      const next = selectedCategories.filter((category) => category !== id);
      trackEvent('category_deselected', { category: id, selected_count: next.length });
      onCategoryChange(next);
      return;
    }
    if (selectedCategories.length >= MAX_CATEGORY_SELECTION) return;
    const next = [...selectedCategories, id];
    trackEvent('category_selected', { category: id, selected_count: next.length });
    onCategoryChange(next);
  };

  const handleReset = () => {
    trackEvent('filters_reset');
    onReset();
  };

  const availabilityHint =
    closingSoonCount > 0 && closedNowCount > 0
      ? `${closedNowCount} closed · ${closingSoonCount} closing soon`
      : closedNowCount > 0
        ? `${closedNowCount} place${closedNowCount === 1 ? '' : 's'} closed now`
        : closingSoonCount > 0
          ? `${closingSoonCount} closing soon`
          : null;
  const statusLines = [availabilityHint, dataSourceLabel].filter(Boolean) as string[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className={cn(
          // Bottom sheet: pinned to the bottom edge of the 480px column instead of centred.
          'inset-x-0 top-auto bottom-0 mx-auto flex h-[min(690px,calc(100dvh-1.5rem))] w-full max-w-[480px] translate-x-0 translate-y-0 flex-col gap-0',
          'rounded-b-none rounded-t-[28px] border-b-0 bg-white p-0 shadow-none sm:max-w-[480px]',
          // The dialog's zoom-95 would shrink the sheet while it slides; tailwind-merge cannot drop it, so override.
          'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom data-[state=open]:!zoom-in-100 data-[state=closed]:!zoom-out-100',
        )}
      >
        <div aria-hidden="true" className="mx-auto mt-2.5 h-1.5 w-12 shrink-0 rounded-full bg-brand-ink" />

        <div className="flex shrink-0 items-center justify-between px-5 pb-1 pt-1.5">
          <DialogTitle className="text-[26px]">Filters</DialogTitle>
          <button
            type="button"
            onClick={handleReset}
            className="min-h-11 rounded-lg px-2 font-heading text-base font-semibold text-[#B01B58] underline outline-none focus-visible:ring-[3px] focus-visible:ring-brand-ink"
          >
            Reset
          </button>
        </div>
        <DialogDescription className="sr-only">
          Choose how far to look, price, food type and what a place serves. The number on the
          button at the bottom is how many places are on the wheel.
        </DialogDescription>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-4 pt-1">
          {(statusLines.length > 0 || nearbyError) && (
            <div className="space-y-0.5 text-xs text-eatspin-gray-1">
              {statusLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
              {nearbyError && <p className="font-semibold text-eatspin-error">{nearbyError}</p>}
            </div>
          )}

          <Section title="How far?">
            <div role="group" aria-label="How far" className="grid grid-cols-3 gap-2">
              {AUTO_RANGE_OPTIONS.map((option) => {
                const pressed = rangeMode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => onRangeModeChange(option.id)}
                    className={cn(
                      'flex min-h-14 flex-col items-center justify-center rounded-[14px] border-[3px] border-brand-ink px-1 font-heading text-brand-ink',
                      'outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-brand-ink focus-visible:ring-offset-2 motion-reduce:transition-none',
                      pressed
                        ? 'bg-arcade-pink shadow-[0_3px_0_#1E1B4B]'
                        : 'bg-white hover:bg-arcade-yellow/50',
                    )}
                  >
                    <span className={cn('text-[15px]', pressed ? 'font-bold' : 'font-semibold')}>
                      {RANGE_SHORT_LABEL[option.id]}
                    </span>
                    <span className="text-xs font-medium">{option.helper}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Price">
            <div role="group" aria-label="Price" className="grid grid-cols-4 gap-2">
              {PRICE_OPTIONS.map((price) => (
                <Chip
                  key={price}
                  pressed={selectedPriceRanges.includes(price)}
                  tone="bg-arcade-lime"
                  onClick={() => onTogglePriceRange(price)}
                  className="px-1"
                >
                  {price}
                </Chip>
              ))}
            </div>
            {selectedPriceRanges.length > 0 && (
              <p className="mt-1.5 text-xs text-eatspin-gray-1">
                Some places may not appear if Google hasn't mapped their price tier.
              </p>
            )}
          </Section>

          <Section
            title="Food type"
            hint={`${selectedCategories.length}/${MAX_CATEGORY_SELECTION} picked`}
          >
            <div role="group" aria-label="Food type" className="flex flex-wrap gap-2">
              {sortedCategories.map((category) => {
                const pressed = selectedCategories.includes(category.id);
                return (
                  <Chip
                    key={category.id}
                    pressed={pressed}
                    tone="bg-arcade-cyan"
                    disabled={!pressed && selectedCategories.length >= MAX_CATEGORY_SELECTION}
                    onClick={() => toggleCategory(category.id)}
                  >
                    <span aria-hidden="true">{category.icon}</span>
                    {category.name}
                  </Chip>
                );
              })}
            </div>
          </Section>

          <Section title="Also serves">
            <div role="group" aria-label="Filter by what's served" className="flex flex-wrap gap-2">
              {SERVES_FILTERS.map(({ id, label, emoji }) => (
                <Chip
                  key={id}
                  pressed={activeServesFilters.includes(id)}
                  tone="bg-arcade-violet"
                  onClick={() => onToggleServesFilter(id)}
                >
                  <span aria-hidden="true">{emoji}</span>
                  {label}
                </Chip>
              ))}
            </div>
          </Section>
        </div>

        <div className="shrink-0 border-t-[3px] border-brand-ink px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={cn(
              'h-14 w-full rounded-[18px] border-4 border-brand-ink bg-arcade-pink font-heading text-xl font-bold text-brand-ink shadow-[0_5px_0_#1E1B4B]',
              'outline-none transition-transform focus-visible:ring-[3px] focus-visible:ring-brand-ink focus-visible:ring-offset-2',
              'active:translate-y-[3px] active:shadow-[0_2px_0_#1E1B4B] motion-reduce:transition-none',
            )}
          >
            {buildShowPlacesLabel(placeCount, isLoading)}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
});
