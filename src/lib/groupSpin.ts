import type { Restaurant } from '@/types';

const ROOM_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface GroupParticipant {
  id: string;
  name: string;
  ready: boolean;
  joinedAt: number;
}

export interface GroupRoomState {
  status: 'lobby' | 'spinning' | 'done';
  resultRestaurantId?: string;
  updatedAt: number;
}

export const createParticipantId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const generateRoomCode = (length = 5): string => {
  const safeLength = Math.min(6, Math.max(4, length));
  let code = '';

  for (let index = 0; index < safeLength; index += 1) {
    const randomValue = Math.floor(Math.random() * ROOM_CHARSET.length);
    code += ROOM_CHARSET[randomValue];
  }

  return code;
};

export const generateSeed = (): number => Math.floor(Math.random() * 2_147_483_647);

const normalizeSeed = (seed: number): number => {
  const parsedSeed = Math.floor(Math.abs(seed));
  return parsedSeed === 0 ? 1 : parsedSeed;
};

const mulberry32 = (seed: number) => {
  let state = normalizeSeed(seed);

  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const getDeterministicSpinIndex = (seed: number, total: number): number => {
  if (total <= 0) return -1;

  const random = mulberry32(seed);
  return Math.floor(random() * total);
};

export const getDeterministicRestaurant = (restaurants: Restaurant[], seed: number): Restaurant | null => {
  if (restaurants.length === 0) return null;

  const selectedIndex = getDeterministicSpinIndex(seed, restaurants.length);
  return restaurants[selectedIndex] ?? null;
};

export const participantsStorageKey = (roomCode: string): string => `eatspin:group:${roomCode}:participants`;
export const roomStateStorageKey = (roomCode: string): string => `eatspin:group:${roomCode}:state`;
