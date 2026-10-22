import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  QUESTS,
  getQuestById,
  getQuestForDay,
  resolveQuestProgress,
  sanitizeQuestProgress,
  stepQuest,
  type QuestEvent,
  type QuestId,
  type QuestProgress,
} from '@/lib/quests';

afterEach(() => {
  vi.useRealTimers();
});

const addDays = (dayKey: string, days: number): string => {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

/** First day (from a fixed start) on which the given quest is the quest of the day. */
const dayWithQuest = (id: QuestId): string => {
  for (let i = 0; i < QUESTS.length; i += 1) {
    const day = addDays('2026-10-20', i);
    if (getQuestForDay(day).id === id) return day;
  }
  throw new Error(`quest ${id} never comes up`);
};

const LETS_GO_COMMON: QuestEvent = { type: 'lets-go', rarity: 'common', neverVisited: false };
const LETS_GO_RARE: QuestEvent = { type: 'lets-go', rarity: 'rare', neverVisited: false };
const LETS_GO_EPIC_AGAIN: QuestEvent = { type: 'lets-go', rarity: 'epic', neverVisited: false };
const LETS_GO_NEW_PLACE: QuestEvent = { type: 'lets-go', rarity: 'epic', neverVisited: true };
const SAVED: QuestEvent = { type: 'favourite-saved' };
const SPIN: QuestEvent = { type: 'spin' };

describe('quest table', () => {
  it('has unique ids, positive rewards and targets', () => {
    expect(new Set(QUESTS.map((q) => q.id)).size).toBe(QUESTS.length);
    for (const quest of QUESTS) {
      expect(quest.rewardXp).toBeGreaterThan(0);
      expect(quest.target).toBeGreaterThanOrEqual(1);
      expect(quest.title.length).toBeGreaterThan(0);
    }
  });

  it('has the four launch quests with their rewards', () => {
    expect(QUESTS.map((q) => [q.id, q.rewardXp, q.target])).toEqual([
      ['rare-or-epic', 50, 1],
      ['never-visited', 75, 1],
      ['save-favourite', 30, 1],
      ['spin-3', 20, 3],
    ]);
  });

  it('looks quests up by id', () => {
    expect(getQuestById('spin-3')?.target).toBe(3);
    expect(getQuestById('nope')).toBeUndefined();
  });
});

describe('getQuestForDay', () => {
  it('returns the same quest for the same date every time', () => {
    const first = getQuestForDay('2026-10-22');
    for (let i = 0; i < 5; i += 1) expect(getQuestForDay('2026-10-22')).toBe(first);
  });

  it('depends only on the date key, not on the clock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2020, 0, 1, 3, 0, 0));
    const early = getQuestForDay('2026-10-22').id;
    vi.setSystemTime(new Date(2031, 5, 30, 23, 59, 59));
    expect(getQuestForDay('2026-10-22').id).toBe(early);
  });

  it('rotates through every quest, one per day, with no repeat inside a cycle', () => {
    const start = '2026-10-22';
    const ids = Array.from({ length: QUESTS.length }, (_, i) => getQuestForDay(addDays(start, i)).id);
    expect(new Set(ids).size).toBe(QUESTS.length);
    expect(getQuestForDay(addDays(start, QUESTS.length)).id).toBe(ids[0]);
  });

  it('never gives the same quest two days in a row, across month, year and leap-day boundaries', () => {
    for (const start of ['2026-02-27', '2026-12-30', '2027-12-30', '2028-02-27']) {
      for (let i = 0; i < 8; i += 1) {
        const today = addDays(start, i);
        expect(getQuestForDay(addDays(today, 1)).id).not.toBe(getQuestForDay(today).id);
      }
    }
  });

  it('falls back to the first quest for an invalid key instead of throwing', () => {
    for (const bad of ['', 'garbage', '2026-13-01', '2026-02-31', '22-10-2026', '2026-1-5']) {
      expect(getQuestForDay(bad)).toBe(QUESTS[0]);
    }
  });
});

describe('resolveQuestProgress', () => {
  it('starts a fresh quest when nothing is stored', () => {
    const today = '2026-10-22';
    expect(resolveQuestProgress(undefined, today)).toEqual({
      day: today,
      questId: getQuestForDay(today).id,
      progress: 0,
      completed: false,
    });
  });

  it('keeps stored progress for today', () => {
    const today = dayWithQuest('spin-3');
    const stored: QuestProgress = { day: today, questId: 'spin-3', progress: 2, completed: false };
    expect(resolveQuestProgress(stored, today)).toBe(stored);
  });

  it('discards yesterday\'s progress, even if it was completed', () => {
    const yesterday = dayWithQuest('spin-3');
    const today = addDays(yesterday, 1);
    const stored: QuestProgress = { day: yesterday, questId: 'spin-3', progress: 3, completed: true };

    const resolved = resolveQuestProgress(stored, today);
    expect(resolved.day).toBe(today);
    expect(resolved.completed).toBe(false);
    expect(resolved.progress).toBe(0);
    expect(resolved.questId).toBe(getQuestForDay(today).id);
  });

  it('keeps today\'s stored quest even if the date pick would now be different', () => {
    const today = dayWithQuest('rare-or-epic');
    const stored: QuestProgress = { day: today, questId: 'save-favourite', progress: 1, completed: true };
    expect(resolveQuestProgress(stored, today)).toBe(stored);
  });

  it('replaces a stored quest whose id is no longer in the table', () => {
    const today = '2026-10-22';
    const stored = { day: today, questId: 'removed-quest', progress: 1, completed: true } as unknown as QuestProgress;
    expect(resolveQuestProgress(stored, today).completed).toBe(false);
  });
});

describe('stepQuest', () => {
  it('completes a one-step quest on a matching event', () => {
    const today = dayWithQuest('save-favourite');
    const step = stepQuest(undefined, SAVED, today);

    expect(step.changed).toBe(true);
    expect(step.completedQuest?.id).toBe('save-favourite');
    expect(step.progress).toEqual({ day: today, questId: 'save-favourite', progress: 1, completed: true });
  });

  it('ignores events that do not match the quest', () => {
    const today = dayWithQuest('save-favourite');
    for (const event of [SPIN, LETS_GO_NEW_PLACE, LETS_GO_RARE]) {
      const step = stepQuest(undefined, event, today);
      expect(step.changed).toBe(false);
      expect(step.completedQuest).toBeNull();
      expect(step.progress.progress).toBe(0);
    }
  });

  it('does not complete again once completed (no double award)', () => {
    const today = dayWithQuest('save-favourite');
    const done = stepQuest(undefined, SAVED, today);
    const again = stepQuest(done.progress, SAVED, today);

    expect(again.changed).toBe(false);
    expect(again.completedQuest).toBeNull();
    expect(again.progress).toBe(done.progress);
  });

  it('counts spins and completes on the third', () => {
    const today = dayWithQuest('spin-3');
    const one = stepQuest(undefined, SPIN, today);
    const two = stepQuest(one.progress, SPIN, today);
    const three = stepQuest(two.progress, SPIN, today);

    expect([one.progress.progress, two.progress.progress, three.progress.progress]).toEqual([1, 2, 3]);
    expect([one.completedQuest, two.completedQuest]).toEqual([null, null]);
    expect(three.completedQuest?.id).toBe('spin-3');
    expect(three.progress.completed).toBe(true);

    const fourth = stepQuest(three.progress, SPIN, today);
    expect(fourth.changed).toBe(false);
    expect(fourth.progress.progress).toBe(3);
  });

  it('"Rare or Epic" needs a Rare or Epic place, not a common one', () => {
    const today = dayWithQuest('rare-or-epic');
    expect(stepQuest(undefined, LETS_GO_COMMON, today).changed).toBe(false);
    expect(stepQuest(undefined, LETS_GO_RARE, today).completedQuest?.id).toBe('rare-or-epic');
    expect(stepQuest(undefined, LETS_GO_EPIC_AGAIN, today).completedQuest?.id).toBe('rare-or-epic');
  });

  it('"Never visited" needs a place with no earlier visit, not just an old one', () => {
    const today = dayWithQuest('never-visited');
    expect(stepQuest(undefined, LETS_GO_EPIC_AGAIN, today).changed).toBe(false);
    expect(stepQuest(undefined, LETS_GO_NEW_PLACE, today).completedQuest?.id).toBe('never-visited');
  });

  it('starts over on a new day', () => {
    const day1 = dayWithQuest('spin-3');
    const day2 = addDays(day1, 1);
    const done = stepQuest(stepQuest(stepQuest(undefined, SPIN, day1).progress, SPIN, day1).progress, SPIN, day1);
    expect(done.progress.completed).toBe(true);

    const next = getQuestForDay(day2);
    const matching: QuestEvent =
      next.id === 'save-favourite' ? SAVED : next.id === 'never-visited' ? LETS_GO_NEW_PLACE : LETS_GO_RARE;
    const step = stepQuest(done.progress, matching, day2);
    expect(step.completedQuest?.id).toBe(next.id);
    expect(step.progress.day).toBe(day2);
  });
});

describe('sanitizeQuestProgress', () => {
  const today = '2026-10-22';

  it('accepts valid progress', () => {
    expect(sanitizeQuestProgress({ day: today, questId: 'spin-3', progress: 2, completed: false })).toEqual({
      day: today,
      questId: 'spin-3',
      progress: 2,
      completed: false,
    });
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'spin-3'],
    ['an array', []],
    ['no day', { questId: 'spin-3', progress: 1, completed: false }],
    ['a bad day', { day: 'yesterday', questId: 'spin-3', progress: 1, completed: false }],
    ['an impossible day', { day: '2026-02-31', questId: 'spin-3', progress: 1, completed: false }],
    ['an unknown quest', { day: today, questId: 'free-money', progress: 1, completed: true }],
    ['a non-string quest id', { day: today, questId: 7, progress: 1, completed: false }],
  ])('drops %s', (_label, value) => {
    expect(sanitizeQuestProgress(value)).toBeUndefined();
  });

  it('clamps and floors progress, and ignores a non-numeric one', () => {
    expect(sanitizeQuestProgress({ day: today, questId: 'spin-3', progress: 99, completed: false })?.progress).toBe(3);
    expect(sanitizeQuestProgress({ day: today, questId: 'spin-3', progress: -4, completed: false })?.progress).toBe(0);
    expect(sanitizeQuestProgress({ day: today, questId: 'spin-3', progress: 1.9, completed: false })?.progress).toBe(1);
    expect(sanitizeQuestProgress({ day: today, questId: 'spin-3', progress: 'two', completed: false })?.progress).toBe(0);
  });

  it('only trusts completed === true, and a completed quest is at full progress', () => {
    expect(sanitizeQuestProgress({ day: today, questId: 'spin-3', progress: 0, completed: 'yes' })?.completed).toBe(false);
    expect(sanitizeQuestProgress({ day: today, questId: 'spin-3', progress: 0, completed: true })).toMatchObject({
      completed: true,
      progress: 3,
    });
  });
});
