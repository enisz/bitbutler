import {
  faBell,
  faGear,
  faPalette,
  faPowerOff,
  faRightLeft,
  faRotate,
  faTableList,
  faWindowMinimize,
} from '@fortawesome/free-solid-svg-icons';
import { SettingsPageConfig } from '../settings-shell/settings-shell.model';

export const SETTINGS_PAGE_BASE_PATH = '/pages/settings';

export const SETTINGS_PAGE_CONFIG: SettingsPageConfig = {
  basePath: SETTINGS_PAGE_BASE_PATH,
  titleKey: 'pages.settings.title',
  footerNoteKey: 'pages.settings.nav.footer-note',
  groups: [
    {
      labelKey: 'pages.settings.nav.group.application',
      panes: [
        {
          id: 'general',
          labelKey: 'pages.settings.tab.general.title',
          descriptionKey: 'pages.settings.tab.general.description',
          icon: faGear,
          formId: 'general',
          loadComponent: () => import('./general/general').then((m) => m.General),
        },
        {
          id: 'appearance',
          labelKey: 'pages.settings.tab.general.label.appearance',
          descriptionKey: 'pages.settings.nav.pane.appearance.description',
          icon: faPalette,
          formId: 'general',
          loadComponent: () => import('./appearance/appearance').then((m) => m.Appearance),
        },
        {
          id: 'startup',
          labelKey: 'pages.settings.tab.general.label.startup',
          descriptionKey: 'pages.settings.nav.pane.startup.description',
          icon: faPowerOff,
          formId: 'general',
          loadComponent: () => import('./startup/startup').then((m) => m.Startup),
        },
        {
          id: 'notifications',
          labelKey: 'pages.settings.tab.general.label.notifications',
          descriptionKey: 'pages.settings.nav.pane.notifications.description',
          icon: faBell,
          formId: 'general',
          loadComponent: () => import('./notifications/notifications').then((m) => m.Notifications),
        },
      ],
    },
    {
      labelKey: 'pages.settings.nav.group.server',
      panes: [
        {
          id: 'polling',
          labelKey: 'pages.settings.tab.server.label.polling',
          descriptionKey: 'pages.settings.nav.pane.polling.description',
          icon: faRotate,
          formId: 'server',
          loadComponent: () => import('./polling/polling').then((m) => m.Polling),
        },
        {
          id: 'path-mappings',
          labelKey: 'pages.settings.tab.server.label.path-mappings',
          descriptionKey: 'pages.settings.nav.pane.path-mappings.description',
          icon: faRightLeft,
          formId: 'server',
          loadComponent: () => import('./path-mappings/path-mappings').then((m) => m.PathMappings),
        },
      ],
    },
    {
      labelKey: 'pages.settings.nav.group.interface',
      panes: [
        {
          id: 'torrent-list-grid',
          labelKey: 'pages.settings.tab.torrent-list-grid.title',
          descriptionKey: 'pages.settings.tab.torrent-list-grid.description',
          icon: faTableList,
          formId: 'torrent-list-grid',
          loadComponent: () =>
            import('./torrent-list-grid/torrent-list-grid').then((m) => m.TorrentListGrid),
        },
        {
          id: 'status-bar',
          labelKey: 'pages.settings.tab.status-bar.title',
          descriptionKey: 'pages.settings.tab.status-bar.description',
          icon: faWindowMinimize,
          formId: 'status-bar',
          loadComponent: () => import('./status-bar/status-bar').then((m) => m.StatusBar),
        },
      ],
    },
  ],
};
