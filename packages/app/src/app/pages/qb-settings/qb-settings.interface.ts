export const QB_SETTINGS_TAB_IDS = [
  'bandwidth',
  'storage',
  'queue-limits',
  'seeding-ratios',
] as const;
export type QbSettingsTabId = (typeof QB_SETTINGS_TAB_IDS)[number];

// Each qBittorrent pane is its own form, so pane ids and form ids are the same set.
export type QbSettingsPaneId = QbSettingsTabId;

export type QbSettingsTabComponent = object;
