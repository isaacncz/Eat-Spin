/**
 * Tabs of the mobile app shell (bottom tab bar). Pure data and helpers so the
 * rules can be unit-tested without a DOM.
 */
export const APP_TABS = [
  { id: 'spin', label: 'Spin' },
  { id: 'list', label: 'My list' },
  { id: 'group', label: 'Group' },
  { id: 'me', label: 'Me' },
] as const;

export type AppTab = (typeof APP_TABS)[number]['id'];

export const DEFAULT_APP_TAB: AppTab = 'spin';

export const isAppTab = (value: unknown): value is AppTab =>
  APP_TABS.some((tab) => tab.id === value);

/**
 * Spin runs on nearby places ("auto"). Every other screen works from the manual
 * list or room list ("manual"). Keeps the pre-shell mode vocabulary that spin
 * logic, the Places budget guard and analytics already use.
 */
export const getSpinMode = (tab: AppTab): 'auto' | 'manual' => (tab === 'spin' ? 'auto' : 'manual');

/**
 * Value sent as the `tab_switched` analytics param. Spin and My list keep the
 * values they had before the shell ('auto' and 'manual') so existing GA4 reports
 * stay continuous; Group and Me are new.
 */
export const getTabAnalyticsName = (tab: AppTab): string => {
  if (tab === 'spin') return 'auto';
  if (tab === 'list') return 'manual';
  return tab;
};

/** Tab to show on first load. A shared room link (`?room=CODE`) opens Group so the join form is in view. */
export const getInitialAppTab = (search: string): AppTab =>
  new URLSearchParams(search).get('room') ? 'group' : DEFAULT_APP_TAB;
