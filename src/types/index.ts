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
  priceRange: 'RM' | 'RMR' | 'RMRR' | 'RMRRR';
  phone?: string;
  image?: string;
  description?: string;
  isOpen?: boolean;
  distance?: number;
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

export interface UserPreferences {
  selectedCategories: FoodCategory[];
  maxDistance: number; // in km
  priceRange?: ('RM' | 'RMR' | 'RMRR' | 'RMRRR')[];
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
