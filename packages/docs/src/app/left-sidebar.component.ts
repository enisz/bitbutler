import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { injectContentFiles } from '@analogjs/content';
import { DocAttributes } from './pages/doc-page.component';

@Component({
  selector: 'bb-left-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="left-sidebar-nav">
      @for (page of pages; track page.slug) {
        <a
          class="sidebar-nav-link"
          [routerLink]="['/', page.slug]"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
          >{{ page.attributes.title }}</a
        >
      }
    </nav>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .left-sidebar-nav {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 1rem 0;
      }
      .sidebar-nav-link {
        display: block;
        padding: 0.4rem 1rem;
        color: var(--bs-body-color);
        text-decoration: none;
        border-radius: 4px;
        font-size: 0.9rem;
        transition: background 0.15s;
      }
      .sidebar-nav-link:hover {
        background: var(--bs-secondary-bg);
      }
      .sidebar-nav-link.active {
        background: var(--bs-primary-bg-subtle);
        color: var(--bs-primary);
        font-weight: 500;
      }
    `,
  ],
})
export class LeftSidebarComponent {
  readonly pages = injectContentFiles<DocAttributes>()
    .filter((f) => f.filename.startsWith('/src/content/'))
    .sort((a, b) => (a.attributes.order ?? 99) - (b.attributes.order ?? 99));
}
