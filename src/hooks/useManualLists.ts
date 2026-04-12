import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ManualList, MealTime, Restaurant } from '@/types';

const MANUAL_LISTS_STORAGE_KEY = 'eatspin:manual-lists';
const SELECTED_MANUAL_LIST_ID_STORAGE_KEY = 'eatspin:selected-manual-list-id';
const LEGACY_MANUAL_RESTAURANTS_STORAGE_KEY = 'eatspin:manual-restaurants';
const LEGACY_MANUAL_PRESETS_STORAGE_KEY = 'eatspin:manual-presets';

type ManualListMealTime = Exclude<MealTime, 'none'> | null;

interface LegacyManualPreset {
  id: string;
  name: string;
  restaurants: string[];
  mealTime: ManualListMealTime;
  createdAt: number;
}

const isManualListMealTime = (value: unknown): value is ManualListMealTime => (
  value === null || value === 'breakfast' || value === 'lunch' || value === 'dinner'
);

const isManualRestaurant = (restaurant: unknown): restaurant is Restaurant => {
  if (!restaurant || typeof restaurant !== 'object') return false;

  const candidate = restaurant as Partial<Restaurant>;

  return (
    typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.address === 'string'
    && typeof candidate.description === 'string'
    && typeof candidate.rating === 'number'
    && typeof candidate.priceRange === 'string'
    && Array.isArray(candidate.category)
    && typeof candidate.coordinates?.lat === 'number'
    && typeof candidate.coordinates?.lng === 'number'
    && typeof candidate.hours === 'object'
  );
};

const parseManualRestaurants = (value: string | null): Restaurant[] => {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isManualRestaurant);
  } catch {
    return [];
  }
};

const parseLegacyManualPresets = (value: string | null): LegacyManualPreset[] => {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((preset): preset is LegacyManualPreset => {
      const candidate = preset as Partial<LegacyManualPreset>;
      return (
        typeof candidate.id === 'string'
        && typeof candidate.name === 'string'
        && Array.isArray(candidate.restaurants)
        && candidate.restaurants.every((restaurant) => typeof restaurant === 'string')
        && isManualListMealTime(candidate.mealTime)
        && typeof candidate.createdAt === 'number'
      );
    });
  } catch {
    return [];
  }
};

const parseManualLists = (value: string | null): ManualList[] => {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((list): list is ManualList => {
      const candidate = list as Partial<ManualList>;
      return (
        typeof candidate.id === 'string'
        && typeof candidate.name === 'string'
        && isManualListMealTime(candidate.mealTime)
        && Array.isArray(candidate.restaurants)
        && candidate.restaurants.every(isManualRestaurant)
        && typeof candidate.createdAt === 'number'
        && typeof candidate.updatedAt === 'number'
      );
    });
  } catch {
    return [];
  }
};

const normalizeManualNames = (names: string[]) => (
  names
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name, index, list) => list.findIndex((entry) => entry.toLowerCase() === name.toLowerCase()) === index)
);

const createManualListId = () => `manual-list-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getMealTimeLabel = (mealTime: ManualListMealTime): string => {
  if (mealTime === 'breakfast') return 'Breakfast';
  if (mealTime === 'lunch') return 'Lunch';
  if (mealTime === 'dinner') return 'Dinner';
  return '';
};

export const getSuggestedManualListName = (baseName: string, mealTime: ManualListMealTime): string => {
  const trimmedName = baseName.trim().replace(/\s+/g, ' ');
  const mealLabel = mealTime ? mealTime.toLowerCase() : '';

  if (!trimmedName) {
    return mealTime ? `${getMealTimeLabel(mealTime)} list` : 'My list';
  }

  if (!mealLabel) return trimmedName;

  const normalizedName = trimmedName.toLowerCase();
  if (normalizedName.includes(mealLabel)) return trimmedName;

  return trimmedName.includes(' ')
    ? `${trimmedName} ${mealLabel}`
    : `${trimmedName} ${mealLabel} list`;
};

const createManualList = ({
  name,
  mealTime,
  restaurants,
}: {
  name: string;
  mealTime: ManualListMealTime;
  restaurants: Restaurant[];
}): ManualList => {
  const now = Date.now();
  const trimmedName = name.trim();

  return {
    id: createManualListId(),
    name: trimmedName || getSuggestedManualListName('', mealTime),
    restaurants,
    mealTime,
    createdAt: now,
    updatedAt: now,
  };
};

const sortManualLists = (lists: ManualList[]) => [...lists].sort((a, b) => b.updatedAt - a.updatedAt);

const loadInitialManualLists = (): ManualList[] => {
  if (typeof window === 'undefined') {
    return [createManualList({ name: 'My list', mealTime: null, restaurants: [] })];
  }

  const storedLists = parseManualLists(window.localStorage.getItem(MANUAL_LISTS_STORAGE_KEY));
  if (storedLists.length > 0) return sortManualLists(storedLists);

  const legacyPresets = parseLegacyManualPresets(window.localStorage.getItem(LEGACY_MANUAL_PRESETS_STORAGE_KEY));
  const migratedLists: ManualList[] = legacyPresets.map((preset) => ({
    id: preset.id,
    name: preset.name.trim() || getSuggestedManualListName('', preset.mealTime),
    restaurants: normalizeManualNames(preset.restaurants).map((restaurantName, index) => ({
      id: `manual-${preset.id}-${index}`,
      name: restaurantName,
      category: ['street food'] as const,
      address: 'Your custom pick',
      coordinates: { lat: 0, lng: 0 },
      hours: {
        daily: { windows: [{ open: '00:00', close: '23:59' }] },
      },
      rating: 5,
      priceRange: '$$',
      description: 'Great choice. Your next food adventure starts here.',
    })),
    mealTime: preset.mealTime,
    createdAt: preset.createdAt,
    updatedAt: preset.createdAt,
  }));

  const legacyRestaurants = parseManualRestaurants(window.localStorage.getItem(LEGACY_MANUAL_RESTAURANTS_STORAGE_KEY));
  if (legacyRestaurants.length > 0) {
    migratedLists.unshift(createManualList({
      name: 'My list',
      mealTime: null,
      restaurants: legacyRestaurants,
    }));
  }

  if (migratedLists.length > 0) return sortManualLists(migratedLists);

  return [createManualList({ name: 'My list', mealTime: null, restaurants: [] })];
};

const getInitialSelectedId = (lists: ManualList[]): string => {
  if (typeof window === 'undefined') return lists[0]?.id ?? '';

  const storedSelectedId = window.localStorage.getItem(SELECTED_MANUAL_LIST_ID_STORAGE_KEY);
  if (storedSelectedId && lists.some((list) => list.id === storedSelectedId)) {
    return storedSelectedId;
  }

  return lists[0]?.id ?? '';
};

const pickDeterministicList = (lists: ManualList[], mealTime: ManualListMealTime): ManualList | null => {
  if (lists.length === 0) return null;

  if (mealTime) {
    const matchingLists = lists.filter((list) => list.mealTime === mealTime);
    if (matchingLists.length > 0) return sortManualLists(matchingLists)[0];
  }

  return sortManualLists(lists)[0] ?? null;
};

export const getManualListMealTimeLabel = getMealTimeLabel;

export const getMealTimeEmoji = (mealTime: ManualListMealTime): string => {
  if (mealTime === 'breakfast') return '🌅';
  if (mealTime === 'lunch') return '☀️';
  if (mealTime === 'dinner') return '🌙';
  return '';
};

const loadInitialState = () => {
  const manualLists = loadInitialManualLists();
  return {
    manualLists,
    selectedManualListId: getInitialSelectedId(manualLists),
  };
};

export function useManualLists() {
  const [{ manualLists: initialManualLists, selectedManualListId: initialSelectedManualListId }] = useState(loadInitialState);
  const [manualLists, setManualLists] = useState<ManualList[]>(initialManualLists);
  const [selectedManualListId, setSelectedManualListId] = useState<string>(initialSelectedManualListId);

  const selectedManualList = useMemo(
    () => manualLists.find((list) => list.id === selectedManualListId) ?? manualLists[0] ?? null,
    [manualLists, selectedManualListId],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(MANUAL_LISTS_STORAGE_KEY, JSON.stringify(manualLists));
  }, [manualLists]);

  useEffect(() => {
    if (typeof window === 'undefined' || !selectedManualList) return;
    window.localStorage.setItem(SELECTED_MANUAL_LIST_ID_STORAGE_KEY, selectedManualList.id);
  }, [selectedManualList]);

  const selectManualList = useCallback((listId: string) => {
    setManualLists((currentLists) => {
      const now = Date.now();
      const nextLists = currentLists.map((list) => (
        list.id === listId
          ? { ...list, updatedAt: now }
          : list
      ));
      return sortManualLists(nextLists);
    });
    setSelectedManualListId(listId);
  }, []);

  const createNewManualList = useCallback((
    { name, mealTime, restaurants = [] }: { name: string; mealTime: ManualListMealTime; restaurants?: Restaurant[] },
  ) => {
    const newList = createManualList({
      name,
      mealTime,
      restaurants,
    });

    setManualLists((currentLists) => [newList, ...currentLists]);
    setSelectedManualListId(newList.id);
    return newList;
  }, []);

  const updateSelectedManualList = useCallback((updates: Partial<Pick<ManualList, 'name' | 'mealTime' | 'restaurants'>>) => {
    setManualLists((currentLists) => currentLists.map((list) => {
      if (list.id !== selectedManualListId) return list;
      return {
        ...list,
        ...updates,
        updatedAt: Date.now(),
      };
    }).sort((a, b) => b.updatedAt - a.updatedAt));
  }, [selectedManualListId]);

  const deleteManualList = useCallback((listId: string) => {
    const remainingLists = manualLists.filter((list) => list.id !== listId);
    if (remainingLists.length === 0) {
      const fallbackList = createManualList({ name: 'My list', mealTime: null, restaurants: [] });
      setManualLists([fallbackList]);
      setSelectedManualListId(fallbackList.id);
      return fallbackList;
    }

    setManualLists(sortManualLists(remainingLists));
    if (selectedManualListId === listId) {
      setSelectedManualListId(sortManualLists(remainingLists)[0].id);
    }

    return null;
  }, [manualLists, selectedManualListId]);

  const selectDeterministicManualList = useCallback((mealTime: ManualListMealTime) => {
    const nextList = pickDeterministicList(manualLists, mealTime);
    if (!nextList || nextList.id === selectedManualList?.id) return nextList;
    setSelectedManualListId(nextList.id);
    return nextList;
  }, [manualLists, selectedManualList?.id]);

  return {
    manualLists,
    selectedManualList,
    selectedManualListId: selectedManualList?.id ?? '',
    selectManualList,
    createNewManualList,
    updateSelectedManualList,
    deleteManualList,
    selectDeterministicManualList,
  };
}
