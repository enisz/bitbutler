import { Routes } from '@angular/router';
import { platformGuard } from './guards/platform.guard';
import { unsavedChangesGuard } from './guards/unsaved-changes.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((mod) => mod.Login),
  },
  {
    path: 'pages',
    children: [
      {
        path: 'torrent-list',
        loadComponent: () => import('./pages/main/main').then((mod) => mod.Main),
      },
      {
        path: 'settings',
        pathMatch: 'full',
        redirectTo: 'settings/general',
      },
      {
        path: 'settings/:pane',
        loadComponent: () =>
          import('./pages/settings/settings-page').then((mod) => mod.SettingsPage),
        canActivate: [platformGuard('desktop')],
        canDeactivate: [unsavedChangesGuard],
      },
      { path: 'qb-settings', pathMatch: 'full', redirectTo: 'qb-settings/bandwidth' },
      {
        path: 'qb-settings/:pane',
        loadComponent: () =>
          import('./pages/qb-settings/qb-settings-page').then((mod) => mod.QbSettingsPage),
        canActivate: [platformGuard('desktop')],
        canDeactivate: [unsavedChangesGuard],
      },
      { path: 'mobile-settings', pathMatch: 'full', redirectTo: 'mobile-settings/list' },
      {
        path: 'mobile-settings/:pane',
        loadComponent: () =>
          import('./pages/settings/settings-page').then((mod) => mod.SettingsPage),
        canActivate: [platformGuard('mobile')],
        canDeactivate: [unsavedChangesGuard],
        data: { settings: 'mobile' },
      },
    ],
  },
  {
    path: '**',
    redirectTo: '/login',
    pathMatch: 'full',
  },
];
