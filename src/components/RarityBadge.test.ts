import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { RarityBadge, RarityRibbon } from '@/components/RarityBadge';
import { RARITIES, RARITY_HINT, RARITY_LABEL, RARITY_XP_MULTIPLIER } from '@/lib/rarity';

describe('RarityBadge', () => {
  it.each(RARITIES)('spells out the %s tier in text', (tier) => {
    const html = renderToStaticMarkup(createElement(RarityBadge, { rarity: tier }));
    expect(html).toContain(RARITY_LABEL[tier]);
  });

  it('hides the decorative icon from assistive tech', () => {
    const html = renderToStaticMarkup(createElement(RarityBadge, { rarity: 'rare' }));
    expect(html).toContain('aria-hidden="true"');
  });
});

describe('RarityRibbon', () => {
  it.each(RARITIES)('shows the %s label, XP multiplier and hint as text', (tier) => {
    const html = renderToStaticMarkup(createElement(RarityRibbon, { rarity: tier }));
    expect(html).toContain(`data-rarity="${tier}"`);
    expect(html).toContain(`${RARITY_LABEL[tier]} place`);
    expect(html).toContain(`${RARITY_XP_MULTIPLIER[tier]}x XP`);
    expect(html).toContain(RARITY_HINT[tier]);
  });
});
