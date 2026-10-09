import { Type } from '@angular/core';

export const SETTINGS_FORM_IDS = ['general', 'server', 'torrent-list-grid', 'status-bar'] as const;
export type SettingsFormId = (typeof SETTINGS_FORM_IDS)[number];

export const SETTINGS_PANE_IDS = [
  'general',
  'appearance',
  'startup',
  'notifications',
  'polling',
  'path-mappings',
  'torrent-list-grid',
  'status-bar',
] as const;
export type SettingsPaneId = (typeof SETTINGS_PANE_IDS)[number];

export interface NgSelectItem {
  value: string;
  label: string;
}

// Kept until the Settings modal is deleted.
export type SettingsTabId = SettingsFormId;

export interface Tab {
  id: SettingsTabId;
  label: string;
  loadComponent: () => Promise<Type<SettingsTabComponent>>;
}

export type SettingsTabComponent = object;
