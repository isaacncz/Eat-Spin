import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  COINS_LETS_GO,
  GAME_STORAGE_KEY,
  XP_LETS_GO,
  awardLetsGo,
  defaultGameState,
  getLevel,
  getXpIntoLevel,
  loadGameState,
  saveGameState,
  toLocalDayKey,
  type GameState,
} from '@/lib/gameStore';
import { createBrokenStorage, createMemoryStorage, stubWindowStorage } from '@/test/memoryStorage';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('level curve', () => {
  it.each([
    [0, 1],
    [1, 1],
    [499, 1],
    [500, 2],
    [999, 2],
    [1000, 3],
    [1500, 4],
  ])('%i XP is level %i', (xp, level) => {
    expect(getLevel(xp)).toBe(level);
  });

  it('never goes below level 1 for negative XP', () => {
    expect(getLevel(-250)).toBe(1);
    expect(getXpIntoLevel(-250)).toBe(0);
  });

  it.each([
    [0, 0],
    [499, 499],
    [500, 0],
    [750, 250],
    [1000, 0],
  ])('%i XP is %i XP into the level', (xp, into) => {
    expect(getXpIntoLevel(xp)).toBe(into);
  });
});

describe('toLocalDayKey', () => {
  it('formats the local calendar day as YYYY-MM-DD with zero padding', () => {
    expect(toLocalDayKey(new Date(2026, 0, 5, 9, 30))).toBe('2026-01-05');
    expect(toLocalDayKey(new Date(2026, 11, 31, 23, 59, 59))).toBe('2026-12-31');
  });

  it('rolls over at local midnight', () => {
    expect(toLocalDayKey(new Date(2026, 9, 22, 23, 59, 59))).toBe('2026-10-22');
    expect(toLocalDayKey(new Date(2026, 9, 23, 0, 0, 0))).toBe('2026-10-23');
  });
});

describe('awardLetsGo', () => {
  const DAY_1 = '2026-10-22';
  const DAY_2 = '2026-10-23';

  it('awards XP and coins the first time a restaurant is chosen on a day', () => {
    const result = awardLetsGo(defaultGameState(), 'place-a', DAY_1);

    expect(result.awarded).toBe(true);
    expect(result.xp).toBe(XP_LETS_GO);
    expect(result.coins).toBe(COINS_LETS_GO);
    expect(result.state.xp).toBe(XP_LETS_GO);
    expect(result.state.coins).toBe(COINS_LETS_GO);
    expect(result.state.awardedOn).toEqual({ 'place-a': DAY_1 });
    expect(result.leveledUp).toBe(false);
  });

  it('does not mutate the state it was given', () => {
    const before = defaultGameState();
    awardLetsGo(before, 'place-a', DAY_1);
    expect(before).toEqual(defaultGameState());
  });

  it('is a no-op for the same restaurant on the same day', () => {
    const first = awardLetsGo(defaultGameState(), 'place-a', DAY_1);
    const second = awardLetsGo(first.state, 'place-a', DAY_1);

    expect(second.awarded).toBe(false);
    expect(second.xp).toBe(0);
    expect(second.coins).toBe(0);
    expect(second.leveledUp).toBe(false);
    expect(second.state).toBe(first.state);
    expect(second.state.xp).toBe(XP_LETS_GO);
    expect(second.state.coins).toBe(COINS_LETS_GO);
  });

  it('awards a different restaurant on the same day', () => {
    const first = awardLetsGo(defaultGameState(), 'place-a', DAY_1);
    const second = awardLetsGo(first.state, 'place-b', DAY_1);

    expect(second.awarded).toBe(true);
    expect(second.state.xp).toBe(XP_LETS_GO * 2);
    expect(second.state.coins).toBe(COINS_LETS_GO * 2);
    expect(second.state.awardedOn).toEqual({ 'place-a': DAY_1, 'place-b': DAY_1 });
  });

  it('awards the same restaurant again on a new day', () => {
    const first = awardLetsGo(defaultGameState(), 'place-a', DAY_1);
    const nextDay = awardLetsGo(first.state, 'place-a', DAY_2);

    expect(nextDay.awarded).toBe(true);
    expect(nextDay.state.xp).toBe(XP_LETS_GO * 2);
    expect(nextDay.state.awardedOn).toEqual({ 'place-a': DAY_2 });
  });

  it('drops stale days from awardedOn so the map cannot grow without bound', () => {
    let state = defaultGameState();
    state = awardLetsGo(state, 'place-a', DAY_1).state;
    state = awardLetsGo(state, 'place-b', DAY_1).state;
    state = awardLetsGo(state, 'place-c', DAY_2).state;

    expect(state.awardedOn).toEqual({ 'place-c': DAY_2 });
  });

  it('reports a level up when the award crosses an XP boundary', () => {
    const nearLevelUp: GameState = { ...defaultGameState(), xp: 475 };
    const result = awardLetsGo(nearLevelUp, 'place-a', DAY_1);

    expect(result.state.xp).toBe(525);
    expect(result.leveledUp).toBe(true);
  });

  it('does not report a level up inside a level', () => {
    const result = awardLetsGo({ ...defaultGameState(), xp: 400 }, 'place-a', DAY_1);
    expect(result.leveledUp).toBe(false);
  });

  it('uses the local day when no day is passed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 22, 12, 0, 0));

    const first = awardLetsGo(defaultGameState(), 'place-a');
    expect(first.awarded).toBe(true);
    expect(first.state.awardedOn).toEqual({ 'place-a': '2026-10-22' });

    vi.setSystemTime(new Date(2026, 9, 22, 23, 59, 0));
    expect(awardLetsGo(first.state, 'place-a').awarded).toBe(false);

    vi.setSystemTime(new Date(2026, 9, 23, 0, 1, 0));
    expect(awardLetsGo(first.state, 'place-a').awarded).toBe(true);
  });
});

describe('loadGameState / saveGameState', () => {
  beforeEach(() => {
    stubWindowStorage(createMemoryStorage());
  });

  it('returns defaults when nothing is stored', () => {
    expect(loadGameState()).toEqual(defaultGameState());
  });

  it('round-trips a saved state', () => {
    const state: GameState = { v: 1, xp: 725, coins: 140, awardedOn: { 'place-a': '2026-10-22' } };
    saveGameState(state);
    expect(loadGameState()).toEqual(state);
  });

  it('persists awards made through awardLetsGo', () => {
    const { state } = awardLetsGo(loadGameState(), 'place-a', '2026-10-22');
    saveGameState(state);

    const reloaded = loadGameState();
    expect(reloaded.xp).toBe(XP_LETS_GO);
    expect(awardLetsGo(reloaded, 'place-a', '2026-10-22').awarded).toBe(false);
  });

  it('returns a fresh default object each time', () => {
    const a = defaultGameState();
    a.awardedOn['x'] = '2026-01-01';
    expect(defaultGameState().awardedOn).toEqual({});
  });

  it.each([
    ['corrupt JSON', '{not json'],
    ['truncated JSON', '{"v":1,"xp":'],
    ['empty string', ''],
    ['a bare string', '"hello"'],
    ['a number', '42'],
    ['null', 'null'],
    ['an array', '[1,2,3]'],
    ['an object with no version', '{"xp":9999,"coins":9999}'],
    ['a future version', '{"v":2,"xp":9999,"coins":9999,"awardedOn":{}}'],
    ['a string version', '{"v":"1","xp":9999}'],
    ['another app\'s data', '{"theme":"dark","user":{"id":7}}'],
  ])('falls back to defaults for %s', (_label, raw) => {
    window.localStorage.setItem(GAME_STORAGE_KEY, raw);
    expect(loadGameState()).toEqual(defaultGameState());
  });

  it('sanitises individual bad fields instead of trusting them', () => {
    window.localStorage.setItem(
      GAME_STORAGE_KEY,
      JSON.stringify({
        v: 1,
        xp: 'lots',
        coins: -5,
        awardedOn: { 'place-a': '2026-10-22', 'place-b': 20261022, 'place-c': null },
      }),
    );

    expect(loadGameState()).toEqual({ v: 1, xp: 0, coins: 0, awardedOn: { 'place-a': '2026-10-22' } });
  });

  it('floors fractional XP and coins', () => {
    window.localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify({ v: 1, xp: 12.9, coins: 3.2, awardedOn: {} }));
    expect(loadGameState()).toMatchObject({ xp: 12, coins: 3 });
  });

  it('ignores an awardedOn that is not an object', () => {
    window.localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify({ v: 1, xp: 50, coins: 10, awardedOn: ['place-a'] }));
    expect(loadGameState()).toEqual({ v: 1, xp: 50, coins: 10, awardedOn: {} });
  });

  it('falls back to defaults when localStorage throws on read', () => {
    stubWindowStorage(createBrokenStorage({ read: true }));
    expect(loadGameState()).toEqual(defaultGameState());
  });

  it('does not throw when localStorage throws on write', () => {
    stubWindowStorage(createBrokenStorage({ write: true }));
    expect(() => saveGameState({ ...defaultGameState(), xp: 50 })).not.toThrow();
  });
});

describe('without a window (SSR / node)', () => {
  it('loads defaults and ignores saves', () => {
    expect(typeof window).toBe('undefined');
    expect(loadGameState()).toEqual(defaultGameState());
    expect(() => saveGameState(defaultGameState())).not.toThrow();
  });
});
