import { OverlayModule } from '@angular/cdk/overlay';
import { PortalModule } from '@angular/cdk/portal';
import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withXhr } from '@angular/common/http';
import localeHu from '@angular/common/locales/hu';
import {
  ApplicationConfig,
  importProvidersFrom,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import type { Tokens } from 'marked';
import { MARKED_OPTIONS, MarkedOptions, MarkedRenderer, provideMarkdown } from 'ngx-markdown';
import { TimeagoCustomFormatter, TimeagoFormatter, TimeagoIntl, provideTimeago } from 'ngx-timeago';
import { routes } from './app.routes';
import { DateFormatService } from './services/date-format.service';
import { ThemeService } from './services/theme.service';

export function markedOptionsFactory(): MarkedOptions {
  const renderer = new MarkedRenderer();

  renderer.link = ({ href, text, title: rawTitle }: Tokens.Link) => {
    const title = rawTitle || '';

    // release-drafter's change-template links each entry as "[#123](...)" -
    // give those a class so their digits can be aligned with tabular-nums,
    // without affecting other markdown links (e.g. "View all releases").
    const isPrReference = /^#\d+$/.test(text);
    const cssClass = isPrReference ? ' class="bb-ua-pr-ref"' : '';

    const escapedHref = href.replace(/'/g, "\\'");
    return `
      <a
        href="${href}"
        title="${title}"
        target="_blank"${cssClass}
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

registerLocaleData(localeHu);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withXhr()),
    provideMarkdown({
      markedOptions: {
        provide: MARKED_OPTIONS,
        useFactory: markedOptionsFactory,
      },
    }),
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: './i18n/', suffix: '.json' }),
      fallbackLang: 'us',
    }),
    importProvidersFrom(OverlayModule, PortalModule),
    provideTimeago({
      intl: { provide: TimeagoIntl, useClass: TimeagoIntl },
      formatter: { provide: TimeagoFormatter, useClass: TimeagoCustomFormatter },
    }),
    provideAppInitializer(() => {
      const themeService = inject(ThemeService);
      return themeService.init();
    }),
    provideAppInitializer(() => {
      const dateFormatService = inject(DateFormatService);
      return dateFormatService.init();
    }),
  ],
};
