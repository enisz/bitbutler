import { CommonModule } from '@angular/common';
import { Component, computed, inject, Input, OnInit, signal, Type } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { BbSpinner } from '../../components/bb-spinner/bb-spinner';
import { AutofocusDirective } from '../../directives/autofocus';
import { SettingsTabComponent, SettingsTabId, Tab } from './settings.interface';

@Component({
  selector: 'app-settings',
  imports: [BbSpinner, CommonModule, AutofocusDirective, TranslatePipe],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings implements OnInit {
  @Input() public tabToOpen: SettingsTabId = 'general';
  public readonly activeModal = inject(NgbActiveModal);

  public activeTabId = signal<SettingsTabId>(this.tabToOpen);
  public loadedComponent = signal<Type<SettingsTabComponent> | null>(null);
  public label = computed(() => this.tabs.find((t) => t.id === this.activeTabId())?.label ?? '');

  public tabs: Tab[] = [
    {
      id: 'general',
      label: 'pages.settings.tab.general.title',
      loadComponent: () => import('./general/general').then((m) => m.General),
    },
    {
      id: 'server',
      label: 'pages.settings.tab.server.title',
      loadComponent: () => import('./server/server').then((m) => m.Server),
    },
    {
      id: 'torrent-list-grid',
      label: 'pages.settings.tab.torrent-list-grid.title',
      loadComponent: () =>
        import('./torrent-list-grid/torrent-list-grid').then((m) => m.TorrentListGrid),
    },
    {
      id: 'status-bar',
      label: 'pages.settings.tab.status-bar.title',
      loadComponent: () => import('./status-bar/status-bar').then((m) => m.StatusBar),
    },
  ];

  public ngOnInit(): void {
    this.selectTab(this.tabToOpen);
  }

  public async selectTab(tabId: SettingsTabId): Promise<void> {
    if (this.activeTabId() === tabId && this.loadedComponent() !== null) return;
    this.activeTabId.set(tabId);
    this.loadedComponent.set(null);

    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) throw new Error(`Tab with id ${tabId} not found`);

    const component = await tab.loadComponent();
    this.loadedComponent.set(component);
  }
}
