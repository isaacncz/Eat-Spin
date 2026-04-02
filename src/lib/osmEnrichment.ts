/**
 * OSM Enrichment Module
 *
 * Uses the Overpass API to fetch nearby food venues and enrich Google-fetched
 * restaurant records with additional metadata (cuisine subtypes, dietary tags,
 * ambiance, and signature dishes derived from OSM tags/heuristics).
 *
 * Design constraints:
 * - Google remains the canonical record; OSM only fills missing fields.
 * - OSM enrichment failures are non-blocking — callers must wrap in try/catch.
 * - Only auto-merge when confidence is above a safe threshold.
 */

import type { AmbianceTag, DietaryTag, Restaurant } from '@/types';
import { calculateDistance } from '@/lib/restaurantUtils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

/** Max proximity to consider two venues the same place (metres). */
const PROXIMITY_THRESHOLD_M = 80;

/**
 * Hard-gate distance for candidate filtering before scoring.
 * Set to 2× PROXIMITY_THRESHOLD_M so that borderline matches at the
 * threshold edge are still scored rather than silently discarded.
 */
const MAX_MATCHING_DISTANCE_M = PROXIMITY_THRESHOLD_M * 2;

/** Minimum name similarity score [0–1] to attempt a merge. */
const NAME_SIMILARITY_THRESHOLD = 0.45;

/** Combined confidence score above which we auto-merge OSM enrichment. */
const AUTO_MERGE_CONFIDENCE_THRESHOLD = 0.55;

/**
 * Timeout for Overpass API requests in seconds.
 * 15 s is generous for a typical ~2 km radius query while keeping the
 * user experience responsive when the service is slow.
 */
const OVERPASS_TIMEOUT_SECONDS = 15;

/**
 * Similarity score assigned to short strings (< 3 chars) that share a prefix
 * or are contained within each other.  0.6 reflects a moderately confident
 * match without fully committing — abbreviations like "KFC" vs "KFC Penang"
 * should score higher than strangers but below an exact trigram match.
 */
const SHORT_STRING_SIMILARITY_SCORE = 0.6;

/**
 * Weight given to proximity when computing combined match confidence.
 * Proximity is the stronger signal for noisy OSM name data.
 */
const PROXIMITY_WEIGHT = 0.6;

/** Weight given to name similarity when computing combined match confidence. */
const NAME_SIMILARITY_WEIGHT = 0.4;

// ---------------------------------------------------------------------------
// OSM tag normalisation maps
// ---------------------------------------------------------------------------

/**
 * OSM `cuisine` tag → cuisineSubtype labels.
 * Multiple comma-separated cuisine tags are split and each mapped individually.
 */
const OSM_CUISINE_TO_SUBTYPE: Record<string, string> = {
  // Malay / Malaysian
  nasi_lemak: 'nasi lemak',
  nasi_campur: 'nasi campur',
  nasi_goreng: 'nasi goreng',
  mee_goreng: 'mee goreng',
  satay: 'satay',
  rendang: 'rendang',
  laksa: 'laksa',
  mamak: 'mamak',
  hawker: 'hawker',
  kopitiam: 'kopitiam',
  // Chinese
  dim_sum: 'dim sum',
  dim_sum_chinese: 'dim sum',
  wonton: 'wonton',
  char_kway_teow: 'char kuey teow',
  char_kuey_teow: 'char kuey teow',
  hokkien_mee: 'hokkien mee',
  hokkien: 'hokkien',
  cantonese: 'cantonese',
  teochew: 'teochew',
  hakka: 'hakka',
  hainanese: 'hainanese',
  nyonya: 'nyonya',
  peranakan: 'peranakan',
  chinese: 'chinese',
  // Indian
  indian: 'indian',
  banana_leaf: 'banana leaf',
  north_indian: 'north indian',
  south_indian: 'south indian',
  naan: 'naan',
  briyani: 'briyani',
  biryani: 'briyani',
  roti_canai: 'roti canai',
  // Japanese
  japanese: 'japanese',
  sushi: 'sushi',
  ramen: 'ramen',
  udon: 'udon',
  tempura: 'tempura',
  // Korean
  korean: 'korean',
  korean_bbq: 'korean bbq',
  // Thai
  thai: 'thai',
  // Western
  western: 'western',
  burger: 'burger',
  pizza: 'pizza',
  italian: 'italian',
  // Seafood
  seafood: 'seafood',
  fish: 'seafood',
  // Other
  vegetarian: 'vegetarian',
  vegan: 'vegan',
  breakfast: 'breakfast',
  sandwich: 'sandwich',
  cafe: 'cafe',
  coffee_shop: 'coffee shop',
  fast_food: 'fast food',
};

/**
 * OSM `diet:*` tags → DietaryTag values.
 */
const OSM_DIET_TO_DIETARY: Record<string, DietaryTag> = {
  'diet:halal': 'halal-certified',
  'diet:muslim_friendly': 'muslim-friendly',
  'diet:pork_free': 'pork-free',
  'diet:vegetarian': 'vegetarian-friendly',
  'diet:vegan': 'vegan-friendly',
  'diet:alcohol_free': 'alcohol-free',
};

/**
 * OSM `cuisine` tag values that imply dietary tags.
 */
const CUISINE_DIETARY_IMPLICATIONS: Record<string, DietaryTag> = {
  mamak: 'muslim-friendly',
  halal: 'halal-certified',
  vegetarian: 'vegetarian-friendly',
  vegan: 'vegan-friendly',
};

/**
 * OSM `amenity` and `cuisine` tag values → AmbianceTag values.
 */
const OSM_AMENITY_TO_AMBIANCE: Record<string, AmbianceTag> = {
  food_court: 'hawker',
};

const OSM_CUISINE_TO_AMBIANCE: Record<string, AmbianceTag> = {
  hawker: 'hawker',
  kopitiam: 'kopitiam',
  mamak: 'kopitiam',
  fast_food: 'family-friendly',
};

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface OsmTags {
  name?: string;
  amenity?: string;
  cuisine?: string;
  'addr:street'?: string;
  'addr:housenumber'?: string;
  'addr:city'?: string;
  'contact:phone'?: string;
  phone?: string;
  'opening_hours'?: string;
  [key: string]: string | undefined;
}

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  /** Way / relation centroid */
  center?: { lat: number; lon: number };
  tags?: OsmTags;
}

interface OsmOverpassResponse {
  elements?: OsmElement[];
}

/** Internal OSM-derived enrichment record before merging. */
export interface OsmEnrichment {
  osmId: string;
  lat: number;
  lng: number;
  name: string;
  cuisineSubtype: string[];
  signatureDishes: string[];
  dietaryTags: DietaryTag[];
  ambiance: AmbianceTag[];
}

/** Result of matching one Google restaurant to an OSM venue. */
interface OsmMatchResult {
  enrichment: OsmEnrichment;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Overpass query builder
// ---------------------------------------------------------------------------

const buildOverpassQuery = (lat: number, lng: number, radiusM: number): string => {
  const around = `(around:${Math.round(radiusM)},${lat},${lng})`;
  const amenities = ['restaurant', 'fast_food', 'cafe', 'food_court'];
  const nodeUnion = amenities.map((a) => `node["amenity"="${a}"]${around};`).join('\n  ');
  const wayUnion = amenities.map((a) => `way["amenity"="${a}"]${around};`).join('\n  ');

  return `[out:json][timeout:${OVERPASS_TIMEOUT_SECONDS}];
(
  ${nodeUnion}
  ${wayUnion}
);
out center body;`;
};

// ---------------------------------------------------------------------------
// OSM tag normalisation
// ---------------------------------------------------------------------------

const normaliseName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[''"`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Compute trigram similarity between two normalised strings.
 * Returns a value in [0, 1].
 */
const trigramSimilarity = (a: string, b: string): number => {
  if (a === b) return 1;
  if (a.length < 3 || b.length < 3) {
    // Short strings: fall back to prefix / inclusion check
    return a.includes(b) || b.includes(a) ? SHORT_STRING_SIMILARITY_SCORE : 0;
  }

  const trigrams = (s: string): Set<string> => {
    const set = new Set<string>();
    for (let i = 0; i <= s.length - 3; i++) {
      set.add(s.slice(i, i + 3));
    }
    return set;
  };

  const ta = trigrams(a);
  const tb = trigrams(b);
  let intersection = 0;
  for (const t of ta) {
    if (tb.has(t)) intersection++;
  }
  return (2 * intersection) / (ta.size + tb.size);
};

const parseCuisineTags = (rawCuisine: string | undefined): string[] => {
  if (!rawCuisine) return [];
  return rawCuisine
    .split(/[;,]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
};

const normaliseTags = (element: OsmElement): OsmEnrichment | null => {
  const tags = element.tags ?? {};
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  const name = tags.name ?? '';

  if (lat === undefined || lon === undefined) return null;

  const cuisineParts = parseCuisineTags(tags.cuisine);

  const cuisineSubtype: string[] = [];
  const dietaryTags: DietaryTag[] = [];
  const ambiance: AmbianceTag[] = [];

  for (const part of cuisineParts) {
    const subtype = OSM_CUISINE_TO_SUBTYPE[part];
    if (subtype && !cuisineSubtype.includes(subtype)) {
      cuisineSubtype.push(subtype);
    }
    const dietary = CUISINE_DIETARY_IMPLICATIONS[part];
    if (dietary && !dietaryTags.includes(dietary)) {
      dietaryTags.push(dietary);
    }
    const amb = OSM_CUISINE_TO_AMBIANCE[part];
    if (amb && !ambiance.includes(amb)) {
      ambiance.push(amb);
    }
  }

  // Diet:* tags
  for (const [tagKey, dietaryValue] of Object.entries(OSM_DIET_TO_DIETARY)) {
    if (tags[tagKey] === 'yes' || tags[tagKey] === 'only') {
      if (!dietaryTags.includes(dietaryValue)) {
        dietaryTags.push(dietaryValue);
      }
    }
  }

  // Halal tag shorthand
  if (tags.halal === 'yes' && !dietaryTags.includes('halal-certified')) {
    dietaryTags.push('halal-certified');
  }

  // Amenity-based ambiance
  const amenityAmbiance = tags.amenity ? OSM_AMENITY_TO_AMBIANCE[tags.amenity] : undefined;
  if (amenityAmbiance && !ambiance.includes(amenityAmbiance)) {
    ambiance.push(amenityAmbiance);
  }

  // Air-conditioning heuristic
  if (tags['air_conditioning'] === 'yes' && !ambiance.includes('air-cond')) {
    ambiance.push('air-cond');
  }

  // Outdoor seating heuristic
  if (tags['outdoor_seating'] === 'yes' && !ambiance.includes('outdoor')) {
    ambiance.push('outdoor');
  }

  return {
    osmId: `${element.type}/${element.id}`,
    lat,
    lng: lon,
    name,
    cuisineSubtype,
    signatureDishes: [], // OSM does not have menu data — this stays empty at the API level
    dietaryTags,
    ambiance,
  };
};

// ---------------------------------------------------------------------------
// Matching logic
// ---------------------------------------------------------------------------

const computeMatchConfidence = (
  restaurant: Restaurant,
  enrichment: OsmEnrichment,
): number => {
  const distanceM =
    calculateDistance(
      restaurant.coordinates.lat,
      restaurant.coordinates.lng,
      enrichment.lat,
      enrichment.lng,
    ) * 1000;

  // Proximity score: 1.0 at 0 m, 0.0 at PROXIMITY_THRESHOLD_M
  const proximityScore = Math.max(0, 1 - distanceM / PROXIMITY_THRESHOLD_M);

  // Name similarity score
  const normA = normaliseName(restaurant.name);
  const normB = normaliseName(enrichment.name);
  const nameSim = trigramSimilarity(normA, normB);

  // Weighted combination: proximity PROXIMITY_WEIGHT, name NAME_SIMILARITY_WEIGHT
  return proximityScore * PROXIMITY_WEIGHT + nameSim * NAME_SIMILARITY_WEIGHT;
};

const findBestOsmMatch = (
  restaurant: Restaurant,
  candidates: OsmEnrichment[],
): OsmMatchResult | null => {
  let best: OsmMatchResult | null = null;

  for (const enrichment of candidates) {
    const distanceM =
      calculateDistance(
        restaurant.coordinates.lat,
        restaurant.coordinates.lng,
        enrichment.lat,
        enrichment.lng,
      ) * 1000;

    // Hard proximity gate — skip if too far
    if (distanceM > MAX_MATCHING_DISTANCE_M) continue;

    const normB = normaliseName(enrichment.name);
    const normA = normaliseName(restaurant.name);
    const nameSim = trigramSimilarity(normA, normB);

    if (nameSim < NAME_SIMILARITY_THRESHOLD) continue;

    const confidence = computeMatchConfidence(restaurant, enrichment);
    if (!best || confidence > best.confidence) {
      best = { enrichment, confidence };
    }
  }

  return best;
};

// ---------------------------------------------------------------------------
// Merge helper
// ---------------------------------------------------------------------------

const mergeEnrichment = (restaurant: Restaurant, enrichment: OsmEnrichment): Restaurant => {
  // Only add fields that are missing on the Google record (OSM never overwrites).
  const cuisineSubtype =
    restaurant.cuisineSubtype && restaurant.cuisineSubtype.length > 0
      ? restaurant.cuisineSubtype
      : enrichment.cuisineSubtype.length > 0
        ? enrichment.cuisineSubtype
        : undefined;

  const signatureDishes =
    restaurant.signatureDishes && restaurant.signatureDishes.length > 0
      ? restaurant.signatureDishes
      : enrichment.signatureDishes.length > 0
        ? enrichment.signatureDishes
        : undefined;

  // Dietary tags: union of existing + OSM (both are structured)
  const existingDietary = restaurant.dietaryTags ?? [];
  const mergedDietary = [...existingDietary];
  for (const tag of enrichment.dietaryTags) {
    if (!mergedDietary.includes(tag)) mergedDietary.push(tag);
  }

  // Ambiance: union
  const existingAmbiance = restaurant.ambiance ?? [];
  const mergedAmbiance = [...existingAmbiance];
  for (const tag of enrichment.ambiance) {
    if (!mergedAmbiance.includes(tag)) mergedAmbiance.push(tag);
  }

  return {
    ...restaurant,
    ...(cuisineSubtype !== undefined ? { cuisineSubtype } : {}),
    ...(signatureDishes !== undefined ? { signatureDishes } : {}),
    ...(mergedDietary.length > 0 ? { dietaryTags: mergedDietary } : {}),
    ...(mergedAmbiance.length > 0 ? { ambiance: mergedAmbiance } : {}),
  };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch OSM venues near a location and return normalised enrichment records.
 * Throws on network / parse errors — callers should handle gracefully.
 */
export const fetchOsmEnrichments = async (
  lat: number,
  lng: number,
  radiusM: number,
  signal?: AbortSignal,
): Promise<OsmEnrichment[]> => {
  const query = buildOverpassQuery(lat, lng, radiusM);

  const response = await fetch(OVERPASS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal,
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status}`);
  }

  const payload = (await response.json()) as OsmOverpassResponse;
  const elements = payload.elements ?? [];

  const enrichments: OsmEnrichment[] = [];
  for (const element of elements) {
    const enrichment = normaliseTags(element);
    if (enrichment) enrichments.push(enrichment);
  }

  return enrichments;
};

/**
 * Enrich a list of Google-fetched restaurants with OSM metadata.
 *
 * @param restaurants  - Google restaurant records (source = 'google-live').
 * @param enrichments  - OSM enrichment records from `fetchOsmEnrichments`.
 * @returns New array with enrichment fields merged in where confidence is safe.
 */
export const applyOsmEnrichments = (
  restaurants: Restaurant[],
  enrichments: OsmEnrichment[],
): Restaurant[] => {
  if (enrichments.length === 0) return restaurants;

  return restaurants.map((restaurant) => {
    const match = findBestOsmMatch(restaurant, enrichments);
    if (!match || match.confidence < AUTO_MERGE_CONFIDENCE_THRESHOLD) {
      return restaurant;
    }
    return mergeEnrichment(restaurant, match.enrichment);
  });
};
