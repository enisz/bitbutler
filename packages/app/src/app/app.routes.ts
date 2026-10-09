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
        path: 'rss',
        loadComponent: () => import('./pages/rss/rss').then((mod) => mod.Rss),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '/login',
    pathMatch: 'full',
  },
];
