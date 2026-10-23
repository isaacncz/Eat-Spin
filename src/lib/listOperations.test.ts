import { describe, expect, it } from 'vitest';
import { applyListOperations, restaurantDelta, roomListDelta, parseListBackup, type ListOperation } from './listOperations';
import type { ManualList, Restaurant } from '@/types';
const item = (id: string): Restaurant => ({ id, name: id, category: ['street food'], address: 'Custom', coordinates: { lat: 0, lng: 0 }, hours: {}, rating: 0, priceRange: '$$' });
const list: ManualList = { id: 'list', name: 'Lunch', mealTime: null, restaurants: [item('A'), item('B')], createdAt: 1, updatedAt: 1 };
const op = (id: string, clock: number, patch: Partial<ListOperation>): ListOperation => ({ id, clock, listId: 'list', kind: 'patch', ...patch });
const names = (value: ReturnType<typeof roomListDelta>) => Object.values(value).map(item => typeof item === 'string' ? item : item.name).sort();

describe('conflict-safe personal list operations', () => {
  it('merges concurrent additions from stale views with deterministic replay', () => {
    const operations = [op('tab-a', 2, restaurantDelta(list.restaurants, [...list.restaurants, item('C')])), op('tab-b', 2, restaurantDelta(list.restaurants, [...list.restaurants, item('D')]))];
    expect(applyListOperations([list], operations)[0].restaurants.map(item => item.name).sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(applyListOperations([list], [...operations].reverse())).toEqual(applyListOperations([list], operations));
  });
  it('merges different fields and item edits without losing remote additions', () => {
    const result = applyListOperations([list], [op('rename', 2, { fields: { name: 'Dinner' } }), op('remove', 3, { removed: ['A'] }), op('add', 4, { added: [item('C')] })]);
    expect(result[0].name).toBe('Dinner');
    expect(result[0].restaurants.map(item => item.name)).toEqual(['B', 'C']);
  });
  it('restores multiple independent lists in one journal operation', () => {
    const copies = [{ ...list, id: 'copy-a' }, { ...list, id: 'copy-b' }];
    const result = applyListOperations([list], [op('restore', 2, { kind: 'createMany', values: copies })]);
    expect(result.map(list => list.id).sort()).toEqual(['copy-a', 'copy-b', 'list']);
  });
  it('does not resurrect deleted lists on stale edits', () => {
    expect(applyListOperations([list], [op('delete', 2, { kind: 'delete' }), op('late', 3, { added: [item('C')] })])).toEqual([]);
  });
  it('undo restores only removed items, preserving remote edits', () => {
    const result = applyListOperations([list], [op('clear', 2, { removed: ['A', 'B'] }), op('remote', 3, { added: [item('C')] }), op('undo', 4, { added: [item('A'), item('B')] })]);
    expect(result[0].restaurants.map(item => item.name).sort()).toEqual(['A', 'B', 'C']);
  });
});

describe('room list transactions', () => {
  const base = { a: { name: 'A', order: 0, createdAt: 1, createdBy: 'host' }, b: { name: 'B', order: 1, createdAt: 1, createdBy: 'host' } };
  it('retains host and cohost additions regardless of commit order', () => {
    const first = roomListDelta(base, ['A', 'B'], ['A', 'B', 'C'], 'host', 'op1', 2);
    const second = roomListDelta(first, ['A', 'B'], ['A', 'B', 'D'], 'cohost', 'op2', 2);
    expect(names(second)).toEqual(['A', 'B', 'C', 'D']);
  });
  it('a clear from a stale client does not remove a concurrent addition', () => {
    const first = roomListDelta(base, ['A', 'B'], ['A', 'B', 'C'], 'host', 'op1', 2);
    expect(names(roomListDelta(first, ['A', 'B'], [], 'cohost', 'op2', 2))).toEqual(['C']);
  });
  it('retrying the same operation cannot add duplicate items', () => {
    const first = roomListDelta(base, ['A', 'B'], ['A', 'B', 'C'], 'host', 'op1', 2);
    expect(roomListDelta(first, ['A', 'B'], ['A', 'B', 'C'], 'host', 'op1', 2)).toEqual(first);
  });
  it('preserves stable existing IDs and enforces the room size cap', () => {
    expect(roomListDelta(base, ['A', 'B'], ['B'], 'host', 'remove', 2).b).toEqual(base.b);
    expect(() => roomListDelta(null, [], Array.from({ length: 61 }, (_, i) => `Place ${i}`), 'host', 'large', 2)).toThrow('60');
  });
});

it('validates backup versions and size before import', () => {
  const valid = (value: unknown): value is ManualList => !!value && typeof value === 'object' && 'restaurants' in value;
  expect(parseListBackup(JSON.stringify({ version: 1, lists: [list] }), valid)).toEqual([list]);
  expect(() => parseListBackup('{', valid)).toThrow();
  expect(() => parseListBackup(JSON.stringify({ version: 2, lists: [list] }), valid)).toThrow();
  expect(() => parseListBackup(JSON.stringify({ version: 1, lists: [null] }), valid)).toThrow();
  expect(() => parseListBackup('x'.repeat(2_000_001), valid)).toThrow('2 MB');
});
