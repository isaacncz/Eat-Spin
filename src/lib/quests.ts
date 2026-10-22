/**
 * Daily quest: one small goal per local day with a flat XP reward.
 *
 * Everything here is pure. The quest for a day is derived from the date alone, so it
 * is the same on every device and after every reload. Progress is persisted by the
 * game store (see `GameState.quest`); this module only decides what the quest is and
 * how an event moves it forward.
 */

import type { Rarity } from '@/lib/rarity';

export type QuestId = 'rare-or-epic' | 'never-visited' | 'save-favourite' | 'spin-3';

/** Things the app reports to the quest system. */
export type QuestEvent =
  /** "Let's go!" was tapped. `rarity` and `neverVisited` describe the place BEFORE the visit was recorded. */
  | { type: 'lets-go'; rarity: Rarity; neverVisited: boolean }
  /** A place that was not already a favourite was saved. */
  | { type: 'favourite-saved' }
  /** A wheel spin finished. */
  | { type: 'spin' };

export interface QuestDef {
  id: QuestId;
  title: string;
  /** Flat XP, not affected by place rarity. */
  rewardXp: number;
  /** Progress needed to complete. */
  target: number;
  /** How much progress this event adds (0 when it is not relevant). */
  progressFor: (event: QuestEvent) => number;
}

export const QUESTS: readonly QuestDef[] = [
  {
    id: 'rare-or-epic',
    title: 'Go to a Rare or Epic place',
    rewardXp: 50,
    target: 1,
    progressFor: (event) => (event.type === 'lets-go' && event.rarity !== 'common' ? 1 : 0),
  },
  {
    id: 'never-visited',
    title: 'Try a place you have never visited',
    rewardXp: 75,
    target: 1,
    progressFor: (event) => (event.type === 'lets-go' && event.neverVisited ? 1 : 0),
  },
  {
    id: 'save-favourite',
    title: 'Save a new favourite',
    rewardXp: 30,
    target: 1,
    progressFor: (event) => (event.type === 'favourite-saved' ? 1 : 0),
  },
  {
    id: 'spin-3',
    title: 'Spin 3 times today',
    rewardXp: 20,
    target: 3,
    progressFor: (event) => (event.type === 'spin' ? 1 : 0),
  },
];

/** Saved with the game state. */
export interface QuestProgress {
  /** Local day key (YYYY-MM-DD) this progress belongs to. */
  day: string;
  questId: QuestId;
  progress: number;
  /** True once the reward has been granted. It is granted once per day. */
  completed: boolean;
}

export const getQuestById = (id: string): QuestDef | undefined => QUESTS.find((quest) => quest.id === id);

const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days since 1970-01-01 for a YYYY-MM-DD key, or null if it is not a real date. */
const dayNumber = (dayKey: string): number | null => {
  const match = DAY_KEY_PATTERN.exec(dayKey);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const utc = new Date(Date.UTC(year, month - 1, day));
  // Reject impossible dates such as 2026-02-31, which Date.UTC would roll over.
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return null;
  return Math.floor(utc.getTime() / DAY_MS);
};

/**
 * The quest for a local day key. Rotates through the table one quest per day, so the
 * same date always gives the same quest and no quest repeats within a cycle.
 * An invalid key falls back to the first quest rather than throwing.
 */
export const getQuestForDay = (dayKey: string): QuestDef => {
  const day = dayNumber(dayKey);
  if (day === null) return QUESTS[0];
  return QUESTS[((day % QUESTS.length) + QUESTS.length) % QUESTS.length];
};

/** Progress for `today`: the stored progress if it is still valid for today, otherwise a fresh quest. */
export const resolveQuestProgress = (stored: QuestProgress | undefined, today: string): QuestProgress => {
  // Trust a stored quest for today even if the table changed under it, so a completed
  // quest cannot be earned a second time on the day an update ships.
  if (stored && stored.day === today && getQuestById(stored.questId)) return stored;
  return { day: today, questId: getQuestForDay(today).id, progress: 0, completed: false };
};

export interface QuestStep {
  progress: QuestProgress;
  /** True when this event changed the progress (so it is worth saving). */
  changed: boolean;
  /** The quest, only when this event completed it. The reward is granted by the caller. */
  completedQuest: QuestDef | null;
}

/** Apply one event to the quest for `today`. Pure. Completed quests ignore further events. */
export const stepQuest = (stored: QuestProgress | undefined, event: QuestEvent, today: string): QuestStep => {
  const current = resolveQuestProgress(stored, today);
  const quest = getQuestById(current.questId);
  if (!quest || current.completed) return { progress: current, changed: false, completedQuest: null };

  const gained = quest.progressFor(event);
  if (gained <= 0) return { progress: current, changed: false, completedQuest: null };

  const progress = Math.min(quest.target, current.progress + gained);
  const completed = progress >= quest.target;
  return {
    progress: { ...current, progress, completed },
    changed: true,
    completedQuest: completed ? quest : null,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Read quest progress from untrusted JSON. Returns undefined for anything unusable. */
export const sanitizeQuestProgress = (value: unknown): QuestProgress | undefined => {
  if (!isRecord(value)) return undefined;
  if (typeof value.day !== 'string' || dayNumber(value.day) === null) return undefined;
  if (typeof value.questId !== 'string') return undefined;
  const quest = getQuestById(value.questId);
  if (!quest) return undefined;

  const completed = value.completed === true;
  const rawProgress = typeof value.progress === 'number' && Number.isFinite(value.progress) ? value.progress : 0;
  const progress = completed ? quest.target : Math.min(quest.target, Math.max(0, Math.floor(rawProgress)));
  return { day: value.day, questId: quest.id, progress, completed };
};
