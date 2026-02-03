import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getCurrentMealTime = (): 'breakfast' | 'lunch' | 'dinner' | 'none' => {
  const now = new Date()
  const hours = now.getHours()

  if (hours >= 5 && hours < 11) return 'breakfast'
  if (hours >= 11 && hours < 16) return 'lunch'
  if (hours >= 16 && hours < 21) return 'dinner'
  return 'none'
};
