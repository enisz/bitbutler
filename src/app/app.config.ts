import { OverlayModule } from '@angular/cdk/overlay';
import { PortalModule } from '@angular/cdk/portal';
import { provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  importProvidersFrom,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { MARKED_OPTIONS, MarkedOptions, MarkedRenderer, provideMarkdown } from 'ngx-markdown';
import { provideTimeago, TimeagoCustomFormatter, TimeagoFormatter, TimeagoIntl } from 'ngx-timeago';
import { FilesizePipe } from './pipes/filesize-pipe';
import { HumanizeDurationPipe } from './pipes/humanize-duration-pipe';
import { LocalTimestampPipe } from './pipes/local-timestamp-pipe';
import { RatioLimitPipe } from './pipes/ratio-limit-pipe';
import { RatioPipe } from './pipes/ratio-pipe';
import { TimeLimitPipe } from './pipes/time-limit-pipe';
import { ThemeService } from './services/theme.service';

export function markedOptionsFactory(): MarkedOptions {
  const renderer = new MarkedRenderer();

  renderer.link = (link: any) => {
    const href = link.href || link;
    const text = link.text || link;
    const title = link.title || '';

    const escapedHref = href.replace(/'/g, "\\'");
    return `
      <a
        href="${href}"
        title="${title}"
        target="_blank"
        onclick="event.preventDefault(); if(window.bitbutler?.electron?.openExternalUrl) { window.bitbutler.electron.openExternalUrl('${escapedHref}'); }"
      >
        ${text}
      </a>`;
  };

  return {
    renderer: renderer,
    gfm: true,
    breaks: false,
    pedantic: false,
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(),
    provideMarkdown({
      markedOptions: {
        provide: MARKED_OPTIONS,
        useFactory: markedOptionsFactory,
      },
    }),
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: './i18n/', suffix: '.json' }),
      defaultLanguage: 'us',
      fallbackLang: 'us',
    }),
    importProvidersFrom(OverlayModule, PortalModule),
    provideTimeago({
      intl: { provide: TimeagoIntl, useClass: TimeagoIntl },
      formatter: { provide: TimeagoFormatter, useClass: TimeagoCustomFormatter },
    }),
    FilesizePipe,
    HumanizeDurationPipe,
    RatioPipe,
    LocalTimestampPipe,
    RatioLimitPipe,
    TimeLimitPipe,
    provideAppInitializer(() => {
      const themeService = inject(ThemeService);
      return themeService.init();
    }),
  ],
};
