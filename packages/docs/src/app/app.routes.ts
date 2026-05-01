import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/index.page').then((m) => m.IndexPageComponent),
  },
  { path: '**', redirectTo: '' },
];
