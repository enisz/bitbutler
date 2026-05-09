import { Routes } from '@angular/router';
import { ChangelogPageComponent } from './pages/changelog-page.component';
import { DocPageComponent } from './pages/doc-page.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'index',
    pathMatch: 'full',
  },
  {
    path: 'changelog',
    component: ChangelogPageComponent,
  },
  {
    path: '**',
    component: DocPageComponent,
  },
];
