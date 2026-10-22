import { describe, expect, it } from 'vitest';

import { awardLetsGo, defaultGameState } from '@/lib/gameStore';
import { buildLetsGoReward } from '@/lib/letsGoReward';

const DAY = '2026-10-22';

describe('buildLetsGoReward', () => {
  it('describes an award with the rarity multiplier and streak', () => {
    const award = awardLetsGo(defaultGameState(), 'place-a', DAY, 3);
    const reward = buildLetsGoReward(award, 'epic', 4);

    expect(reward).toEqual({
      awarded: true,
      xp: 150,
      coins: 10,
      multiplier: 3,
      rarity: 'epic',
      streak: 4,
      leveledUp: false,
      level: 1,
    });
  });

  it('reports the new level when the award crosses a threshold', () => {
    const award = awardLetsGo({ ...defaultGameState(), xp: 450 }, 'place-a', DAY, 2);
    const reward = buildLetsGoReward(award, 'rare', 0);

    expect(reward.leveledUp).toBe(true);
    expect(reward.level).toBe(2);
  });

  it('shows nothing earned for a place already rewarded today, and never a level up', () => {
    const first = awardLetsGo({ ...defaultGameState(), xp: 480 }, 'place-a', DAY, 1);
    const again = awardLetsGo(first.state, 'place-a', DAY, 3);
    const reward = buildLetsGoReward(again, 'epic', 2);

    expect(reward.awarded).toBe(false);
    expect(reward.xp).toBe(0);
    expect(reward.coins).toBe(0);
    expect(reward.leveledUp).toBe(false);
    expect(reward.level).toBe(2);
    expect(reward.streak).toBe(2);
  });

  it('keeps the streak a sane whole number', () => {
    const award = awardLetsGo(defaultGameState(), 'place-a', DAY, 1);
    expect(buildLetsGoReward(award, 'common', 2.9).streak).toBe(2);
    expect(buildLetsGoReward(award, 'common', -3).streak).toBe(0);
    expect(buildLetsGoReward(award, 'common', Number.NaN).streak).toBe(0);
  });
});
