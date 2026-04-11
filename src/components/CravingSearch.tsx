import { useState, useRef, useEffect } from 'react';
import { Search, Star, MapPin, Navigation, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Restaurant } from '@/types';

// ---------------------------------------------------------------------------
// Popular quick-search chips
// ---------------------------------------------------------------------------

const POPULAR_CHIPS = [
  { label: '☕ Coffee', query: 'coffee' },
  { label: '🍗 Chicken Rice', query: 'chicken rice' },
  { label: '🧋 Bubble Tea', query: 'bubble tea' },
  { label: '🍜 Laksa', query: 'laksa' },
  { label: '🍕 Pizza', query: 'pizza' },
  { label: '🍔 Burger', query: 'burger' },
  { label: '🍣 Sushi', query: 'sushi' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CravingSearchProps {
  query: string;
  onSearch: (text: string) => void;
  results: Restaurant[];
  isLoading: boolean;
  error: string | null;
  recentSearches: string[];
  onLetsGo: (restaurant: Restaurant) => void;
  onClear: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function estimateWalkTime(distanceKm: number | undefined): string {
  if (distanceKm === undefined) return '';
  const roadKm = distanceKm * 1.4;
  const minutes = Math.round((roadKm / 5) * 60);
  if (minutes <= 1) return '~1 min walk';
  if (minutes <= 30) return `~${minutes} min walk`;
  const driveMin = Math.max(1, Math.round((roadKm / 30) * 60));
  return `~${driveMin} min drive`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CravingSearch({
  query,
  onSearch,
  results,
  isLoading,
  error,
  recentSearches,
  onLetsGo,
  onClear,
}: CravingSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const showSuggestions = isFocused && !query && (recentSearches.length > 0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="w-full space-y-4">
      {/* ── Search bar ────────────────────────────────────────── */}
      <div className="relative">
        <Search
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-eatspin-gray-2"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onSearch(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder="chicken rice, coffee, bubble tea..."
          className="h-12 w-full rounded-xl border border-eatspin-gray-3 bg-white pl-10 pr-10
                     text-sm text-brand-black placeholder:text-eatspin-gray-2
                     focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/30
                     transition-all"
          aria-label="Search for food"
        />
        {query && (
          <button
            onClick={onClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-eatspin-gray-2
                       hover:text-brand-black transition-colors"
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        )}
        {isLoading && (
          <Loader2
            size={16}
            className="absolute right-10 top-1/2 -translate-y-1/2 animate-spin text-brand-orange"
          />
        )}
      </div>

      {/* ── Recent searches dropdown ──────────────────────────── */}
      {showSuggestions && (
        <div className="rounded-xl border border-eatspin-gray-3 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs font-medium text-eatspin-gray-2">Recent</p>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((s) => (
              <button
                key={s}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSearch(s)}
                className="rounded-full border border-eatspin-gray-3 px-3 py-1 text-xs
                           text-eatspin-gray-1 hover:border-brand-orange hover:text-brand-orange
                           transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Popular chips (when no query) ─────────────────────── */}
      {!query && (
        <div>
          <p className="mb-2 text-xs font-medium text-eatspin-gray-2">Popular</p>
          <div className="flex flex-wrap gap-2">
            {POPULAR_CHIPS.map((chip) => (
              <button
                key={chip.query}
                onClick={() => onSearch(chip.query)}
                className="rounded-full border border-eatspin-gray-3 bg-white px-3 py-1.5
                           text-xs font-semibold text-eatspin-gray-1
                           hover:border-brand-orange hover:text-brand-orange
                           hover:scale-[1.04] active:scale-[0.97] transition-all"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Error state ───────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-center text-sm text-red-600">
          {error}
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────── */}
      {query && !isLoading && !error && results.length === 0 && (
        <div className="rounded-xl bg-gray-50 p-6 text-center">
          <p className="text-2xl">😕</p>
          <p className="mt-2 text-sm font-medium text-eatspin-gray-1">
            No results for "{query}"
          </p>
          <p className="mt-1 text-xs text-eatspin-gray-2">
            Try a different search or tap a popular option above
          </p>
        </div>
      )}

      {/* ── Results grid ──────────────────────────────────────── */}
      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-eatspin-gray-2">
            {results.length} place{results.length !== 1 ? 's' : ''} found
          </p>
          {results.map((r, i) => (
            <div
              key={r.id}
              className="flex items-start gap-3 rounded-xl border border-eatspin-gray-3
                         bg-white p-3 shadow-sm hover:shadow-md transition-shadow"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Thumbnail */}
              {r.image && (
                <img
                  src={r.image}
                  alt={r.name}
                  className="h-20 w-20 flex-shrink-0 rounded-lg object-cover"
                  loading="lazy"
                />
              )}

              {/* Info */}
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-bold text-brand-black">
                  {r.name}
                </h3>

                {/* Rating + Price + Distance */}
                <div className="mt-1 flex items-center gap-2 text-xs text-eatspin-gray-1">
                  {r.rating > 0 && (
                    <span className="inline-flex items-center gap-0.5">
                      <Star size={12} className="text-[#FFD700] flex-shrink-0" />
                      <span className="font-semibold text-brand-black">{r.rating}</span>
                    </span>
                  )}
                  {r.priceRange && (
                    <>
                      <span className="text-eatspin-gray-3">·</span>
                      <span className="font-semibold text-brand-orange">{r.priceRange}</span>
                    </>
                  )}
                  {r.distance !== undefined && (
                    <>
                      <span className="text-eatspin-gray-3">·</span>
                      <span>{estimateWalkTime(r.distance)}</span>
                    </>
                  )}
                </div>

                {/* Address */}
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-eatspin-gray-2">
                  <MapPin size={10} className="flex-shrink-0" />
                  {r.address}
                </p>

                {/* Action */}
                <Button
                  size="sm"
                  onClick={() => onLetsGo(r)}
                  className="mt-2 h-8 rounded-lg bg-brand-orange px-3 text-xs font-bold
                             text-white hover:bg-brand-orange/90 shadow-sm"
                >
                  <Navigation size={12} className="mr-1" />
                  Let's go!
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
