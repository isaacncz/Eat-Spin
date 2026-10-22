import { describe, expect, it } from 'vitest';

import {
  APP_TABS,
  DEFAULT_APP_TAB,
  getInitialAppTab,
  getSpinMode,
  getTabAnalyticsName,
  isAppTab,
} from '@/lib/appTabs';

describe('APP_TABS', () => {
  it('has the four tabs in bottom bar order', () => {
    expect(APP_TABS.map((tab) => tab.id)).toEqual(['spin', 'list', 'group', 'me']);
    expect(APP_TABS.map((tab) => tab.label)).toEqual(['Spin', 'My list', 'Group', 'Me']);
  });

  it('opens on Spin', () => {
    expect(DEFAULT_APP_TAB).toBe('spin');
  });
});

describe('isAppTab', () => {
  it('accepts the four tab ids', () => {
    for (const tab of APP_TABS) {
      expect(isAppTab(tab.id)).toBe(true);
    }
  });

  it('rejects anything else, including the old auto and manual modes', () => {
    expect(isAppTab('auto')).toBe(false);
    expect(isAppTab('manual')).toBe(false);
    expect(isAppTab('')).toBe(false);
    expect(isAppTab(undefined)).toBe(false);
    expect(isAppTab(3)).toBe(false);
  });
});

describe('getSpinMode', () => {
  it('maps Spin to auto and every other screen to manual', () => {
    expect(getSpinMode('spin')).toBe('auto');
    expect(getSpinMode('list')).toBe('manual');
    expect(getSpinMode('group')).toBe('manual');
    expect(getSpinMode('me')).toBe('manual');
  });
});

describe('getTabAnalyticsName', () => {
  it('keeps the pre-shell values for Spin and My list', () => {
    expect(getTabAnalyticsName('spin')).toBe('auto');
    expect(getTabAnalyticsName('list')).toBe('manual');
  });

  it('uses the tab id for the new tabs', () => {
    expect(getTabAnalyticsName('group')).toBe('group');
    expect(getTabAnalyticsName('me')).toBe('me');
  });
});

describe('getInitialAppTab', () => {
  it('opens Spin by default', () => {
    expect(getInitialAppTab('')).toBe('spin');
    expect(getInitialAppTab('?utm_source=share')).toBe('spin');
  });

  it('opens Group for a shared room link', () => {
    expect(getInitialAppTab('?room=ABC123')).toBe('group');
    expect(getInitialAppTab('?utm_source=share&room=ABC123')).toBe('group');
  });

  it('ignores an empty room param', () => {
    expect(getInitialAppTab('?room=')).toBe('spin');
  });
});
