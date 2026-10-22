import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { QuestCard } from '@/components/QuestCard';

const render = (props: Parameters<typeof QuestCard>[0]) => renderToStaticMarkup(createElement(QuestCard, props));

describe('QuestCard', () => {
  it('shows the title and the XP reward as text', () => {
    const html = render({ title: 'Save a new favourite', rewardXp: 30, progress: 0, target: 1, completed: false });
    expect(html).toContain('Daily quest');
    expect(html).toContain('Save a new favourite');
    expect(html).toContain('+30 XP');
    expect(html).toContain('data-completed="false"');
    expect(html).not.toContain('Completed');
  });

  it('shows a progress bar and count for multi-step quests', () => {
    const html = render({ title: 'Spin 3 times today', rewardXp: 20, progress: 2, target: 3, completed: false });
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="2"');
    expect(html).toContain('aria-valuemax="3"');
    expect(html).toContain('2 / 3');
  });

  it('has no progress bar for single-step quests', () => {
    const html = render({ title: 'Save a new favourite', rewardXp: 30, progress: 0, target: 1, completed: false });
    expect(html).not.toContain('role="progressbar"');
  });

  it('says Completed in text once done, not only by colour', () => {
    const html = render({ title: 'Spin 3 times today', rewardXp: 20, progress: 3, target: 3, completed: true });
    expect(html).toContain('Completed');
    expect(html).toContain('data-completed="true"');
    expect(html).not.toContain('role="progressbar"');
  });
});
