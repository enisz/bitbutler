import { InputSignal, Type } from '@angular/core';

export type TorrentDetailTabId = 'general' | 'trackers' | 'peers' | 'content';

export interface Tab {
  id: TorrentDetailTabId;
  label: string;
  loadComponent: () => Promise<Type<TorrentDetailTabComponent>>;
}

export interface TorrentDetailTabComponent {
  hash: InputSignal<string>;
  context: InputSignal<Record<string, any>>;
}
