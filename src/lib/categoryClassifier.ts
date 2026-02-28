/**
 * Post-fetch heuristic category classifier for Google Places results.
 *
 * Google Nearby Search only exposes a fixed place-type taxonomy (e.g.
 * `restaurant`, `cafe`, `bakery`). Categories like "dessert" or "street food"
 * don't exist as Google types, so many places that serve desserts or street
 * food are returned as a generic `restaurant` with no actionable type.
 *
 * This module enriches the category array returned by the type-based mapper by
 * scanning the place's `displayName`, `types[]` and optional
 * `editorialSummary` against a set of per-category keyword / regex signals.
 *
 * Design principles:
 * - Zero additional API calls — runs entirely on the already-fetched pool.
 * - Additive only — never removes categories assigned by the type mapper.
 * - Malaysian-food-aware — includes common Malay, Chinese-MY, Indian-MY and
 *   hawker-style food terms.
 * - Deterministic — same inputs always produce the same output.
 */

import type { FoodCategory, Restaurant } from '@/types';

// ---------------------------------------------------------------------------
// Signal map
// ---------------------------------------------------------------------------

export interface CategorySignals {
  /** Regex patterns matched against displayName.text (case-insensitive). */
  namePatterns: RegExp[];
  /** Google place types that imply this category. */
  googleTypes: string[];
}

/**
 * Mapping from each app FoodCategory to heuristic detection signals.
 *
 * Only categories that benefit from name-based detection are listed here.
 * Categories already well-served by the Google type mapper (e.g. `japanese`,
 * `korean`) are included with name patterns for extra recall — the classifier
 * deduplicates before returning.
 */
export const CATEGORY_SIGNALS: Partial<Record<FoodCategory, CategorySignals>> = {
  dessert: {
    namePatterns: [
      /dessert/i,
      /cake/i,
      /pastry/i,
      /ice[\s-]?cream/i,
      /gelato/i,
      /waffle/i,
      /churro/i,
      /cendol/i,
      /ais[\s-]?kacang/i,
      /\babc\b/i,
      /sweet/i,
      /donut/i,
      /doughnut/i,
      /crepe/i,
      /tart/i,
      /macaron/i,
      /brownie/i,
      /cheesecake/i,
      /pudding/i,
      /kuih/i,
      /onde[\s-]?onde/i,
      /pisang goreng/i,
      /apam balik/i,
      /bubur\s?(cha[\s-]?cha|pulut)/i,
      /pengat/i,
      /sagu/i,
      /bingsu/i,
      /pat(?:bingsu|bing[\s-]?su)/i,
      /kakigōri|kakigori/i,
      /mochi/i,
      /frozen[\s-]?yogurt/i,
      /froyo/i,
    ],
    googleTypes: [
      'bakery',
      'ice_cream_shop',
      'dessert_restaurant',
      'dessert_shop',
    ],
  },

  'street food': {
    namePatterns: [
      /street[\s-]?food/i,
      /hawker/i,
      /pasar[\s-]?malam/i,
      /gerai/i,
      /warung/i,
      /\bstall/i,
      /goreng/i,
      /satay/i,
      /sate\b/i,
      /rojak/i,
      /char[\s-]?k[uo]ey[\s-]?teow/i,
      /roti[\s-]?canai/i,
      /roti[\s-]?john/i,
      /lok[\s-]?lok/i,
      /ramly/i,
      /murtabak/i,
      /apam/i,
      /otak[\s-]?otak/i,
      /popiah/i,
      /curry[\s-]?puff/i,
      /karipap/i,
      /epok[\s-]?epok/i,
      /keropok[\s-]?lekor/i,
      /cakoi/i,
      /kuih/i,
      /pisang[\s-]?goreng/i,
      /ayam[\s-]?goreng/i,
      /nasi[\s-]?goreng/i,
      /mi[\s-]?goreng/i,
      /mee[\s-]?goreng/i,
      /putu[\s-]?(piring|bambu|mayam)/i,
      /bacang|ba[\s-]?zhang/i,
    ],
    googleTypes: ['meal_takeaway'],
  },

  bakery: {
    namePatterns: [
      /bakery/i,
      /\bbake/i,
      /bread/i,
      /boulangerie/i,
      /patisserie/i,
      /roti\b/i,
    ],
    googleTypes: ['bakery'],
  },

  cafe: {
    namePatterns: [
      /\bcafe\b/i,
      /\bcafé\b/i,
      /coffee/i,
      /kopi\b/i,
      /kopitiam/i,
      /barista/i,
      /espresso/i,
      /latte/i,
      /brunch/i,
    ],
    googleTypes: ['cafe', 'coffee_shop'],
  },

  malay: {
    namePatterns: [
      /nasi[\s-]?lemak/i,
      /nasi[\s-]?kandar/i,
      /nasi[\s-]?kerabu/i,
      /nasi[\s-]?dagang/i,
      /nasi[\s-]?campur/i,
      /mamak/i,
      /rendang/i,
      /laksa/i,
      /asam[\s-]?pedas/i,
      /gulai/i,
      /masak[\s-]?lemak/i,
      /\bmelayu\b/i,
      /\bmalay\b/i,
      /kampung/i,
      /tom[\s-]?yam/i,
      /sup[\s-]?tulang/i,
      /ikan[\s-]?bakar/i,
    ],
    googleTypes: [],
  },

  indian: {
    namePatterns: [
      /\bindian\b/i,
      /tandoori/i,
      /biryani/i,
      /naan\b/i,
      /chapati/i,
      /thali/i,
      /dosa/i,
      /idli/i,
      /masala/i,
      /curry[\s-]?leaf/i,
      /banana[\s-]?leaf/i,
      /tosai/i,
      /vadai/i,
      /paratha/i,
    ],
    googleTypes: ['indian_restaurant'],
  },

  chinese: {
    namePatterns: [
      /\bchinese\b/i,
      /dim[\s-]?sum/i,
      /wonton/i,
      /bak[\s-]?kut[\s-]?teh/i,
      /char[\s-]?siu/i,
      /roast[\s-]?duck/i,
      /claypot/i,
      /zi[\s-]?char/i,
      /chee[\s-]?cheong[\s-]?fun/i,
      /yong[\s-]?tau[\s-]?foo/i,
      /double[\s-]?boil/i,
      /herbal[\s-]?soup/i,
      /hokkien/i,
      /teochew/i,
      /cantonese/i,
      /hakka/i,
      /hainanese/i,
      /kopitiam/i,
    ],
    googleTypes: ['chinese_restaurant'],
  },

  japanese: {
    namePatterns: [
      /\bjapanese\b/i,
      /sushi/i,
      /ramen/i,
      /udon/i,
      /soba\b/i,
      /tempura/i,
      /izakaya/i,
      /yakiniku/i,
      /donburi/i,
      /katsu\b/i,
      /tonkatsu/i,
      /omakase/i,
      /takoyaki/i,
      /onigiri/i,
      /matcha\b/i,
      /teriyaki/i,
    ],
    googleTypes: ['japanese_restaurant'],
  },

  korean: {
    namePatterns: [
      /\bkorean\b/i,
      /bibimbap/i,
      /kimchi/i,
      /bulgogi/i,
      /tteokbokki/i,
      /dakgalbi/i,
      /samgyeopsal/i,
      /\bbbq\b.*korean/i,
      /korean.*\bbbq\b/i,
      /kimbap/i,
      /jjigae/i,
      /chimaek/i,
    ],
    googleTypes: ['korean_restaurant'],
  },

  thai: {
    namePatterns: [
      /\bthai\b/i,
      /pad[\s-]?thai/i,
      /som[\s-]?tam/i,
      /green[\s-]?curry/i,
      /tom[\s-]?yum/i,
      /mango[\s-]?sticky/i,
      /basil[\s-]?chicken/i,
      /\bphad\b/i,
    ],
    googleTypes: ['thai_restaurant'],
  },

  western: {
    namePatterns: [
      /\bwestern\b/i,
      /burger/i,
      /pizza/i,
      /pasta/i,
      /steak/i,
      /grill/i,
      /bbq\b(?!.*korean)/i,
      /sandwich/i,
      /fish[\s-]?(?:and|&|n)[\s-]?chips/i,
    ],
    googleTypes: ['american_restaurant', 'italian_restaurant', 'pizza_restaurant', 'hamburger_restaurant'],
  },

  seafood: {
    namePatterns: [
      /seafood/i,
      /\bikan\b/i,
      /\budang\b/i,
      /\bketam\b/i,
      /\bkepiting\b/i,
      /shell[\s-]?out/i,
      /lobster/i,
      /crab/i,
      /prawn/i,
      /shrimp/i,
      /oyster/i,
    ],
    googleTypes: ['seafood_restaurant'],
  },

  chicken: {
    namePatterns: [
      /\bchicken\b/i,
      /\bayam\b/i,
      /fried[\s-]?chicken/i,
      /\bkfc\b/i,
      /rotisserie/i,
      /wings?\b/i,
    ],
    googleTypes: ['chicken_restaurant'],
  },

  beef: {
    namePatterns: [
      /\bbeef\b/i,
      /\bsteak\b/i,
      /\blembu\b/i,
      /wagyu/i,
    ],
    googleTypes: ['steak_house'],
  },

  vegetarian: {
    namePatterns: [
      /vegetarian/i,
      /\bvegan\b/i,
      /\bveggie\b/i,
      /plant[\s-]?based/i,
      /meat[\s-]?free/i,
    ],
    googleTypes: ['vegetarian_restaurant', 'vegan_restaurant'],
  },

  noodles: {
    namePatterns: [
      /noodle/i,
      /\bmee\b/i,
      /\bmi\b/i,
      /\bmie\b/i,
      /pan[\s-]?mee/i,
      /wanton[\s-]?mee/i,
      /laksa/i,
      /kway[\s-]?teow/i,
      /kuey[\s-]?teow/i,
      /pho\b/i,
    ],
    googleTypes: ['noodle_restaurant'],
  },

  rice: {
    namePatterns: [
      /\brice\b/i,
      /\bnasi\b/i,
      /\bnasik\b/i,
      /biryani/i,
      /claypot[\s-]?rice/i,
      /chicken[\s-]?rice/i,
      /economy[\s-]?rice/i,
    ],
    googleTypes: [],
  },

  soup: {
    namePatterns: [
      /\bsoup\b/i,
      /\bsup\b/i,
      /bak[\s-]?kut[\s-]?teh/i,
      /herbal[\s-]?soup/i,
      /double[\s-]?boil/i,
    ],
    googleTypes: [],
  },

  breakfast: {
    namePatterns: [
      /breakfast/i,
      /brunch/i,
      /\bsarapan\b/i,
      /morning/i,
    ],
    googleTypes: ['breakfast_restaurant'],
  },
};

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

export interface ClassifiablePlace {
  /** Display name from Google (displayName.text) */
  displayName?: string;
  /** Google place types array */
  types?: string[];
  /** Optional editorial summary / description text */
  editorialSummary?: string;
}

/**
 * Classify a Google place into app FoodCategory values using heuristic
 * signals.
 *
 * The function checks each category's signals against the place's name, types
 * and summary. All matching categories are returned (a place can be
 * multi-category). If nothing matches the function returns an empty array —
 * the caller is expected to merge this with any type-mapper results.
 */
export const classifyPlace = (place: ClassifiablePlace): FoodCategory[] => {
  const name = (place.displayName ?? '').toLowerCase();
  const types = place.types ?? [];
  const summary = (place.editorialSummary ?? '').toLowerCase();
  const searchableText = `${name} ${summary}`;

  const matched: FoodCategory[] = [];

  for (const [category, signals] of Object.entries(CATEGORY_SIGNALS) as [FoodCategory, CategorySignals][]) {
    if (!signals) continue;

    // Check Google types first (cheap)
    const typeMatch = signals.googleTypes.some((gt) => types.includes(gt));
    if (typeMatch) {
      matched.push(category);
      continue;
    }

    // Check name / summary patterns
    const nameMatch = signals.namePatterns.some((pattern) => pattern.test(searchableText));
    if (nameMatch) {
      matched.push(category);
    }
  }

  return matched;
};

/**
 * Merge type-mapper categories with heuristic-classified categories,
 * deduplicating and preserving order (type-mapper results first).
 *
 * If the combined result is empty, returns `['western']` as the safe default
 * (matching the existing fallback behaviour of `mapGoogleTypesToCategories`).
 */
export const mergeCategories = (
  typeMapperCategories: FoodCategory[],
  heuristicCategories: FoodCategory[]
): FoodCategory[] => {
  const seen = new Set<FoodCategory>(typeMapperCategories);
  const merged = [...typeMapperCategories];

  for (const cat of heuristicCategories) {
    if (!seen.has(cat)) {
      seen.add(cat);
      merged.push(cat);
    }
  }

  return merged.length > 0 ? merged : ['western'];
};

/**
 * Re-classify a Restaurant's categories using the heuristic classifier.
 *
 * Useful for enriching cached restaurants that were normalised before the
 * classifier existed.  The function is idempotent — running it on an
 * already-enriched restaurant produces the same result.
 */
export const enrichRestaurantCategories = (restaurant: Restaurant): Restaurant => {
  const heuristic = classifyPlace({ displayName: restaurant.name });
  const enriched = mergeCategories(restaurant.category, heuristic);

  // Fast-path: skip object allocation when nothing changed.
  if (
    enriched.length === restaurant.category.length &&
    enriched.every((c, i) => c === restaurant.category[i])
  ) {
    return restaurant;
  }

  return { ...restaurant, category: enriched };
};

/**
 * Batch-enrich an array of restaurants.  Returns a new array only if at
 * least one restaurant was modified; otherwise returns the original reference
 * so React memoisation short-circuits.
 */
export const enrichRestaurantListCategories = (
  restaurants: Restaurant[]
): Restaurant[] => {
  let changed = false;
  const result = restaurants.map((r) => {
    const enriched = enrichRestaurantCategories(r);
    if (enriched !== r) changed = true;
    return enriched;
  });
  return changed ? result : restaurants;
};
