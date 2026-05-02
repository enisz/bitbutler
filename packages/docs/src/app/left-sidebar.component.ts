import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ContentService, DocFile } from './content.service';

interface NavEntry {
  isGroup: boolean;
  label: string;
  slug: string;
  order: number;
  children: DocFile[];
}

@Component({
  selector: 'bb-left-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="left-sidebar-nav">
      @for (entry of nav; track entry.slug) {
        <a
          class="sidebar-nav-link"
          [routerLink]="'/' + entry.slug"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
          >{{ entry.label }}</a
        >
        @if (entry.isGroup) {
          @for (child of entry.children; track child.slug) {
            <a
              class="sidebar-nav-link sidebar-nav-child"
              [routerLink]="'/' + child.slug"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: true }"
              >{{ child.attributes.title }}</a
            >
          }
        }
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
        padding: 1rem 0;
      }
      .sidebar-nav-link {
        display: block;
        padding: 0.4rem 1rem;
        color: var(--bs-body-color);
        text-decoration: none;
        font-size: 0.9rem;
        transition: background 0.15s;
        border-left: 3px solid transparent;
      }
      .sidebar-nav-link:hover {
        background: var(--bb-hover-list-item-bg);
      }
      .sidebar-nav-link.active {
        background: var(--bb-active-list-item-bg);
        color: var(--bs-body-color);
        font-weight: 600;
        border-left-color: var(--bb-accent);
      }
      .sidebar-nav-child {
        padding-left: 1.75rem;
        font-size: 0.85rem;
      }
    `,
  ],
})
export class LeftSidebarComponent {
  private readonly contentService = inject(ContentService);

  readonly nav: NavEntry[] = (() => {
    const files = this.contentService.files;

    const entries: NavEntry[] = [
      ...files
        .filter((f) => f.folder === null)
        .map((f) => ({
          isGroup: false,
          label: f.attributes.title,
          slug: f.slug,
          order: f.attributes.order ?? 99,
          children: [],
        })),
      ...files
        .filter((f) => f.isIndex)
        .map((f) => ({
          isGroup: true,
          label: f.attributes.title,
          slug: f.slug,
          order: f.attributes.order ?? 99,
          children: files
            .filter((c) => c.folder === f.folder && !c.isIndex)
            .sort((a, b) => (a.attributes.order ?? 99) - (b.attributes.order ?? 99)),
        })),
    ];

    return entries.sort((a, b) => a.order - b.order);
  })();
}
