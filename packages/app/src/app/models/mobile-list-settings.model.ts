export type PhoneSortKey =
  | 'added_on'
  | 'name'
  | 'size'
  | 'progress'
  | 'dlspeed'
  | 'upspeed'
  | 'ratio'
  | 'last_activity';

export const PHONE_SORT_KEYS: readonly PhoneSortKey[] = [
  'added_on',
  'name',
  'size',
  'progress',
  'dlspeed',
  'upspeed',
  'ratio',
  'last_activity',
];

export interface MobileListSettings {
  compactRows: boolean;
  sortKey: PhoneSortKey;
  sortDesc: boolean;
}

export const DEFAULT_MOBILE_LIST_SETTINGS: MobileListSettings = {
  compactRows: false,
  sortKey: 'added_on',
  sortDesc: true,
};
