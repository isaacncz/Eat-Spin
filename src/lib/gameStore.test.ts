import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  COINS_LETS_GO,
  GAME_STORAGE_KEY,
  XP_LETS_GO,
  applyQuestEvent,
  awardLetsGo,
  defaultGameState,
  getLevel,
  getXpIntoLevel,
  loadGameState,
  saveGameState,
  toLocalDayKey,
  type GameState,
} from '@/lib/gameStore';
import { QUESTS, getQuestForDay, type QuestEvent, type QuestId } from '@/lib/quests';
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

describe('awardLetsGo XP multiplier', () => {
  const DAY_1 = '2026-10-22';
  const DAY_2 = '2026-10-23';

  it('defaults to 1x, so existing callers are unchanged', () => {
    const result = awardLetsGo(defaultGameState(), 'place-a', DAY_1);
    expect(result.multiplier).toBe(1);
    expect(result.xp).toBe(XP_LETS_GO);
  });

  it.each([
    [1, 50],
    [2, 100],
    [3, 150],
  ])('%ix multiplier awards %i XP', (multiplier, xp) => {
    const result = awardLetsGo(defaultGameState(), 'place-a', DAY_1, multiplier);

    expect(result.awarded).toBe(true);
    expect(result.multiplier).toBe(multiplier);
    expect(result.xp).toBe(xp);
    expect(result.state.xp).toBe(xp);
  });

  it('does not multiply coins', () => {
    const result = awardLetsGo(defaultGameState(), 'place-a', DAY_1, 3);
    expect(result.coins).toBe(COINS_LETS_GO);
    expect(result.state.coins).toBe(COINS_LETS_GO);
  });

  it('stays a no-op on the same day even if a higher multiplier is passed the second time', () => {
    const first = awardLetsGo(defaultGameState(), 'place-a', DAY_1, 1);
    const second = awardLetsGo(first.state, 'place-a', DAY_1, 3);

    expect(second.awarded).toBe(false);
    expect(second.xp).toBe(0);
    expect(second.coins).toBe(0);
    expect(second.state).toBe(first.state);
    expect(second.state.xp).toBe(XP_LETS_GO);
  });

  it('applies the multiplier again on a new day', () => {
    const first = awardLetsGo(defaultGameState(), 'place-a', DAY_1, 1);
    const next = awardLetsGo(first.state, 'place-a', DAY_2, 3);

    expect(next.state.xp).toBe(XP_LETS_GO + XP_LETS_GO * 3);
  });

  it('reports a level up using the multiplied XP', () => {
    // 400 + 50 = 450 stays in level 1, 400 + 150 = 550 crosses into level 2.
    const state: GameState = { ...defaultGameState(), xp: 400 };
    expect(awardLetsGo(state, 'place-a', DAY_1, 1).leveledUp).toBe(false);
    expect(awardLetsGo(state, 'place-a', DAY_1, 3).leveledUp).toBe(true);
  });

  it.each([
    ['zero', 0, 1],
    ['negative', -2, 1],
    ['NaN', Number.NaN, 1],
    ['Infinity', Number.POSITIVE_INFINITY, 1],
    ['fractional below one', 0.5, 1],
    ['fractional above one', 2.7, 2],
  ])('treats a %s multiplier as %ix', (_label, multiplier, applied) => {
    const result = awardLetsGo(defaultGameState(), 'place-a', DAY_1, multiplier);
    expect(result.multiplier).toBe(applied);
    expect(result.xp).toBe(XP_LETS_GO * applied);
  });
});

describe('daily quest', () => {
  const addDays = (dayKey: string, days: number): string => {
    const [y, m, d] = dayKey.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
  };
  const dayWithQuest = (id: QuestId, from = '2026-10-20'): string => {
    for (let i = 0; i < QUESTS.length; i += 1) {
      if (getQuestForDay(addDays(from, i)).id === id) return addDays(from, i);
    }
    throw new Error(`quest ${id} never comes up`);
  };
  const rewardOf = (id: QuestId): number => QUESTS.find((q) => q.id === id)!.rewardXp;
  const SPIN: QuestEvent = { type: 'spin' };
  const SAVED: QuestEvent = { type: 'favourite-saved' };

  it('starts with no quest progress, so data from before quests existed is valid', () => {
    const state = defaultGameState();
    expect(state.quest).toBeUndefined();
    const next = applyQuestEvent(state, SPIN, dayWithQuest('spin-3')).state;
    expect(next.quest).toMatchObject({ questId: 'spin-3', progress: 1, completed: false });
  });

  it('awards the quest XP exactly once when the quest is completed', () => {
    const today = dayWithQuest('save-favourite');

    const result = applyQuestEvent(defaultGameState(), SAVED, today);
    expect(result.completed).toBe(true);
    expect(result.quest?.id).toBe('save-favourite');
    expect(result.xp).toBe(rewardOf('save-favourite'));
    expect(result.state.xp).toBe(rewardOf('save-favourite'));
    expect(result.state.coins).toBe(0);
    expect(result.state.quest).toEqual({ day: today, questId: 'save-favourite', progress: 1, completed: true });
  });

  it('does not award again for more matching events on the same day', () => {
    const today = dayWithQuest('save-favourite');
    const first = applyQuestEvent(defaultGameState(), SAVED, today);
    const second = applyQuestEvent(first.state, SAVED, today);
    const third = applyQuestEvent(second.state, SAVED, today);

    expect(second.completed).toBe(false);
    expect(second.xp).toBe(0);
    expect(second.state).toBe(first.state);
    expect(third.state).toBe(first.state);
    expect(third.state.xp).toBe(first.state.xp);
  });

  it('does not award for events that do not match today\'s quest', () => {
    const today = dayWithQuest('save-favourite');
    const result = applyQuestEvent(defaultGameState(), SPIN, today);
    expect(result.completed).toBe(false);
    expect(result.state.xp).toBe(0);
  });

  it('tracks multi-step progress and awards only on the final step', () => {
    const today = dayWithQuest('spin-3');
    const reward = rewardOf('spin-3');

    let state = defaultGameState();
    const xpAfter: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      state = applyQuestEvent(state, SPIN, today).state;
      xpAfter.push(state.xp);
    }
    expect(xpAfter).toEqual([0, 0, reward, reward, reward]);
    expect(state.quest).toMatchObject({ progress: 3, completed: true });
  });

  it('can be earned again the next day (a fresh quest)', () => {
    const day1 = dayWithQuest('spin-3');
    let state = defaultGameState();
    for (let i = 0; i < 3; i += 1) state = applyQuestEvent(state, SPIN, day1).state;
    const xpDay1 = state.xp;
    expect(xpDay1).toBe(rewardOf('spin-3'));

    const day2 = addDays(day1, 1);
    const quest2 = getQuestForDay(day2);
    expect(quest2.id).not.toBe('spin-3');

    const matchingEvent: Record<QuestId, QuestEvent> = {
      'rare-or-epic': { type: 'lets-go', rarity: 'rare', neverVisited: false },
      'never-visited': { type: 'lets-go', rarity: 'epic', neverVisited: true },
      'save-favourite': SAVED,
      'spin-3': SPIN,
    };
    const result = applyQuestEvent(state, matchingEvent[quest2.id], day2);
    expect(result.completed).toBe(true);
    expect(result.state.xp).toBe(xpDay1 + quest2.rewardXp);
    expect(result.state.quest?.day).toBe(day2);
  });

  it('flags a level up caused by the quest reward', () => {
    const today = dayWithQuest('save-favourite');
    const state: GameState = { ...defaultGameState(), xp: 500 - rewardOf('save-favourite') };

    const result = applyQuestEvent(state, SAVED, today);
    expect(result.leveledUp).toBe(true);
    expect(result.level).toBe(2);
  });

  it('keeps quest progress when a Let\'s go award is applied', () => {
    const today = dayWithQuest('spin-3');
    const withProgress = applyQuestEvent(defaultGameState(), SPIN, today).state;

    const award = awardLetsGo(withProgress, 'place-a', today, 3);
    expect(award.state.quest).toEqual(withProgress.quest);
    expect(award.state.xp).toBe(XP_LETS_GO * 3);
  });

  it('persists quest progress through save and load', () => {
    stubWindowStorage(createMemoryStorage());
    const today = dayWithQuest('spin-3');
    const state = applyQuestEvent(defaultGameState(), SPIN, today).state;

    saveGameState(state);
    expect(loadGameState()).toEqual(state);
    expect(loadGameState().quest).toMatchObject({ day: today, questId: 'spin-3', progress: 1, completed: false });
  });

  it('does not award twice across a reload', () => {
    stubWindowStorage(createMemoryStorage());
    const today = dayWithQuest('save-favourite');

    saveGameState(applyQuestEvent(loadGameState(), SAVED, today).state);
    const afterReload = applyQuestEvent(loadGameState(), SAVED, today);

    expect(afterReload.completed).toBe(false);
    expect(afterReload.state.xp).toBe(rewardOf('save-favourite'));
  });

  it('loads data saved before daily quests existed (no quest field)', () => {
    stubWindowStorage(createMemoryStorage({
      [GAME_STORAGE_KEY]: JSON.stringify({ v: 1, xp: 275, coins: 40, awardedOn: { 'place-a': '2026-10-21' } }),
    }));

    const state = loadGameState();
    expect(state).toEqual({ v: 1, xp: 275, coins: 40, awardedOn: { 'place-a': '2026-10-21' } });
    expect(state.quest).toBeUndefined();
  });

  it('drops a corrupt quest field but keeps the XP and coins', () => {
    stubWindowStorage(createMemoryStorage({
      [GAME_STORAGE_KEY]: JSON.stringify({ v: 1, xp: 275, coins: 40, awardedOn: {}, quest: { day: 'someday', questId: 'spin-3' } }),
    }));

    const state = loadGameState();
    expect(state.xp).toBe(275);
    expect(state.coins).toBe(40);
    expect(state.quest).toBeUndefined();
  });

  it('keeps the stored schema version at 1', () => {
    const storage = stubWindowStorage(createMemoryStorage());
    saveGameState(applyQuestEvent(defaultGameState(), SPIN, '2026-10-22').state);
    expect(JSON.parse(storage.getItem(GAME_STORAGE_KEY) ?? '{}').v).toBe(1);
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
