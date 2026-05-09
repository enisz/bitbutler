import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideContent, withMarkdownRenderer } from '@analogjs/content';
import { provideTimeago } from 'ngx-timeago';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideContent(withMarkdownRenderer()),
    provideHttpClient(),
    provideTimeago(),
  ],
};
