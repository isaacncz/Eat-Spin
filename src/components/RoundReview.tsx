import { useId, useState } from 'react';
import { ChevronDown, Heart, RotateCcw, X } from 'lucide-react';

import type { Restaurant } from '@/types';

interface RoundReviewProps {
  /** How many places are still in this round. */
  remainingCount: number;
  /** The rows to list (the first page, or all of them). */
  restaurants: Restaurant[];
  /** Rows shown before "Show all". */
  previewCount: number;
  showAll: boolean;
  onToggleShowAll: () => void;
  isFavourite: (restaurant: Restaurant) => boolean;
  onSave: (restaurant: Restaurant) => void;
  onRemove: (restaurantId: string) => void;
  /** Brings back removed places and clears the wheel. */
  onResetRound: () => void;
  /** Travel time text for a straight-line distance in km. */
  formatTravel: (distanceKm: number) => string;
}

const ACTION =
  'inline-flex min-h-11 items-center justify-center gap-1 rounded-full border-2 px-3 font-heading text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-brand-ink';

/** "Review this round": drop places from this round or save them. Collapsed until opened. */
export function RoundReview({
  remainingCount,
  restaurants,
  previewCount,
  showAll,
  onToggleShowAll,
  isFavourite,
  onSave,
  onRemove,
  onResetRound,
  formatTravel,
}: RoundReviewProps) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();

  return (
    <section aria-label="Review this round" className="rounded-2xl border-[3px] border-brand-ink bg-white p-2">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls={listId}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-brand-ink"
      >
        <span className="flex items-center gap-2">
          <ChevronDown
            size={20}
            aria-hidden="true"
            className={`transition-transform duration-200 motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
          />
          <span className="font-heading text-base font-semibold text-brand-ink">Review this round</span>
        </span>
        <span className="font-heading text-sm font-semibold text-eatspin-gray-1">{remainingCount} left</span>
      </button>

      {expanded && (
        <div id={listId} className="px-1 pb-1 pt-2">
          <ul className="max-h-72 space-y-2 overflow-y-auto overscroll-contain pr-1">
            {restaurants.map((restaurant) => {
              const saved = isFavourite(restaurant);
              return (
                <li
                  key={restaurant.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-brand-linen px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-heading font-semibold text-brand-ink">{restaurant.name}</p>
                    <p className="truncate text-xs capitalize text-eatspin-gray-1">
                      {[
                        ...restaurant.category.slice(0, 2),
                        restaurant.priceRange,
                        restaurant.distance !== undefined ? formatTravel(restaurant.distance) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {saved ? (
                      <span
                        className={`${ACTION} border-brand-ink bg-arcade-pink/30 text-brand-ink`}
                        title="Already in My Favourites"
                      >
                        <Heart size={14} aria-hidden="true" className="fill-arcade-pink" /> Saved
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSave(restaurant)}
                        aria-label={`Save ${restaurant.name} to favourites`}
                        className={`${ACTION} border-brand-ink bg-white text-brand-ink hover:bg-arcade-pink/20`}
                      >
                        <Heart size={14} aria-hidden="true" /> Save
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemove(restaurant.id)}
                      aria-label={`Remove ${restaurant.name} for this round`}
                      className={`${ACTION} border-brand-ink bg-white text-brand-ink hover:bg-arcade-yellow/50`}
                    >
                      <X size={14} aria-hidden="true" /> Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {remainingCount > previewCount && (
              <button
                type="button"
                onClick={onToggleShowAll}
                className={`${ACTION} border-brand-ink bg-white text-brand-ink hover:bg-brand-linen`}
              >
                {showAll ? `Show first ${previewCount}` : `Show all ${remainingCount}`}
              </button>
            )}
            <button
              type="button"
              onClick={onResetRound}
              className={`${ACTION} border-brand-ink bg-white text-brand-ink hover:bg-brand-linen`}
            >
              <RotateCcw size={14} aria-hidden="true" /> Reset round
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
