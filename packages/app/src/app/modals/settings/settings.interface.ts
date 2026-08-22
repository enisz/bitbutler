import { Type } from '@angular/core';

export type SettingsTabId = 'general' | 'server' | 'torrent-list-grid' | 'status-bar';

export interface Tab {
  id: SettingsTabId;
  label: string;
  loadComponent: () => Promise<Type<SettingsTabComponent>>;
}

export type SettingsTabComponent = object;
