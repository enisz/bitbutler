import { Type } from '@angular/core';

export type TorrentDetailTabId = 'general' | 'trackers' | 'peers' | 'content';

export interface Tab {
  id: TorrentDetailTabId;
  label: string;
  loadComponent: () => Promise<Type<TorrentDetailTabComponent>>;
}

export type TorrentDetailTabComponent = object;
