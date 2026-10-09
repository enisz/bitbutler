import { Type } from '@angular/core';

export const QB_SETTINGS_TAB_IDS = [
  'bandwidth',
  'storage',
  'queue-limits',
  'seeding-ratios',
] as const;
export type QbSettingsTabId = (typeof QB_SETTINGS_TAB_IDS)[number];

// Each qBittorrent pane is its own form, so pane ids and form ids are the same set.
export type QbSettingsPaneId = QbSettingsTabId;

// Kept until the QbSettings modal is deleted.
export interface QbSettingsTab {
  id: QbSettingsTabId;
  label: string;
  loadComponent: () => Promise<Type<QbSettingsTabComponent>>;
}

export type QbSettingsTabComponent = object;
