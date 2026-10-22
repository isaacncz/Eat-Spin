import { getLevel, type AwardResult } from '@/lib/gameStore';
import type { Rarity } from '@/lib/rarity';

/** What the result card shows after "Let's go! Claim reward" is tapped. */
export interface LetsGoReward {
  /** False when this place was already rewarded today (nothing was added). */
  awarded: boolean;
  xp: number;
  coins: number;
  /** XP multiplier that was applied (the place's rarity multiplier). */
  multiplier: number;
  rarity: Rarity;
  /** Current day streak, shown as a tile. */
  streak: number;
  leveledUp: boolean;
  /** Level after this award. */
  level: number;
}

export const buildLetsGoReward = (award: AwardResult, rarity: Rarity, streak: number): LetsGoReward => ({
  awarded: award.awarded,
  xp: award.xp,
  coins: award.coins,
  multiplier: award.multiplier,
  rarity,
  streak: Number.isFinite(streak) ? Math.max(0, Math.floor(streak)) : 0,
  leveledUp: award.awarded && award.leveledUp,
  level: getLevel(award.state.xp),
});
