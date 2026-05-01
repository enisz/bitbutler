import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/index.page').then((m) => m.IndexPageComponent),
  },
  {
    path: 'features',
    loadComponent: () => import('./pages/features.page').then((m) => m.FeaturesPageComponent),
  },
  {
    path: 'architecture',
    loadComponent: () =>
      import('./pages/architecture.page').then((m) => m.ArchitecturePageComponent),
  },
  {
    path: 'development',
    loadComponent: () => import('./pages/development.page').then((m) => m.DevelopmentPageComponent),
  },
  { path: '**', redirectTo: '' },
];
