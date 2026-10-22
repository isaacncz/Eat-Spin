/** Local progression: XP, level, coins. Stored in localStorage, never sent to a server. */

export const GAME_STORAGE_KEY = 'eatspin:game-v1';

export const XP_PER_LEVEL = 500;
export const XP_LETS_GO = 50;
export const COINS_LETS_GO = 10;

export interface GameState {
  v: 1;
  xp: number;
  coins: number;
  /** restaurantId -> local day key of the last award (prevents farming one place). */
  awardedOn: Record<string, string>;
}

export const defaultGameState = (): GameState => ({ v: 1, xp: 0, coins: 0, awardedOn: {} });

export const getLevel = (xp: number): number => Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;
export const getXpIntoLevel = (xp: number): number => Math.max(0, xp) % XP_PER_LEVEL;

export const toLocalDayKey = (date = new Date()): string => {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const loadGameState = (): GameState => {
  if (typeof window === 'undefined') return defaultGameState();
  try {
    const raw = window.localStorage.getItem(GAME_STORAGE_KEY);
    if (!raw) return defaultGameState();
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.v !== 1) return defaultGameState();
    const awardedOn: Record<string, string> = {};
    if (isRecord(parsed.awardedOn)) {
      for (const [id, day] of Object.entries(parsed.awardedOn)) {
        if (typeof day === 'string') awardedOn[id] = day;
      }
    }
    return {
      v: 1,
      xp: typeof parsed.xp === 'number' && parsed.xp >= 0 ? Math.floor(parsed.xp) : 0,
      coins: typeof parsed.coins === 'number' && parsed.coins >= 0 ? Math.floor(parsed.coins) : 0,
      awardedOn,
    };
  } catch {
    return defaultGameState();
  }
};

export const saveGameState = (state: GameState): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable or full: progress stays in memory for this session.
  }
};

export interface AwardResult {
  state: GameState;
  awarded: boolean;
  leveledUp: boolean;
  /** XP granted by this call (base XP times the multiplier), 0 when nothing was awarded. */
  xp: number;
  coins: number;
  /** XP multiplier that was applied (always a whole number >= 1). */
  multiplier: number;
}

/** Whole number >= 1; anything else (NaN, 0, negatives) falls back to 1x. */
const normaliseMultiplier = (multiplier: number): number =>
  Number.isFinite(multiplier) && multiplier >= 1 ? Math.floor(multiplier) : 1;

/**
 * Award "Let's go" rewards once per restaurant per local day. Pure: returns the next state.
 *
 * `multiplier` scales the XP only (coins stay flat). It is applied on the single
 * awarding call, so repeating the call on the same day is still a no-op.
 */
export const awardLetsGo = (
  state: GameState,
  restaurantId: string,
  today = toLocalDayKey(),
  multiplier = 1,
): AwardResult => {
  const appliedMultiplier = normaliseMultiplier(multiplier);
  if (state.awardedOn[restaurantId] === today) {
    return { state, awarded: false, leveledUp: false, xp: 0, coins: 0, multiplier: appliedMultiplier };
  }
  // Keep only today's entries so the map cannot grow without bound.
  const awardedOn: Record<string, string> = {};
  for (const [id, day] of Object.entries(state.awardedOn)) {
    if (day === today) awardedOn[id] = day;
  }
  awardedOn[restaurantId] = today;

  const xp = XP_LETS_GO * appliedMultiplier;
  const next: GameState = {
    v: 1,
    xp: state.xp + xp,
    coins: state.coins + COINS_LETS_GO,
    awardedOn,
  };
  return {
    state: next,
    awarded: true,
    leveledUp: getLevel(next.xp) > getLevel(state.xp),
    xp,
    coins: COINS_LETS_GO,
    multiplier: appliedMultiplier,
  };
};
