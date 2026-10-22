import type { MealTime } from '@/types';

export type FoodMood = 'quick-bite' | 'treat-myself' | 'healthy' | 'surprise-me';

/** The quick presets on the Spin screen. App maps each one to filters. */
export const MOOD_OPTIONS: { id: FoodMood; label: string }[] = [
  { id: 'quick-bite', label: 'Quick Bite' },
  { id: 'treat-myself', label: 'Treat Myself' },
  { id: 'healthy', label: 'Healthy' },
  { id: 'surprise-me', label: 'Surprise Me!' },
];

/** Last word of "What's for ...?" for each meal time. */
export const MEAL_HEADING_WORD: Record<MealTime, string> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  none: 'eating',
};
