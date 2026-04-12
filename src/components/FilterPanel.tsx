import { useState, memo } from 'react';
import { ChevronDown, MapPin, Loader2 } from 'lucide-react';
import { FoodCategorySelector } from '@/components/FoodCategorySelector';
import { ServesFilterPills } from '@/components/ServesFilterPills';
import {
  AUTO_RANGE_OPTIONS,
  type AutoRangeMode,
} from '@/contexts/AppContext';
import type { ServesFilterId } from '@/lib/servesFilters';
import type { FoodCategory, Restaurant } from '@/types';

// ── Short pill labels for compact display ────────────────────────────────
const RANGE_PILL_LABEL: Record<AutoRangeMode, string> = {
  walk: 'Walking',
  drive10: '10 min',
  drive20: '20 min',
};

const PRICE_OPTIONS: Restaurant['priceRange'][] = ['$', '$$', '$$$', '$$$$'];

// ── Props ────────────────────────────────────────────────────────────────

export interface FilterPanelProps {
  // Range mode
  rangeMode: AutoRangeMode;
  onRangeModeChange: (mode: AutoRangeMode) => void;

  // Price filters
  selectedPriceRanges: Restaurant['priceRange'][];
  onTogglePriceRange: (price: Restaurant['priceRange']) => void;

  // Category filters
  selectedCategories: FoodCategory[];
  onCategoryChange: (categories: FoodCategory[]) => void;

  // Status info
  restaurantCount: number;
  isLoading: boolean;
  dataSourceLabel: string | null;
  nearbyError: string | null;

  // Availability info
  closingSoonCount: number;
  closedNowCount: number;

  /** Visit counts per category from favourites — used to boost popular categories. */
  favouriteCategoryCounts?: Partial<Record<FoodCategory, number>>;

  // Serves-filter pills
  activeServesFilters: ServesFilterId[];
  onToggleServesFilter: (id: ServesFilterId) => void;
}

// ── Component ────────────────────────────────────────────────────────────

export const FilterPanel = memo(function FilterPanel({
  rangeMode,
  onRangeModeChange,
  selectedPriceRanges,
  onTogglePriceRange,
  selectedCategories,
  onCategoryChange,
  restaurantCount,
  isLoading,
  dataSourceLabel,
  nearbyError,
  closingSoonCount,
  closedNowCount,
  favouriteCategoryCounts,
  activeServesFilters,
  onToggleServesFilter,
}: FilterPanelProps) {
  const [expanded, setExpanded] = useState(false);

  // ── Availability helper text ───────────────────────────────────────
  const availabilityHint =
    closingSoonCount > 0 && closedNowCount > 0
      ? `${closedNowCount} closed · ${closingSoonCount} closing soon`
      : closedNowCount > 0
        ? `${closedNowCount} place${closedNowCount === 1 ? '' : 's'} closed now`
        : closingSoonCount > 0
          ? `${closingSoonCount} closing soon`
          : null;

  return (
    <div className="rounded-2xl border border-eatspin-peach/60 bg-white/80 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80">
      {/* ── Status bar ─────────────────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="inline-flex items-center gap-2">
          {isLoading ? (
            <Loader2 size={15} className="animate-spin text-brand-orange" />
          ) : (
            <MapPin size={15} className="text-eatspin-success" />
          )}
          <span className="text-sm font-medium text-brand-black">
            {isLoading
              ? 'Searching nearby…'
              : `${restaurantCount} restaurant${restaurantCount === 1 ? '' : 's'} nearby`}
          </span>
        </div>

        {/* Data source + error badges */}
        <div className="flex items-center gap-2">
          {dataSourceLabel && (
            <span className="text-[11px] text-eatspin-gray-2">
              {dataSourceLabel}
            </span>
          )}
          {nearbyError && (
            <span className="text-[11px] text-eatspin-error">
              {nearbyError}
            </span>
          )}
        </div>
      </div>

      {/* ── Range pills ────────────────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {AUTO_RANGE_OPTIONS.map((opt) => {
          const active = rangeMode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onRangeModeChange(opt.id)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all duration-200 ${
                active
                  ? 'bg-brand-orange text-white shadow-md'
                  : 'border border-gray-200 bg-white text-brand-black hover:border-brand-orange hover:text-brand-orange'
              }`}
              title={opt.helper}
            >
              {RANGE_PILL_LABEL[opt.id]}
            </button>
          );
        })}
      </div>

      {/* ── Price pills ────────────────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {PRICE_OPTIONS.map((price) => {
          const active = selectedPriceRanges.includes(price);
          return (
            <button
              key={price}
              type="button"
              onClick={() => onTogglePriceRange(price)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-all duration-200 ${
                active
                  ? 'bg-brand-orange text-white shadow-md'
                  : 'border border-gray-200 bg-white text-brand-black hover:border-brand-orange hover:text-brand-orange'
              }`}
            >
              {price}
            </button>
          );
        })}

        {selectedPriceRanges.length > 0 && (
          <span className="text-[11px] text-eatspin-gray-1">
            Some places may not appear if Google hasn't mapped their price tier.
          </span>
        )}
      </div>

      {/* ── Serves-filter pills ───────────────────────────────────── */}
      <div className="mb-3">
        <p className="mb-1.5 text-xs font-medium text-eatspin-gray-2">
          I'm looking for…
        </p>
        <ServesFilterPills
          activeFilters={activeServesFilters}
          onToggle={onToggleServesFilter}
        />
      </div>

      {/* ── Availability hint ──────────────────────────────────────── */}
      {availabilityHint && (
        <p className="mb-2 text-xs text-eatspin-gray-1">{availabilityHint}</p>
      )}

      {/* ── More filters toggle ────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-black hover:text-brand-orange"
        aria-expanded={expanded}
      >
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
        {expanded ? 'Less filters' : 'More filters'}
        <span className="rounded-full bg-brand-linen px-2 py-0.5 text-xs font-normal text-eatspin-gray-1">
          {selectedCategories.length}/3 cuisines
        </span>
      </button>

      {/* ── Collapsible category selector ──────────────────────────── */}
      <div
        className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out ${
          expanded ? 'mt-3 grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="min-h-0">
          <FoodCategorySelector
            selectedCategories={selectedCategories}
            onCategoryChange={onCategoryChange}
            maxSelection={3}
            favouriteCategoryCounts={favouriteCategoryCounts}
          />
        </div>
      </div>
    </div>
  );
});
