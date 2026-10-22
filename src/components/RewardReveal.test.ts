import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { RewardTiles } from '@/components/RewardReveal';
import type { LetsGoReward } from '@/lib/letsGoReward';

const REWARD: LetsGoReward = {
  awarded: true,
  xp: 150,
  coins: 10,
  multiplier: 3,
  rarity: 'epic',
  streak: 4,
  leveledUp: false,
  level: 1,
};

const render = (reward: LetsGoReward, animate: boolean) =>
  renderToStaticMarkup(createElement(RewardTiles, { reward, animate }));

const countOf = (html: string, needle: string) => html.split(needle).length - 1;

describe('RewardTiles', () => {
  it('shows XP, coins and streak as text', () => {
    const html = render(REWARD, true);
    expect(countOf(html, 'data-testid="reward-tile"')).toBe(3);
    expect(html).toContain('Reward claimed!');
    expect(html).toContain('+150');
    expect(html).toContain('XP (Epic 3x)');
    expect(html).toContain('+10');
    expect(html).toContain('coins');
    expect(html).toContain('day streak');
  });

  it('does not mention a multiplier for a 1x award', () => {
    const html = render({ ...REWARD, xp: 50, multiplier: 1, rarity: 'common' }, true);
    expect(html).toContain('+50');
    expect(html).not.toContain('Common 1x');
  });

  it('animates and bursts confetti by default', () => {
    const html = render(REWARD, true);
    expect(html).toContain('data-testid="confetti-burst"');
    expect(countOf(html, 'confetti-piece')).toBe(24);
    expect(html).toContain('reward-tile-pop');
  });

  it('is static with no confetti and no animation classes when reduced motion is preferred', () => {
    const html = render(REWARD, false);
    expect(html).not.toContain('confetti');
    expect(html).not.toContain('reward-tile-pop');
    expect(html).not.toContain('--delay');
    // The reward itself is still all there.
    expect(countOf(html, 'data-testid="reward-tile"')).toBe(3);
    expect(html).toContain('+150');
  });

  it('says so, with no confetti, when the place was already rewarded today', () => {
    const html = render({ ...REWARD, awarded: false, xp: 0, coins: 0, multiplier: 1 }, true);
    expect(html).toContain('Already rewarded today');
    expect(html).toContain('+0');
    expect(html).not.toContain('confetti');
    expect(html).toContain('Come back tomorrow');
  });
});
