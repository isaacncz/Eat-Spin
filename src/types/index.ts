export type CategoryConfidence = 'high' | 'medium' | 'low';

export type DietaryTag =
  | 'halal-certified'
  | 'muslim-friendly'
  | 'pork-free'
  | 'vegetarian-friendly'
  | 'vegan-friendly'
  | 'alcohol-free';

export type AmbianceTag =
  | 'hawker'
  | 'kopitiam'
  | 'air-cond'
  | 'outdoor'
  | 'fine-dining'
  | 'family-friendly';

export interface Restaurant {
  id: string;
  name: string;
  category: FoodCategory[];
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  hours: Record<string, DailyHours>;
  rating: number;
  priceRange: '$' | '$$' | '$$$' | '$$$$';
  phone?: string;
  image?: string;
  description?: string;
  isOpen?: boolean;
  distance?: number;
  userRatingCount?: number;
  googlePlaceId?: string;
  source?: 'google-live' | 'google-cache' | 'local-fallback';
  hasKnownPriceRange?: boolean;
  /**
   * How confident the classification pipeline is about this restaurant's categories.
   * - `high`: primaryType or cuisine-specific API query confirms the category
   * - `medium`: multiple signals agree (type mapper + name heuristic)
   * - `low`: weak/no signal — generic restaurant or heuristic-only guess
   */
  categoryConfidence?: CategoryConfidence;
  /** Granular cuisine sub-styles enriched from OSM or manual data (e.g. 'hokkien', 'dim sum'). */
  cuisineSubtype?: string[];
  /** Notable dishes associated with the restaurant (e.g. 'char kuey teow', 'assam laksa'). */
  signatureDishes?: string[];
  /** Structured dietary tags enriched from OSM or manual data. */
  dietaryTags?: DietaryTag[];
  /** Ambiance / venue-type tags enriched from OSM or manual data. */
  ambiance?: AmbianceTag[];
}

// Type for JSON restaurant data (without ID fields)
export interface JsonRestaurant {
  name: string;
  category: FoodCategory[];
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  hours: Record<string, DailyHours>;
  rating: number;
  priceRange: Restaurant['priceRange'];
  phone?: string;
  image?: string;
  description: string;
  cuisineSubtype?: string[];
  signatureDishes?: string[];
  dietaryTags?: DietaryTag[];
  ambiance?: AmbianceTag[];
}

export type JsonRestaurantArray = JsonRestaurant[];

// Type for restaurant with generated ID
export type RestaurantWithId = JsonRestaurant & { id: string };

export interface TimeWindow {
  open: string;
  close: string;
}

export interface DailyHours {
  windows: TimeWindow[];
  closed?: boolean;
}

export type FoodCategory = 
  | 'soup'
  | 'rice'
  | 'noodles' 
  | 'seafood'
  | 'chicken'
  | 'beef'
  | 'vegetarian'
  | 'street food'
  | 'cafe'
  | 'dessert'
  | 'bakery'
  | 'western'
  | 'chinese'
  | 'malay'
  | 'indian'
  | 'thai'
  | 'japanese'
  | 'korean'
  | 'breakfast';

export interface UserLocation {
  lat: number;
  lng: number;
  address?: string;
}

export interface SpinResult {
  restaurant: Restaurant;
  timestamp: Date;
  mealTime: MealTime;
}

export type MealTime = 'breakfast' | 'lunch' | 'dinner' | 'none';
export type ManualListMealTime = Exclude<MealTime, 'none'> | null;

export interface ManualList {
  id: string;
  name: string;
  restaurants: Restaurant[];
  mealTime: ManualListMealTime;
  createdAt: number;
  updatedAt: number;
}

export interface UserPreferences {
  selectedCategories: FoodCategory[];
  maxDistance: number; // in km
  priceRange?: ('$' | '$$' | '$$$' | '$$$$')[];
}

export interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  spinsPerMeal: number;
  features: string[];
}

export interface FoodCategoryConfig {
  id: FoodCategory;
  name: string;
  icon: string;
  color: string;
}
