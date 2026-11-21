/**
 * Per-category match strength, so a filter can prefer places that really are
 * what the user asked for (a café by Google's primary type or its name) over
 * places that only mention it (a restaurant with a secondary `cafe` type).
 * Pure helpers, no DOM.
 */
import type { CategoryEvidence, FoodCategory, Restaurant } from '@/types';

export type CategoryEvidenceMap = Partial<Record<FoodCategory, CategoryEvidence>>;

export const EVIDENCE_RANK: Readonly<Record<CategoryEvidence, number>> = { strong: 3, medium: 2, weak: 1 };

/** Confident matches needed before weak matches are left out. */
export const MIN_CONFIDENT_MATCHES = 5;

/** Raise each category to at least `level`; never lowers existing evidence. */
export const mergeCategoryEvidence = (
  evidence: CategoryEvidenceMap,
  categories: readonly FoodCategory[],
  level: CategoryEvidence,
): CategoryEvidenceMap => {
  const merged: CategoryEvidenceMap = { ...evidence };
  for (const category of categories) {
    const current = merged[category];
    if (!current || EVIDENCE_RANK[current] < EVIDENCE_RANK[level]) merged[category] = level;
  }
  return merged;
};

export interface EvidenceSources {
  primaryType: FoodCategory[];
  name: FoodCategory[];
  secondaryType: FoodCategory[];
  summary: FoodCategory[];
  serves: FoodCategory[];
}

export const buildCategoryEvidence = (sources: EvidenceSources): CategoryEvidenceMap => {
  let evidence: CategoryEvidenceMap = {};
  evidence = mergeCategoryEvidence(evidence, sources.secondaryType, 'weak');
  evidence = mergeCategoryEvidence(evidence, sources.summary, 'weak');
  evidence = mergeCategoryEvidence(evidence, sources.serves, 'weak');
  evidence = mergeCategoryEvidence(evidence, sources.name, 'medium');
  return mergeCategoryEvidence(evidence, sources.primaryType, 'strong');
};

/** Google serves-* flags that hint at a category. */
export const servesCategories = (place: Pick<Restaurant,
  'servesCoffee' | 'servesDessert' | 'servesVegetarianFood' | 'servesBreakfast' | 'servesBrunch'>): FoodCategory[] => {
  const categories: FoodCategory[] = [];
  if (place.servesCoffee) categories.push('cafe');
  if (place.servesDessert) categories.push('dessert');
  if (place.servesVegetarianFood) categories.push('vegetarian');
  if (place.servesBreakfast) categories.push('breakfast');
  if (place.servesBrunch) categories.push('brunch');
  return categories;
};

/**
 * Best match strength of a place for any of the categories, or 0 for no match.
 * Places without an evidence map (bundled, older cache, saved) keep the old rule:
 * a listed category counts as medium unless its confidence is low.
 */
export const categoryMatchRank = (restaurant: Restaurant, categories: readonly FoodCategory[]): number => {
  if (categories.length === 0) return EVIDENCE_RANK.strong;
  const evidence = restaurant.categoryEvidence;
  if (!evidence) {
    if (!restaurant.category.some((category) => categories.includes(category))) return 0;
    if (restaurant.source !== 'local-fallback' && restaurant.categoryConfidence === 'low') return 0;
    return EVIDENCE_RANK.medium;
  }
  return categories.reduce((best, category) => {
    const level = evidence[category];
    return level ? Math.max(best, EVIDENCE_RANK[level]) : best;
  }, 0);
};

export const isConfidentMatch = (rank: number): boolean => rank >= EVIDENCE_RANK.medium;

export interface RankedMatches<T> {
  results: T[];
  /** True when weak matches were added because there were too few confident ones. */
  broadened: boolean;
}

/**
 * Ranked filter: keep confident matches (strong or medium). When fewer than
 * `minConfident` remain, append weaker ones (and, with `keepUnmatched`, places
 * with no signal at all) after them. Relative order within a tier is kept.
 */
export const rankByCategoryMatch = <T extends Restaurant>(
  restaurants: readonly T[],
  categories: readonly FoodCategory[],
  options: { minConfident?: number; keepUnmatched?: boolean } = {},
): RankedMatches<T> => {
  if (categories.length === 0) return { results: [...restaurants], broadened: false };
  const minConfident = options.minConfident ?? MIN_CONFIDENT_MATCHES;
  const ranked = restaurants.map((restaurant) => ({ restaurant, rank: categoryMatchRank(restaurant, categories) }));
  const confident = ranked.filter((entry) => isConfidentMatch(entry.rank));
  const backup = ranked
    .filter((entry) => !isConfidentMatch(entry.rank) && (entry.rank > 0 || options.keepUnmatched))
    .sort((left, right) => right.rank - left.rank);
  // Strong first, then medium; Array.prototype.sort is stable, so ties keep input order.
  const confidentSorted = [...confident].sort((left, right) => right.rank - left.rank);
  if (confident.length >= minConfident || backup.length === 0) {
    return { results: confidentSorted.map((entry) => entry.restaurant), broadened: false };
  }
  return { results: [...confidentSorted, ...backup].map((entry) => entry.restaurant), broadened: true };
};
