import { TIME_UNIT_LABEL_KEYS, TIME_UNIT_SECONDS, TimeUnit } from './time-unit.utils';

describe('time-unit.utils', () => {
  it('converts every unit to seconds using the expected multiplier', () => {
    expect(TIME_UNIT_SECONDS.seconds).toBe(1);
    expect(TIME_UNIT_SECONDS.minutes).toBe(60);
    expect(TIME_UNIT_SECONDS.hours).toBe(3600);
    expect(TIME_UNIT_SECONDS.days).toBe(86400);
    expect(TIME_UNIT_SECONDS.weeks).toBe(604800);
    expect(TIME_UNIT_SECONDS.months).toBe(2629800);
    expect(TIME_UNIT_SECONDS.years).toBe(31557600);
  });

  it('has a translation key for every unit', () => {
    const units: TimeUnit[] = ['seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'];
    units.forEach((unit) => {
      expect(TIME_UNIT_LABEL_KEYS[unit]).toBe(`components.column-filters.time-unit.${unit}`);
    });
  });
});
