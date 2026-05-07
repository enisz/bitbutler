import { Component, effect, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import darkThemeCss from 'highlight.js/styles/atom-one-dark.css?inline';
import lightThemeCss from 'highlight.js/styles/atom-one-light.css?inline';
import { LeftSidebarComponent } from './left-sidebar.component';
import { RightSidebarComponent } from './right-sidebar.component';
import { SearchBarComponent } from './search-bar.component';
import { ThemePickerComponent } from './theme-picker.component';
import { ThemeService } from './theme.service';

@Component({
  selector: 'bb-docs-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    ThemePickerComponent,
    LeftSidebarComponent,
    RightSidebarComponent,
    SearchBarComponent,
  ],
  template: `
    <header class="docs-header">
      <div class="docs-header-inner">
        <a class="docs-brand" [routerLink]="['/index']">
          <img src="/images/bitbutler-logo-bitbutler.png" alt="BitButler" class="docs-logo" />
          <strong>BitButler</strong><span class="docs-subtitle">Docs</span>
        </a>
        <bb-search-bar class="docs-search" />
        <div class="docs-header-end">
          <bb-theme-picker />
        </div>
      </div>
    </header>

    <div class="docs-layout">
      <aside class="docs-sidebar-left">
        <bb-left-sidebar />
      </aside>

      <main class="docs-main content-area">
        <router-outlet />
      </main>

      <aside class="docs-sidebar-right">
        <bb-right-sidebar />
      </aside>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
      }

      .docs-header {
        position: sticky;
        top: 0;
        z-index: 100;
        background: var(--bs-body-bg);
        border-bottom: 1px solid var(--bs-border-color);
      }
      .docs-header-inner {
        max-width: 1400px;
        margin: 0 auto;
        padding: 0.75rem 1.5rem;
        display: grid;
        grid-template-columns: 1fr minmax(200px, 360px) 1fr;
        align-items: center;
        gap: 1rem;
      }
      .docs-brand {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        text-decoration: none;
        color: var(--bs-body-color);
        font-size: 1.1rem;
      }
      .docs-logo {
        height: 28px;
        width: auto;
        flex-shrink: 0;
      }
      .docs-subtitle {
        opacity: 0.6;
        font-weight: 400;
        margin-left: 0.25rem;
      }
      .docs-header-end {
        display: flex;
        justify-content: flex-end;
      }

      .docs-layout {
        display: grid;
        grid-template-columns: 220px 1fr 200px;
        max-width: 1400px;
        margin: 0 auto;
        min-height: calc(100vh - 56px);
      }

      .docs-sidebar-left {
        border-right: 1px solid var(--bs-border-color);
        position: sticky;
        top: 56px;
        height: calc(100vh - 56px);
        overflow-y: auto;
      }

      .docs-main {
        min-width: 0;
        padding: 0;
      }

      .docs-sidebar-right {
        border-left: 1px solid var(--bs-border-color);
        position: sticky;
        top: 56px;
        height: calc(100vh - 56px);
        overflow-y: auto;
      }

      @media (max-width: 1024px) {
        .docs-layout {
          grid-template-columns: 200px 1fr;
        }
        .docs-sidebar-right {
          display: none;
        }
      }
      @media (max-width: 640px) {
        .docs-layout {
          grid-template-columns: 1fr;
        }
        .docs-sidebar-left {
          display: none;
        }
      }
    `,
  ],
})
export class AppComponent {
  private readonly themeService = inject(ThemeService);

  constructor() {
    effect(() => {
      const isDark = this.themeService.effectiveMode() === 'dark';
      let style = document.getElementById('hljs-theme') as HTMLStyleElement | null;
      if (!style) {
        style = document.createElement('style');
        style.id = 'hljs-theme';
        document.head.appendChild(style);
      }
      style.textContent = isDark ? darkThemeCss : lightThemeCss;
    });
  }
}
