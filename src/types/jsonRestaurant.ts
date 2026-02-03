// Types for JSON restaurant data (without ID fields)

export interface JsonRestaurant {
  name: string;
  category: string[];
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
  priceRange: string;
  phone?: string;
  description: string;
}

export type JsonRestaurantArray = JsonRestaurant[];

// Type for restaurant with generated ID
export type RestaurantWithId = JsonRestaurant & { id: string };

// Type for enhanced filter function
export interface EnhancedFilterOptions {
  userLocation?: { lat: number; lng: number };
  selectedCategories?: string[];
  radiusKm?: number;
}

export interface RestaurantUtils {
  generateRestaurantId: (index: number) => string;
  calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
  filterByRadius: (
    restaurants: JsonRestaurant[],
    userLocation: { lat: number; lng: number } | null,
    radiusKm: number
  ) => JsonRestaurant[];
  enhancedFilterRestaurants: (
    restaurants: JsonRestaurant[],
    userLocation: { lat: number; lng: number } | null,
    selectedCategories: string[],
    radiusKm: number
  ) => JsonRestaurant[];
}