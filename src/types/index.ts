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
  description?: string;
  /** Legacy: favourites saved before Google Places was removed use this as their ID. */
  googlePlaceId?: string;
}

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
