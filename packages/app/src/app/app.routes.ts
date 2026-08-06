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
    path: '**',
    redirectTo: '/pages/login',
    pathMatch: 'full',
  },
];
