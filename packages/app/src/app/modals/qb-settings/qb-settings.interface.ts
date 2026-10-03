import { Type } from '@angular/core';

export type QbSettingsTabId = 'bandwidth' | 'storage' | 'queue-limits' | 'seeding-ratios' | 'rss';

export interface QbSettingsTab {
  id: QbSettingsTabId;
  label: string;
  loadComponent: () => Promise<Type<QbSettingsTabComponent>>;
}

export type QbSettingsTabComponent = object;
