import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'pages',
    children: [
      {
        path: 'login',
        loadComponent: () => import('./pages/login/login').then((mod) => mod.Login),
      },
      {
        path: 'main',
        loadComponent: () => import('./pages/main/main').then((mod) => mod.Main),
      },
    ],
  },
  {
    path: 'add-torrent',
    loadComponent: () =>
      import('./components/add-torrent/add-torrent').then((mod) => mod.AddTorrent),
  },
  {
    path: '**',
    redirectTo: '/pages/login',
    pathMatch: 'full',
  },
];
