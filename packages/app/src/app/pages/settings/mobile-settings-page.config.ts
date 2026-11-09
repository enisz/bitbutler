import {
  faCircleInfo,
  faDownload,
  faFileExport,
  faFileImport,
  faList,
  faPowerOff,
  faRightFromBracket,
  faUpload,
} from '@fortawesome/free-solid-svg-icons';
import { SettingsPageConfig } from '../settings-shell/settings-shell.model';
import { SETTINGS_PAGE_CONFIG } from './settings-page.config';

export const MOBILE_SETTINGS_BASE_PATH = '/pages/mobile-settings';

/** The desktop definition of a pane that the mobile page reuses as is (same component, same formId). */
const reusedPane = (id: string) => {
  const pane = SETTINGS_PAGE_CONFIG.groups.flatMap((g) => g.panes).find((p) => p.id === id);
  if (!pane) throw new Error(`Unknown settings pane: ${id}`);
  return pane;
};

export const MOBILE_SETTINGS_PAGE_CONFIG: SettingsPageConfig = {
  basePath: MOBILE_SETTINGS_BASE_PATH,
  titleKey: 'pages.mobile-settings.title',
  footerNoteKey: 'pages.settings.nav.footer-note',
  groups: [
    {
      labelKey: 'pages.mobile-settings.group.interface',
      panes: [
        {
          id: 'list',
          labelKey: 'pages.mobile-settings.pane.list.title',
          descriptionKey: 'pages.mobile-settings.pane.list.description',
          icon: faList,
          formId: 'mobile-list',
          loadComponent: () => import('./mobile-list/mobile-list').then((m) => m.MobileList),
        },
      ],
    },
    {
      labelKey: 'pages.mobile-settings.group.application',
      panes: [reusedPane('general'), reusedPane('appearance'), reusedPane('polling')],
    },
    {
      labelKey: 'pages.mobile-settings.group.data',
      panes: [],
      actions: [
        {
          id: 'import-torrents',
          labelKey: 'pages.mobile-settings.action.import-torrents',
          icon: faDownload,
          menuAction: 'file.importTorrents',
        },
        {
          id: 'export-torrents',
          labelKey: 'pages.mobile-settings.action.export-torrents',
          icon: faUpload,
          menuAction: 'file.exportTorrents',
        },
        {
          id: 'import-configuration',
          labelKey: 'pages.mobile-settings.action.import-configuration',
          icon: faFileImport,
          menuAction: 'file.importConfiguration',
        },
        {
          id: 'export-configuration',
          labelKey: 'pages.mobile-settings.action.export-configuration',
          icon: faFileExport,
          menuAction: 'file.exportConfiguration',
        },
      ],
    },
    {
      labelKey: 'pages.mobile-settings.group.help',
      panes: [],
      actions: [
        {
          id: 'about',
          labelKey: 'pages.mobile-settings.action.about',
          icon: faCircleInfo,
          menuAction: 'help.about',
        },
      ],
    },
    {
      labelKey: 'pages.mobile-settings.group.session',
      panes: [],
      actions: [
        {
          id: 'disconnect',
          labelKey: 'pages.mobile-settings.action.disconnect',
          icon: faRightFromBracket,
          menuAction: 'file.disconnect',
        },
        {
          id: 'quit',
          labelKey: 'pages.mobile-settings.action.quit',
          icon: faPowerOff,
          danger: true,
          menuAction: 'file.quit',
        },
      ],
    },
  ],
};
