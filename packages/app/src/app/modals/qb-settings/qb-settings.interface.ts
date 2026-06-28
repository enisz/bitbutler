import { Type } from '@angular/core';

export type QbSettingsTabId = 'bandwidth' | 'storage' | 'queue-limits' | 'seeding-ratios';

export interface QbSettingsTab {
  id: QbSettingsTabId;
  label: string;
  loadComponent: () => Promise<Type<QbSettingsTabComponent>>;
}

export interface QbSettingsTabComponent {}
