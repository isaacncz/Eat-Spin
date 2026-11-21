/**
 * Reads what kind of place a craving search asks for. "coffee near me" means
 * cafés; "chicken rice" is a dish, so it has no place-type intent and stays a
 * plain text search. Only whole-query matches count (after filler words are
 * removed), which keeps dish names from being mistaken for a venue type.
 */
import type { FoodCategory } from '@/types';

export interface SearchIntent {
  category: FoodCategory;
  /** Plural label for the results chip, e.g. "Cafés". */
  label: string;
  /**
   * One Google Places Table A type for Text Search `includedType`. Omitted when
   * Google has no matching type (e.g. bubble tea, western).
   * https://developers.google.com/maps/documentation/places/web-service/place-types
   */
  includedType?: string;
}

interface IntentRule extends SearchIntent {
  terms: readonly string[];
}

/** Ordered: the first rule whose terms contain the query wins. */
const INTENT_RULES: readonly IntentRule[] = [
  { category: 'bubble-tea', label: 'Bubble tea', terms: ['bubble tea', 'boba', 'boba tea', 'milk tea', 'pearl milk tea'] },
  { category: 'cafe', label: 'Cafés', includedType: 'cafe', terms: [
    'coffee', 'cafe', 'café', 'cafes', 'cafés', 'kafe', 'kopi', 'kedai kopi', 'coffee shop', 'coffeeshop',
    'kopitiam', 'latte', 'espresso', 'cappuccino', 'americano', 'flat white', 'mocha', 'barista', 'specialty coffee',
  ] },
  { category: 'dessert', label: 'Ice cream', includedType: 'ice_cream_shop', terms: ['ice cream', 'gelato', 'aiskrim'] },
  { category: 'dessert', label: 'Doughnuts', includedType: 'donut_shop', terms: ['donut', 'donuts', 'doughnut', 'doughnuts'] },
  { category: 'dessert', label: 'Cake shops', includedType: 'cake_shop', terms: ['cake', 'cakes', 'cheesecake'] },
  { category: 'dessert', label: 'Desserts', includedType: 'dessert_shop', terms: [
    'dessert', 'desserts', 'sweets', 'bingsu', 'cendol', 'ais kacang', 'waffle', 'waffles', 'froyo', 'frozen yogurt',
  ] },
  { category: 'bakery', label: 'Bakeries', includedType: 'bakery', terms: [
    'bakery', 'bakeries', 'bread', 'pastry', 'pastries', 'croissant', 'croissants', 'bakehouse',
  ] },
  { category: 'pizza', label: 'Pizza places', includedType: 'pizza_restaurant', terms: ['pizza', 'pizzeria'] },
  { category: 'japanese', label: 'Sushi places', includedType: 'sushi_restaurant', terms: ['sushi', 'omakase'] },
  { category: 'japanese', label: 'Ramen places', includedType: 'ramen_restaurant', terms: ['ramen'] },
  { category: 'japanese', label: 'Japanese', includedType: 'japanese_restaurant', terms: ['japanese', 'izakaya'] },
  { category: 'korean', label: 'Korean BBQ', includedType: 'korean_barbecue_restaurant', terms: ['korean bbq', 'kbbq', 'korean barbecue'] },
  { category: 'korean', label: 'Korean', includedType: 'korean_restaurant', terms: ['korean'] },
  { category: 'thai', label: 'Thai', includedType: 'thai_restaurant', terms: ['thai'] },
  { category: 'chinese', label: 'Dim sum', includedType: 'dim_sum_restaurant', terms: ['dim sum', 'dimsum'] },
  { category: 'chinese', label: 'Chinese', includedType: 'chinese_restaurant', terms: ['chinese'] },
  { category: 'indian', label: 'Indian', includedType: 'indian_restaurant', terms: ['indian'] },
  { category: 'malay', label: 'Malay', includedType: 'malaysian_restaurant', terms: ['malay', 'malaysian', 'melayu'] },
  { category: 'seafood', label: 'Seafood', includedType: 'seafood_restaurant', terms: ['seafood'] },
  { category: 'vegetarian', label: 'Vegan', includedType: 'vegan_restaurant', terms: ['vegan'] },
  { category: 'vegetarian', label: 'Vegetarian', includedType: 'vegetarian_restaurant', terms: ['vegetarian', 'veggie', 'plant based'] },
  { category: 'fast-food', label: 'Fast food', includedType: 'fast_food_restaurant', terms: ['fast food'] },
  { category: 'western', label: 'Burgers', includedType: 'hamburger_restaurant', terms: ['burger', 'burgers'] },
  { category: 'western', label: 'Western', terms: ['western'] },
  { category: 'beef', label: 'Steakhouses', includedType: 'steak_house', terms: ['steak', 'steakhouse', 'steak house'] },
  { category: 'bbq', label: 'BBQ', includedType: 'barbecue_restaurant', terms: ['bbq', 'barbecue', 'barbeque'] },
  { category: 'hotpot', label: 'Hotpot', includedType: 'hot_pot_restaurant', terms: ['hotpot', 'hot pot', 'steamboat', 'shabu', 'shabu shabu', 'mala hotpot'] },
  { category: 'chicken', label: 'Chicken', includedType: 'chicken_restaurant', terms: ['chicken', 'fried chicken', 'chicken wings', 'wings'] },
  { category: 'breakfast', label: 'Breakfast', includedType: 'breakfast_restaurant', terms: ['breakfast', 'sarapan'] },
  { category: 'brunch', label: 'Brunch', includedType: 'brunch_restaurant', terms: ['brunch'] },
];

const FILLER_WORDS = new Set([
  'a', 'an', 'the', 'some', 'any', 'for', 'to', 'eat', 'get', 'go', 'i', 'want', 'craving', 'find', 'me', 'my',
  'near', 'nearby', 'around', 'here', 'close', 'by', 'best', 'good', 'top', 'cheap', 'nice', 'new', 'open', 'now',
  'food', 'foods', 'restaurant', 'restaurants', 'restoran', 'shop', 'shops', 'place', 'places', 'spot', 'spots',
  'kedai', 'makan', 'house', 'joint', 'joints', 'bar', 'store',
]);

/** Lower-case words, punctuation dropped; "café" keeps its accent. */
const tokenize = (query: string): string[] => query
  .toLowerCase()
  .normalize('NFC')
  .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
  .replace(/-/g, ' ')
  .split(/\s+/)
  .filter(Boolean);

const termIndex = new Map<string, SearchIntent>();
for (const { terms, ...intent } of INTENT_RULES) {
  for (const term of terms) {
    const key = tokenize(term).join(' ');
    if (!termIndex.has(key)) termIndex.set(key, intent);
  }
}

/**
 * Place-type intent of a craving search, or null for dish and name searches.
 * The query, minus filler words, must equal a known term ("good coffee near me"
 * → cafés; "kopi" → cafés; "coffee bean jelly" → null).
 */
export const detectSearchIntent = (query: string): SearchIntent | null => {
  const tokens = tokenize(query);
  if (tokens.length === 0) return null;
  const exact = termIndex.get(tokens.join(' '));
  if (exact) return exact;
  // "kedai kopi" and "coffee shop" contain filler words, so they are checked before stripping.
  const meaningful = tokens.filter((token) => !FILLER_WORDS.has(token));
  if (meaningful.length === 0) return null;
  return termIndex.get(meaningful.join(' ')) ?? null;
};
