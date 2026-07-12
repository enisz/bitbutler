export type TimeUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years';

export const TIME_UNIT_SECONDS: Record<TimeUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400,
  weeks: 604800,
  months: 2629800, // 365.25 days / 12, matching HumanizeDurationPipe's year length
  years: 31557600, // 365.25 days
};

export const TIME_UNIT_LABEL_KEYS: Record<TimeUnit, string> = {
  seconds: 'components.column-filters.time-unit.seconds',
  minutes: 'components.column-filters.time-unit.minutes',
  hours: 'components.column-filters.time-unit.hours',
  days: 'components.column-filters.time-unit.days',
  weeks: 'components.column-filters.time-unit.weeks',
  months: 'components.column-filters.time-unit.months',
  years: 'components.column-filters.time-unit.years',
};
