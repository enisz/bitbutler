import { Routes } from '@angular/router';
import { DocPageComponent } from './pages/doc-page.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'index',
    pathMatch: 'full',
  },
  {
    path: ':slug',
    component: DocPageComponent,
  },
];
