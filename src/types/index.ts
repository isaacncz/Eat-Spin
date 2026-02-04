export interface Restaurant {
  id: string;
  name: string;
  category: FoodCategory[];
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  hours: {
    [key: string]: {
      open: string;
      close: string;
      closed?: boolean;
    };
  };
  rating: number;
  priceRange: '$' | '$$' | '$$$' | '$$$$';
  phone?: string;
  image?: string;
  description?: string;
  isOpen?: boolean;
  distance?: number;
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
  hours: {
    [key: string]: {
      open: string;
      close: string;
      closed?: boolean;
    };
  };
  rating: number;
  priceRange: Restaurant['priceRange'];
  phone?: string;
  image?: string;
  description: string;
}

export type JsonRestaurantArray = JsonRestaurant[];

// Type for restaurant with generated ID
export type RestaurantWithId = JsonRestaurant & { id: string };

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
