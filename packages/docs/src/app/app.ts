import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { LeftSidebarComponent } from './left-sidebar.component';
import { RightSidebarComponent } from './right-sidebar.component';
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
  ],
  template: `
    <header class="docs-header">
      <div class="docs-header-inner">
        <a class="docs-brand" [routerLink]="['/index']">
          <img class="docs-logo" [src]="logoSrc()" alt="BitButler" />
          <span class="docs-badge">BitButlerDocs</span>
        </a>
        <bb-theme-picker />
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
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .docs-brand {
        text-decoration: none;
        color: var(--bs-body-color);
        font-size: 1.1rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .docs-logo {
        height: 1.1rem;
        width: auto;
      }
      .docs-badge {
        font-weight: 600;
        letter-spacing: -0.01em;
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
  readonly logoSrc = computed(() => `./images/bitbutler-logo-${this.themeService.family()}.png`);
}
