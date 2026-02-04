import { z } from 'zod';

import type { Restaurant, FoodCategory, FoodCategoryConfig, JsonRestaurant } from '@/types';
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

const priceRangeSchema = z.enum(['RM', 'RMR', 'RMRR', 'RMRRR']);
const foodCategorySchema = z.enum(foodCategoryIds);

const hoursSchema = z.record(
  z.object({
    open: z.string(),
    close: z.string(),
    closed: z.boolean().optional(),
  })
);

const jsonRestaurantSchema = z.object({
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

const jsonRestaurantArraySchema = z.array(jsonRestaurantSchema);

const parsedRestaurants = jsonRestaurantArraySchema.safeParse(rawRestaurants);

if (!parsedRestaurants.success) {
  console.error('Invalid restaurant data in restaurants.json', parsedRestaurants.error.format());
  throw new Error('Invalid restaurant data in restaurants.json');
}

const restaurantData: JsonRestaurant[] = parsedRestaurants.data;

// Mock restaurant data for Penang, Malaysia
export const penangRestaurants: Restaurant[] = restaurantData.map((restaurant, index) => ({
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

// Helper function to check if restaurant is currently open
export function isRestaurantOpen(hours: Restaurant['hours']): boolean {
  const now = new Date();
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
    now.getDay()
  ];
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().
    toString()
    .padStart(2, '0')}`;

  const todayHours = hours[dayOfWeek];
  if (!todayHours || todayHours.closed) return false;

  return currentTime >= todayHours.open && currentTime <= todayHours.close;
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
      if (userLocation && restaurant.distance && restaurant.distance > maxDistance) {
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
      if (a.distance && b.distance) {
        return a.distance - b.distance;
      }
      // Otherwise sort by rating
      return b.rating - a.rating;
    });
}
