import { z } from 'zod';

import type {
  Restaurant,
  FoodCategory,
  FoodCategoryConfig,
  JsonRestaurant,
  RestaurantHours,
  Weekday,
} from '@/types';
import { generateRestaurantId } from '@/lib/restaurantUtils';
import { loadRestaurantsForRegions } from '@/assets/data/registry';

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

const weekdayKeys = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const satisfies ReadonlyArray<Weekday>;

const hhmmRegex = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const malaysiaPhoneRegex = /^\+60 1\d-\d{7}$/;

const priceRangeSchema = z.enum(['$', '$$', '$$$']);
const foodCategorySchema = z.enum(foodCategoryIds);

const dailyHoursSchema = z.object({
  open: z.string().regex(hhmmRegex, 'Must be HH:mm'),
  close: z.string().regex(hhmmRegex, 'Must be HH:mm'),
  closed: z.boolean().optional(),
});

const hoursSchema: z.ZodType<RestaurantHours> = z.object({
  monday: dailyHoursSchema,
  tuesday: dailyHoursSchema,
  wednesday: dailyHoursSchema,
  thursday: dailyHoursSchema,
  friday: dailyHoursSchema,
  saturday: dailyHoursSchema,
  sunday: dailyHoursSchema,
});

const jsonRestaurantSchema: z.ZodType<JsonRestaurant> = z.object({
  name: z.string().min(1),
  category: z.array(foodCategorySchema).min(1),
  address: z.string().min(1),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  hours: hoursSchema,
  rating: z.number().min(0).max(5),
  priceRange: priceRangeSchema,
  phone: z.string().regex(malaysiaPhoneRegex, 'Invalid Malaysian phone format'),
  image: z.string().optional(),
  description: z.string().min(1).max(100),
});

const jsonRestaurantArraySchema: z.ZodType<JsonRestaurant[]> = z.array(jsonRestaurantSchema);

export const loadPenangRestaurants = async (
  regions: Array<'island' | 'mainland'> = ['island', 'mainland']
): Promise<Restaurant[]> => {
  const rawData = await loadRestaurantsForRegions(regions);
  const restaurantData = jsonRestaurantArraySchema.safeParse(rawData);

  if (!restaurantData.success) {
    console.error('Invalid restaurant data in area JSON files', restaurantData.error.format());
    throw new Error('Invalid restaurant data in area JSON files');
  }

  return restaurantData.data.map((restaurant, index) => ({
    ...restaurant,
    id: generateRestaurantId(index),
  }));
};

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
  { id: 'breakfast', name: 'Breakfast', icon: '🍳', color: '#F7B267' },
];

export function isRestaurantOpen(hours: Restaurant['hours']): boolean {
  const dayOfWeek = weekdayKeys[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const currentTime = `${new Date().getHours().toString().padStart(2, '0')}:${new Date()
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;

  const todayHours = hours[dayOfWeek];
  if (!todayHours || todayHours.closed) return false;

  return currentTime >= todayHours.open && currentTime <= todayHours.close;
}
