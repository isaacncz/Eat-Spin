import { describe, expect, it } from 'vitest';
import { getSmartHoursLabel } from './smartHours';
import type { Restaurant } from '@/types';
const make = (hours: Restaurant['hours']) => ({ hours } as Restaurant);
describe('overnight opening labels', () => {
  const daily = make({ daily: { windows: [{ open: '22:00', close: '02:00' }] } });
  it('uses yesterday carryover after midnight', () => {
    expect(getSmartHoursLabel(daily, new Date(2026, 9, 23, 0, 30))).toEqual({ status: 'open', label: 'Open until 2am' });
    expect(getSmartHoursLabel(daily, new Date(2026, 9, 23, 1, 30))).toMatchObject({ status: 'closing-soon' });
  });
  it('is closed at the exact close boundary', () => {
    expect(getSmartHoursLabel(daily, new Date(2026, 9, 23, 2, 0)).status).toBe('closed');
  });
  it('keeps Thursday carryover even when Friday is marked closed', () => {
    const restaurant = make({ thursday: { windows: [{ open: '22:00', close: '02:00' }] }, friday: { closed: true, windows: [] } });
    expect(getSmartHoursLabel(restaurant, new Date(2026, 9, 23, 1, 0)).status).toBe('closing-soon');
    expect(getSmartHoursLabel(restaurant, new Date(2026, 9, 23, 2, 0)).status).toBe('closed');
  });
  it('handles Sunday carryover into Monday', () => {
    const restaurant = make({ sunday: { windows: [{ open: '22:00', close: '02:00' }] } });
    expect(getSmartHoursLabel(restaurant, new Date(2026, 9, 26, 0, 30)).status).toBe('open');
  });
  it('preserves all-day and regular daytime operation', () => {
    expect(getSmartHoursLabel(make({ daily: { windows: [{ open: '00:00', close: '23:59' }] } }), new Date(2026, 9, 23, 1)).label).toBe('Open 24 hours');
    expect(getSmartHoursLabel(make({ daily: { windows: [{ open: '09:00', close: '17:00' }] } }), new Date(2026, 9, 23, 12)).label).toBe('Open until 5pm');
  });
});
