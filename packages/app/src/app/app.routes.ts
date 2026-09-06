import { Routes } from '@angular/router';

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
        path: 'logs',
        loadComponent: () => import('./pages/logs/logs').then((mod) => mod.Logs),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '/login',
    pathMatch: 'full',
  },
];
