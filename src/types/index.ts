export type CategoryConfidence = 'high' | 'medium' | 'low';

/** A single Google Places review (up to 5 per place). */
export interface PlaceReview {
  authorName: string;
  authorPhotoUri?: string;
  rating: number;
  text: string;
  relativeTime: string;
  publishTime?: string;
}

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
  /** Official Google Maps URL for this place. */
  googleMapsUri?: string;
  /** Restaurant's own website URL. */
  websiteUri?: string;
  /** Whether the restaurant offers delivery. */
  delivery?: boolean;
  /** Whether the restaurant offers takeout. */
  takeout?: boolean;
  /** Whether the restaurant offers dine-in. */
  dineIn?: boolean;
  /** Whether the place serves coffee. */
  servesCoffee?: boolean;
  /** Whether the place serves breakfast. */
  servesBreakfast?: boolean;
  /** Whether the place serves brunch. */
  servesBrunch?: boolean;
  /** Whether the place serves lunch. */
  servesLunch?: boolean;
  /** Whether the place serves dinner. */
  servesDinner?: boolean;
  /** Whether the place serves dessert. */
  servesDessert?: boolean;
  /** Whether the place serves vegetarian food. */
  servesVegetarianFood?: boolean;
  /** Whether the place is good for groups. */
  goodForGroups?: boolean;
  /** Whether the place is good for children. */
  goodForChildren?: boolean;
  /** Whether the place has outdoor seating. */
  outdoorSeating?: boolean;
  /** AI-generated summary from Google. */
  generativeSummary?: string;
  /** Multiple photo URLs from Google Places (up to 10). */
  photos?: string[];
  /** Up to 5 recent Google reviews. */
  reviews?: PlaceReview[];
  /**
   * How confident the classification pipeline is about this restaurant's categories.
   * - `high`: primaryType or cuisine-specific API query confirms the category
   * - `medium`: multiple signals agree (type mapper + name heuristic)
   * - `low`: weak/no signal — generic restaurant or heuristic-only guess
   */
  categoryConfidence?: CategoryConfidence;
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
  | 'breakfast'
  | 'bubble-tea'
  | 'pizza'
  | 'fast-food'
  | 'hotpot'
  | 'bbq'
  | 'brunch';

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
