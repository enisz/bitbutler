import { faGauge, faHardDrive, faListOl, faPercent } from '@fortawesome/free-solid-svg-icons';
import { SettingsPageConfig } from '../settings-shell/settings-shell.model';

export const QB_SETTINGS_PAGE_BASE_PATH = '/pages/qb-settings';

export const QB_SETTINGS_PAGE_CONFIG: SettingsPageConfig = {
  basePath: QB_SETTINGS_PAGE_BASE_PATH,
  titleKey: 'pages.qb-settings.title',
  footerNoteKey: 'pages.qb-settings.nav.footer-note',
  groups: [
    {
      labelKey: 'pages.qb-settings.nav.group.preferences',
      panes: [
        {
          id: 'bandwidth',
          labelKey: 'pages.qb-settings.tab.bandwidth.title',
          descriptionKey: 'pages.qb-settings.tab.bandwidth.description',
          icon: faGauge,
          formId: 'bandwidth',
          loadComponent: () => import('./bandwidth/bandwidth').then((m) => m.Bandwidth),
        },
        {
          id: 'storage',
          labelKey: 'pages.qb-settings.tab.storage.title',
          descriptionKey: 'pages.qb-settings.tab.storage.description',
          icon: faHardDrive,
          formId: 'storage',
          loadComponent: () => import('./storage/storage').then((m) => m.Storage),
        },
        {
          id: 'queue-limits',
          labelKey: 'pages.qb-settings.tab.queue-limits.title',
          descriptionKey: 'pages.qb-settings.tab.queue-limits.description',
          icon: faListOl,
          formId: 'queue-limits',
          loadComponent: () => import('./queue-limits/queue-limits').then((m) => m.QueueLimits),
        },
        {
          id: 'seeding-ratios',
          labelKey: 'pages.qb-settings.tab.seeding-ratios.title',
          descriptionKey: 'pages.qb-settings.tab.seeding-ratios.description',
          icon: faPercent,
          formId: 'seeding-ratios',
          loadComponent: () =>
            import('./seeding-ratios/seeding-ratios').then((m) => m.SeedingRatios),
        },
      ],
    },
  ],
};
