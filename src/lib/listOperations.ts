import type { ManualList, Restaurant } from '../types';

/** Each operation has its own storage key. Concurrent tabs never replace a collection. */
export interface ListOperation {
  id: string;
  clock: number;
  listId: string;
  kind: 'create' | 'createMany' | 'delete' | 'patch';
  values?: ManualList[];
  value?: ManualList;
  fields?: Partial<Pick<ManualList, 'name' | 'mealTime'>>;
  added?: Restaurant[];
  removed?: string[];
  order?: string[];
}

export function applyListOperations(base: ManualList[], operations: ListOperation[]): ManualList[] {
  const lists = new Map(base.map(list => [list.id, { ...list, restaurants: [...list.restaurants] }]));
  for (const op of [...operations].sort((a, b) => a.clock - b.clock || a.id.localeCompare(b.id))) {
    if (op.kind === 'createMany') {
      for (const value of op.values ?? []) if (!lists.has(value.id)) lists.set(value.id, { ...value, restaurants: [...value.restaurants] });
      continue;
    }
    if (op.kind === 'delete') { lists.delete(op.listId); continue; }
    if (op.kind === 'create') {
      if (op.value && !lists.has(op.listId)) lists.set(op.listId, { ...op.value, restaurants: [...op.value.restaurants] });
      continue;
    }
    const list = lists.get(op.listId);
    // An edit to a deleted list never resurrects it.
    if (!list) continue;
    const removed = new Set(op.removed ?? []);
    const items = new Map(list.restaurants.filter(item => !removed.has(item.id)).map(item => [item.id, item]));
    for (const item of op.added ?? []) if (!items.has(item.id)) items.set(item.id, item);
    const rank = new Map((op.order ?? []).map((id, index) => [id, index]));
    lists.set(op.listId, { ...list, ...op.fields, updatedAt: op.clock,
      restaurants: [...items.values()].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity)) });
  }
  return [...lists.values()].sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
}

export function restaurantDelta(before: Restaurant[], after: Restaurant[]) {
  const oldIds = new Set(before.map(item => item.id));
  const newIds = new Set(after.map(item => item.id));
  return { added: after.filter(item => !oldIds.has(item.id)), removed: before.filter(item => !newIds.has(item.id)).map(item => item.id), order: after.map(item => item.id) };
}

export interface RoomItem { name: string; order: number; createdAt: number; createdBy?: string }
export type RoomItems = Record<string, RoomItem | string>;
export function roomListDelta(raw: RoomItems | null, before: string[], after: string[], uid: string, operationId: string, now: number): RoomItems {
  const next = { ...(raw ?? {}) };
  const keyOf = (name: string) => name.trim().toLowerCase();
  const oldNames = new Set(before.map(keyOf));
  const newNames = new Set(after.map(keyOf));
  const nameOf = (item: RoomItem | string) => typeof item === 'string' ? item : item.name;
  for (const [id, item] of Object.entries(next)) {
    if (oldNames.has(keyOf(nameOf(item))) && !newNames.has(keyOf(nameOf(item)))) delete next[id];
  }
  const existing = new Set(Object.values(next).map(item => keyOf(nameOf(item))));
  after.forEach((name, index) => {
    if (!oldNames.has(keyOf(name)) && !existing.has(keyOf(name))) {
      next[`${operationId}-${index}`] = { name, order: now + index, createdAt: now, createdBy: uid };
      existing.add(keyOf(name));
    }
  });
  if (Object.keys(next).length > 60) throw new Error('A room can contain at most 60 places.');
  // Reorder only items present in this editor's baseline, retaining remote additions.
  if (before.length === after.length && before.some((name, i) => keyOf(name) !== keyOf(after[i] ?? ''))) {
    for (const [id, item] of Object.entries(next)) {
      const index = after.findIndex(name => keyOf(name) === keyOf(nameOf(item)));
      if (index >= 0 && typeof item !== 'string') next[id] = { ...item, order: index };
    }
  }
  return next;
}

export function parseListBackup(text: string, validList: (value: unknown) => value is ManualList): ManualList[] {
  if (new TextEncoder().encode(text).length > 2_000_000) throw new Error('Backup exceeds the 2 MB limit.');
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== 'object') throw new Error('Invalid list backup.');
  const value = data as Record<string, unknown>;
  if (value.version !== 1 || !Array.isArray(value.lists) || value.lists.length > 100 || !value.lists.every(validList)) {
    throw new Error('Unsupported or invalid list backup.');
  }
  const lists = value.lists as ManualList[];
  if (new Set(lists.map(list => list.id)).size !== lists.length) throw new Error('Backup contains duplicate list IDs.');
  const time = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;
  for (const list of lists) {
    if (!list.id || !list.name.trim()) throw new Error('Backup contains an unnamed list.');
    for (const item of list.restaurants) {
      if (!item.id || !item.name.trim() || !['$', '$$', '$$$', '$$$$'].includes(item.priceRange)
        || !item.hours || !Object.values(item.hours).every(day => day && typeof day === 'object'
          && Array.isArray(day.windows) && day.windows.every(window => window && time.test(window.open) && time.test(window.close))
          && (day.closed === undefined || typeof day.closed === 'boolean'))) throw new Error('Backup contains invalid place data.');
    }
  }
  return lists;
}

/** Personal-list backups contain list data only, not optional live API metadata. */
export function backupListData(list: ManualList): ManualList {
  return { id: list.id, name: list.name, mealTime: list.mealTime, createdAt: list.createdAt, updatedAt: list.updatedAt,
    restaurants: list.restaurants.map(item => ({ id: item.id, name: item.name, category: [...item.category],
      address: item.address, coordinates: { ...item.coordinates }, hours: structuredClone(item.hours),
      rating: item.rating, priceRange: item.priceRange, description: item.description })) };
}
