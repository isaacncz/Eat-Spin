import { z } from 'zod';

import type { DailyHours, Restaurant, FoodCategory, FoodCategoryConfig, JsonRestaurant } from '@/types';
import { generateRestaurantId } from '@/lib/restaurantUtils';
import rawRestaurants from './restaurants.json';

const foodCategoryIds = [
  'soup',
  'rice',
  'noodles',
  'seafood',
  'chicken',
  'beef',
  'vegetarian',
  'street food',
  'cafe',
  'dessert',
  'bakery',
  'western',
  'chinese',
  'malay',
  'indian',
  'thai',
  'japanese',
  'korean',
  'breakfast',
] as const satisfies ReadonlyArray<FoodCategory>;

const priceRangeSchema = z.enum(['$', '$$', '$$$', '$$$$']);
const foodCategorySchema = z.enum(foodCategoryIds);

type LegacyDailyHours = {
  open: string;
  close: string;
  closed?: boolean;
};

type RawDailyHours = DailyHours | LegacyDailyHours;
type RawJsonRestaurant = Omit<JsonRestaurant, 'hours' | 'phone'> & {
  hours: Record<string, RawDailyHours>;
  phone?: string | null;
};

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const timeStringSchema = z.string().regex(timeRegex, 'Invalid time format, expected HH:mm');

const timeWindowSchema = z.object({
  open: timeStringSchema,
  close: timeStringSchema,
});

const strictDailyHoursSchema: z.ZodType<DailyHours> = z
  .object({
    windows: z.array(timeWindowSchema),
    closed: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (value.closed === true && value.windows.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'closed=true requires windows to be empty',
      });
    }

    if (value.closed !== true && value.windows.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'closed!==true requires at least one time window',
      });
    }
  });

const rawDailyHoursSchema: z.ZodType<DailyHours> = z.object({
  windows: z.array(timeWindowSchema),
  closed: z.boolean().optional(),
});

const legacyDailyHoursSchema: z.ZodType<LegacyDailyHours> = z.object({
  open: timeStringSchema,
  close: timeStringSchema,
  closed: z.boolean().optional(),
});

const rawHoursSchema: z.ZodType<RawJsonRestaurant['hours']> = z.record(
  z.string(),
  z.union([rawDailyHoursSchema, legacyDailyHoursSchema])
);

const hoursSchema: z.ZodType<JsonRestaurant['hours']> = z.record(z.string(), strictDailyHoursSchema);

const jsonRestaurantSchema: z.ZodType<JsonRestaurant> = z.object({
  name: z.string().min(1),
  category: z.array(foodCategorySchema).min(1),
  address: z.string().min(1),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  hours: hoursSchema,
  rating: z.number(),
  priceRange: priceRangeSchema,
  phone: z.string().optional(),
  image: z.string().optional(),
  description: z.string().min(1),
});

const rawJsonRestaurantSchema: z.ZodType<RawJsonRestaurant> = z.object({
  name: z.string().min(1),
  category: z.array(foodCategorySchema).min(1),
  address: z.string().min(1),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  hours: rawHoursSchema,
  rating: z.number(),
  priceRange: priceRangeSchema,
  phone: z.string().nullable().optional(),
  image: z.string().optional(),
  description: z.string().min(1),
});

const rawJsonRestaurantArraySchema: z.ZodType<RawJsonRestaurant[]> = z.array(rawJsonRestaurantSchema);
const jsonRestaurantArraySchema: z.ZodType<JsonRestaurant[]> = z.array(jsonRestaurantSchema);

const isLegacyDailyHours = (dayHours: RawDailyHours): dayHours is LegacyDailyHours =>
  'open' in dayHours && 'close' in dayHours;

const normalizeDailyHours = (dayHours: RawDailyHours): DailyHours => {
  if (isLegacyDailyHours(dayHours)) {
    if (dayHours.closed === true || (dayHours.open === '00:00' && dayHours.close === '00:00')) {
      return { closed: true, windows: [] };
    }

    return {
      windows: [{ open: dayHours.open, close: dayHours.close }],
    };
  }

  if (dayHours.closed === true) {
    return { closed: true, windows: [] };
  }

  if (dayHours.windows.length === 0) {
    return { closed: true, windows: [] };
  }

  return {
    windows: dayHours.windows,
  };
};

const normalizeRestaurantHours = (hours: RawJsonRestaurant['hours']): JsonRestaurant['hours'] => {
  return Object.fromEntries(
    Object.entries(hours).map(([dayKey, dayHours]) => [dayKey, normalizeDailyHours(dayHours)])
  );
};

const restaurantData = rawJsonRestaurantArraySchema.safeParse(rawRestaurants);

if (!restaurantData.success) {
  console.error('Invalid restaurant data in restaurants.json', restaurantData.error.format());
  throw new Error('Invalid restaurant data in restaurants.json');
}

const normalizedRestaurantData = restaurantData.data.map((restaurant) => ({
  ...restaurant,
  phone: restaurant.phone ?? undefined,
  hours: normalizeRestaurantHours(restaurant.hours),
}));

const normalizedRestaurantParse = jsonRestaurantArraySchema.safeParse(normalizedRestaurantData);

if (!normalizedRestaurantParse.success) {
  console.error('Invalid normalized restaurant data in restaurants.json', normalizedRestaurantParse.error.format());
  throw new Error('Invalid normalized restaurant data in restaurants.json');
}

// Mock restaurant data for Penang, Malaysia
export const penangRestaurants: Restaurant[] = normalizedRestaurantParse.data.map((restaurant, index) => ({
  ...restaurant,
  id: generateRestaurantId(index),
}));

export const foodCategories: FoodCategoryConfig[] = [
  { id: 'soup', name: 'Soup', icon: '🍲', color: '#FF6B6B' },
  { id: 'rice', name: 'Rice', icon: '🍚', color: '#4ECDC4' },
  { id: 'noodles', name: 'Noodles', icon: '🍜', color: '#45B7D1' },
  { id: 'seafood', name: 'Seafood', icon: '🦐', color: '#96CEB4' },
  { id: 'chicken', name: 'Chicken', icon: '🍗', color: '#FFEAA7' },
  { id: 'beef', name: 'Beef', icon: '🥩', color: '#DDA0DD' },
  { id: 'vegetarian', name: 'Vegetarian', icon: '🥗', color: '#98D8C8' },
  { id: 'street food', name: 'Street Food', icon: '🌮', color: '#F7DC6F' },
  { id: 'cafe', name: 'Cafe', icon: '☕', color: '#BB8FCE' },
  { id: 'dessert', name: 'Dessert', icon: '🧁', color: '#F8C471' },
  { id: 'bakery', name: 'Bakery', icon: '🥐', color: '#E59866' },
  { id: 'western', name: 'Western', icon: '🍔', color: '#85C1E9' },
  { id: 'chinese', name: 'Chinese', icon: '🥟', color: '#F1948A' },
  { id: 'malay', name: 'Malay', icon: '🍛', color: '#F39C12' },
  { id: 'indian', name: 'Indian', icon: '🍛', color: '#E74C3C' },
  { id: 'thai', name: 'Thai', icon: '🌶️', color: '#FF7675' },
  { id: 'japanese', name: 'Japanese', icon: '🍣', color: '#74B9FF' },
  { id: 'korean', name: 'Korean', icon: '🔥', color: '#A29BFE' },
];

// Helper function to calculate distance between two coordinates in km
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

const getDayKey = (date: Date, offset: number = 0): string => {
  const index = (date.getDay() + offset + 7) % 7;
  return dayKeys[index];
};

const resolveDayHours = (hours: Restaurant['hours'], dayKey: string): DailyHours | undefined => {
  return hours[dayKey] ?? hours.daily ?? Object.values(hours)[0];
};

const toMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const isOpenInTodayWindow = (currentMinutes: number, openMinutes: number, closeMinutes: number): boolean => {
  if (openMinutes <= closeMinutes) {
    return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
  }

  // Overnight window starting today: active from open until midnight.
  return currentMinutes >= openMinutes;
};

const isOpenFromPreviousDayOvernight = (
  currentMinutes: number,
  openMinutes: number,
  closeMinutes: number
): boolean => {
  if (openMinutes <= closeMinutes) {
    return false;
  }

  // Overnight window from previous day: active from midnight to close.
  return currentMinutes <= closeMinutes;
};

const isOpenInDayHours = (dayHours: DailyHours | undefined, currentMinutes: number): boolean => {
  if (!dayHours || dayHours.closed || dayHours.windows.length === 0) {
    return false;
  }

  return dayHours.windows.some((window) => {
    const openMinutes = toMinutes(window.open);
    const closeMinutes = toMinutes(window.close);
    return isOpenInTodayWindow(currentMinutes, openMinutes, closeMinutes);
  });
};

const isOpenFromPreviousDayHours = (dayHours: DailyHours | undefined, currentMinutes: number): boolean => {
  if (!dayHours || dayHours.closed || dayHours.windows.length === 0) {
    return false;
  }

  return dayHours.windows.some((window) => {
    const openMinutes = toMinutes(window.open);
    const closeMinutes = toMinutes(window.close);
    return isOpenFromPreviousDayOvernight(currentMinutes, openMinutes, closeMinutes);
  });
};

// Helper function to check if restaurant is currently open
export function isRestaurantOpen(hours: Restaurant['hours']): boolean {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const todayHours = resolveDayHours(hours, getDayKey(now));
  const previousDayHours = resolveDayHours(hours, getDayKey(now, -1));

  if (isOpenInDayHours(todayHours, currentMinutes)) {
    return true;
  }

  return isOpenFromPreviousDayHours(previousDayHours, currentMinutes);
}

// Helper function to get current meal time
export function getCurrentMealTime(): 'breakfast' | 'lunch' | 'dinner' | 'none' {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 17 && hour < 22) return 'dinner';
  return 'none';
}

// Filter restaurants by distance and category preferences
export function filterRestaurants(
  restaurants: Restaurant[],
  userLocation: { lat: number; lng: number } | null,
  selectedCategories: FoodCategory[],
  maxDistance: number = 2
): Restaurant[] {
  return restaurants
    .map((restaurant) => {
      if (userLocation) {
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          restaurant.coordinates.lat,
          restaurant.coordinates.lng
        );
        return { ...restaurant, distance };
      }
      return restaurant;
    })
    .filter((restaurant) => {
      // Filter by distance
      if (userLocation && restaurant.distance !== undefined && restaurant.distance > maxDistance) {
        return false;
      }

      // Filter by categories - restaurant must have at least one selected category
      if (selectedCategories.length > 0) {
        const hasMatchingCategory = restaurant.category.some((cat) => selectedCategories.includes(cat));
        if (!hasMatchingCategory) return false;
      }

      // Filter by open status
      return isRestaurantOpen(restaurant.hours);
    })
    .sort((a, b) => {
      // Sort by distance if available
      if (a.distance !== undefined && b.distance !== undefined) {
        return a.distance - b.distance;
      }
      // Otherwise sort by rating
      return b.rating - a.rating;
    });
}
