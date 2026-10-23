import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { toast } from 'sonner';
import { applyListOperations, restaurantDelta, parseListBackup, backupListData, type ListOperation } from '@/lib/listOperations';

import type { ManualList, MealTime, Restaurant } from '@/types';

const JOURNAL_PREFIX = 'eatspin:manual-op:';
const BASE_KEY = 'eatspin:manual-base:v2';
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
    && candidate.hours !== null && typeof candidate.hours === 'object'
    && candidate.category.every(value => typeof value === 'string')
    && Number.isFinite(candidate.rating) && Number.isFinite(candidate.coordinates.lat) && Number.isFinite(candidate.coordinates.lng)
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

export const isManualList = (value: unknown): value is ManualList => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ManualList>;
  return typeof candidate.id === 'string' && typeof candidate.name === 'string'
    && isManualListMealTime(candidate.mealTime)
    && Array.isArray(candidate.restaurants)
    && candidate.restaurants.every(isManualRestaurant)
    && new Set(candidate.restaurants.map(item => item.id)).size === candidate.restaurants.length
    && Number.isFinite(candidate.createdAt) && Number.isFinite(candidate.updatedAt);
};

const parseManualLists = (value: string | null): ManualList[] => {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isManualList);
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

const createManualListId = () => `manual-list-${crypto.randomUUID()}`;

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
    return [{ ...createManualList({ name: 'My list', mealTime: null, restaurants: [] }), id: 'manual-list-default', createdAt: 1, updatedAt: 1 }];
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
    migratedLists.unshift({ ...createManualList({
      name: 'My list',
      mealTime: null,
      restaurants: legacyRestaurants,
    }), id: 'manual-list-migrated-restaurants', createdAt: 1, updatedAt: 1 });
  }

  if (migratedLists.length > 0) return sortManualLists(migratedLists);

  return [{ ...createManualList({ name: 'My list', mealTime: null, restaurants: [] }), id: 'manual-list-default', createdAt: 1, updatedAt: 1 }];
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

const readOperations = (): ListOperation[] => {
  const operations: ListOperation[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(JOURNAL_PREFIX)) {
      const value = JSON.parse(window.localStorage.getItem(key) ?? 'null') as ListOperation | null;
      if (!value || typeof value.id !== 'string' || typeof value.clock !== 'number'
        || !['create', 'createMany', 'patch', 'delete'].includes(value.kind)) throw new Error('Saved list journal is damaged. Export a backup before resetting storage.');
      operations.push(value);
    }
  }
  return operations;
};

const readState = () => {
  const storedBase = window.localStorage.getItem(BASE_KEY);
  const base = storedBase ? parseManualLists(storedBase) : loadInitialManualLists();
  if (!storedBase) {
    // Synchronous migration commits once. Leave all legacy keys intact for recovery.
    window.localStorage.setItem(BASE_KEY, JSON.stringify(base));
  }
  const lists = applyListOperations(base, readOperations());
  // Compatibility snapshot for existing consumers. Once v2 exists it is never a write source.
  try { window.localStorage.setItem(MANUAL_LISTS_STORAGE_KEY, JSON.stringify(lists)); } catch { /* Journal remains durable. */ }
  return lists;
};

const loadInitialState = () => {
  try {
    const manualLists = typeof window === 'undefined' ? loadInitialManualLists() : readState();
    return { manualLists, selectedManualListId: getInitialSelectedId(manualLists), error: null as string | null };
  } catch (error) {
    let manualLists: ManualList[] = [];
    try { manualLists = loadInitialManualLists(); } catch { /* Keep damaged/unavailable storage intact. */ }
    return { manualLists, selectedManualListId: '', error: String(error) };
  }
};

export function useManualLists() {
  const [initial] = useState(loadInitialState);
  const [manualLists, setManualLists] = useState(initial.manualLists);
  const [selectedManualListId, setSelectedManualListId] = useState(initial.selectedManualListId);
  const [saveError, setSaveError] = useState<string | null>(initial.error);
  const pendingRef = useRef<ListOperation | null>(null);
  const selectedManualList = useMemo(() => manualLists.find(list => list.id === selectedManualListId) ?? manualLists[0] ?? null,
    [manualLists, selectedManualListId]);

  const refresh = useCallback(() => {
    try { setManualLists(readState()); if (!pendingRef.current) setSaveError(null); }
    catch (error) { setSaveError(String(error)); }
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea === window.localStorage && (event.key === null || event.key === BASE_KEY || event.key.startsWith(JOURNAL_PREFIX))) refresh();
    };
    window.addEventListener('storage', onStorage);
    const initialRefresh = window.setTimeout(refresh, 0);
    return () => { window.clearTimeout(initialRefresh); window.removeEventListener('storage', onStorage); };
  }, [refresh]);

  const persist = useCallback((input: Omit<ListOperation, 'id' | 'clock'>) => {
    if (pendingRef.current) { toast.error('Retry the unsaved change before editing again.'); return false; }
    const operation: ListOperation = { ...input, id: crypto.randomUUID(), clock: Date.now() };
    try {
      operation.clock = readOperations().reduce((clock, op) => Math.max(clock, op.clock + 1), operation.clock);
      pendingRef.current = operation;
      window.localStorage.setItem(JOURNAL_PREFIX + operation.id, JSON.stringify(operation));
      pendingRef.current = null;
      setSaveError(null);
      setManualLists(readState());
      return true;
    } catch (error) {
      setSaveError(String(error));
      toast.error('List changes could not be saved. Free storage and retry.');
      return false;
    }
  }, []);

  const retrySave = useCallback(() => {
    const operation = pendingRef.current;
    if (!operation) { refresh(); return; }
    try {
      window.localStorage.setItem(JOURNAL_PREFIX + operation.id, JSON.stringify(operation));
      pendingRef.current = null;
      setSaveError(null);
      refresh();
    } catch (error) { setSaveError(String(error)); }
  }, [refresh]);

  const selectManualList = useCallback((id: string) => {
    setSelectedManualListId(id);
    try { window.localStorage.setItem(SELECTED_MANUAL_LIST_ID_STORAGE_KEY, id); }
    catch (error) { setSaveError(String(error)); }
  }, []);
  const createNewManualList = useCallback((input: { name: string; mealTime: ManualListMealTime; restaurants?: Restaurant[] }) => {
    const list = createManualList({ ...input, restaurants: input.restaurants ?? [] });
    if (!persist({ kind: 'create', listId: list.id, value: list })) throw new Error('Could not save list.');
    selectManualList(list.id);
    return list;
  }, [persist, selectManualList]);

  const updateSelectedManualList = useCallback((updates: Partial<Pick<ManualList, 'name' | 'mealTime' | 'restaurants'>>) => {
    if (!selectedManualList) return false;
    const { restaurants, ...fields } = updates;
    return persist({ kind: 'patch', listId: selectedManualList.id, fields,
      ...(restaurants ? restaurantDelta(selectedManualList.restaurants, restaurants) : {}) });
  }, [persist, selectedManualList]);

  const deleteManualList = useCallback((listId: string) => {
    if (!persist({ kind: 'delete', listId })) return false;
    // An empty collection is valid; avoid competing fallback creations in different tabs.
    setSelectedManualListId('');
    return true;
  }, [persist]);

  const selectDeterministicManualList = useCallback((mealTime: ManualListMealTime) => {
    const list = pickDeterministicList(manualLists, mealTime);
    if (list) selectManualList(list.id);
    return list;
  }, [manualLists, selectManualList]);

  const importManualList = useCallback((input: { name: string; mealTime: ManualListMealTime; restaurants: Restaurant[] }) => {
    const existing = readState();
    let name = input.name;
    let suffix = 2;
    while (existing.some(list => list.name.toLowerCase() === name.toLowerCase())) name = `${input.name.slice(0, 70)} (${suffix++})`;
    return createNewManualList({ ...input, name: name.slice(0, 80),
      restaurants: input.restaurants.map(item => ({ ...structuredClone(item), id: crypto.randomUUID() })) });
  }, [createNewManualList]);

  const duplicateSelectedList = useCallback(() => {
    if (!selectedManualList) return;
    return importManualList({ ...selectedManualList, name: `${selectedManualList.name.slice(0, 70)} copy` });
  }, [importManualList, selectedManualList]);

  const exportBackup = useCallback(() => {
    const text = JSON.stringify({ version: 1, lists: readState().map(backupListData) }, null, 2);
    // Never download a backup that this version would refuse to restore.
    parseListBackup(text, isManualList);
    return text;
  }, []);
  const previewBackup = useCallback((text: string) => parseListBackup(text, isManualList), []);
  const importBackup = useCallback((text: string) => {
    const lists = parseListBackup(text, isManualList).map(backupListData);
    const existingNames = new Set(readState().map(list => list.name.toLowerCase()));
    const copies = lists.map(list => {
      let name = list.name;
      let suffix = 2;
      while (existingNames.has(name.toLowerCase())) name = `${list.name.slice(0, 70)} (${suffix++})`;
      existingNames.add(name.toLowerCase());
      return createManualList({ name, mealTime: list.mealTime,
        restaurants: list.restaurants.map(item => ({ ...structuredClone(item), id: crypto.randomUUID() })) });
    });
    // One atomic journal write: a full restore succeeds or no imported list is added.
    if (!persist({ kind: 'createMany', listId: '', values: copies })) throw new Error('Could not restore lists. Retry after freeing storage.');
    if (copies[0]) selectManualList(copies[0].id);
    return copies.length;
  }, [persist, selectManualList]);

  const restoreDeletedList = useCallback((list: ManualList) => {
    // Restore as an independent copy so a stale edit cannot resurrect the deleted ID.
    return importManualList(list);
  }, [importManualList]);

  const restorePlaces = useCallback((listId: string, items: Restaurant[]) => {
    const list = readState().find(value => value.id === listId);
    if (!list) { toast.error('That list no longer exists.'); return; }
    const names = new Set(list.restaurants.map(item => item.name.toLowerCase()));
    persist({ kind: 'patch', listId, added: items.filter(item => !names.has(item.name.toLowerCase())) });
  }, [persist]);

  return {
    importManualList, manualLists, selectedManualList,
    selectedManualListId: selectedManualList?.id ?? '', selectManualList, createNewManualList,
    updateSelectedManualList, deleteManualList, selectDeterministicManualList,
    saveError, retrySave, duplicateSelectedList, exportBackup, previewBackup, importBackup,
    restoreDeletedList, restorePlaces,
  };
}
