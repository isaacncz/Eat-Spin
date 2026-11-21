/**
 * Craving search: Text Search plus place-type intent. "coffee" asks Google for
 * cafés only (`includedType` + `strictTypeFiltering`), then ranks the results by
 * how strongly each one is a café. When too few confident matches come back, one
 * plain text request fills in, ranked after them.
 */
import type { Restaurant } from '@/types';
import { searchPlacesByText, type TextSearchOptions } from '@/lib/googlePlacesTextSearch';
import { detectSearchIntent, type SearchIntent } from '@/lib/searchIntent';
import { MIN_CONFIDENT_MATCHES, categoryMatchRank, isConfidentMatch, rankByCategoryMatch } from '@/lib/categoryEvidence';

export interface CravingSearchResult {
  restaurants: Restaurant[];
  intent: SearchIntent | null;
  /** True when weaker matches were added after the confident ones. */
  broadened: boolean;
}

const placeKey = (restaurant: Restaurant): string => restaurant.googlePlaceId ?? restaurant.id;

export async function searchCravingPlaces(
  options: Omit<TextSearchOptions, 'includedType' | 'strictTypeFiltering'>,
): Promise<CravingSearchResult> {
  const intent = detectSearchIntent(options.textQuery);
  if (!intent) {
    return { restaurants: (await searchPlacesByText(options)) ?? [], intent: null, broadened: false };
  }

  // Mall discovery depends on relevance-ranked tenant pages, so it keeps the plain query.
  const typed = Boolean(intent.includedType) && !options.mallPlaceId;
  const first = (await searchPlacesByText(typed
    ? { ...options, includedType: intent.includedType, strictTypeFiltering: true }
    : options)) ?? [];

  let pool = first;
  const confident = first.filter((restaurant) => isConfidentMatch(categoryMatchRank(restaurant, [intent.category])));
  if (typed && confident.length < MIN_CONFIDENT_MATCHES) {
    const seen = new Set(first.map(placeKey));
    try {
      const wider = (await searchPlacesByText(options)) ?? [];
      pool = [...first, ...wider.filter((restaurant) => !seen.has(placeKey(restaurant)))];
    } catch (error) {
      // The wider request is optional: keep typed results unless nothing came back.
      if (options.signal?.aborted || first.length === 0) throw error;
    }
  }

  // Strict type filtering already vetted the typed results, so unmatched places are
  // only dropped when there are enough confident ones.
  const ranked = rankByCategoryMatch(pool, [intent.category], { keepUnmatched: true });
  return { restaurants: ranked.results, intent, broadened: ranked.broadened };
}
