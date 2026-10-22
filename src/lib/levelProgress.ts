/** Numbers for the level card on the Me screen. Pure helpers, no DOM. */

export interface LevelProgress {
  /** Whole percent of the current level, 0 to 100. */
  percent: number;
  /** XP still needed to reach the next level. */
  xpToNext: number;
}

export const getLevelProgress = (xpIntoLevel: number, xpPerLevel: number): LevelProgress => {
  if (!(xpPerLevel > 0)) return { percent: 0, xpToNext: 0 };

  const into = Math.min(Math.max(0, xpIntoLevel), xpPerLevel);
  return {
    percent: Math.min(100, Math.round((into / xpPerLevel) * 100)),
    xpToNext: xpPerLevel - into,
  };
};
