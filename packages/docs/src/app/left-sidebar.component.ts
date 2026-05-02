import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ContentService, DocFile } from './content.service';

interface NavEntry {
  isGroup: boolean;
  label: string;
  /** Raw folder name (with numeric prefix) used as stable key and for ordering. */
  slug: string;
  order: number;
  children: DocFile[];
}

function folderLabel(folder: string): string {
  return folder
    .replace(/^\d+-/, '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function folderOrder(folder: string): number {
  const match = folder.match(/^(\d+)-/);
  return match ? parseInt(match[1], 10) : 999;
}

@Component({
  selector: 'bb-left-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="left-sidebar-nav">
      @for (entry of nav; track entry.slug) {
        @if (entry.isGroup) {
          <button class="sidebar-nav-group" (click)="toggleGroup(entry.slug)">
            <span>{{ entry.label }}</span>
            <svg
              class="chevron"
              [class.open]="expandedGroups().has(entry.slug)"
              viewBox="0 0 16 16"
              fill="currentColor"
              width="12"
              height="12"
            >
              <path
                d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"
              />
            </svg>
          </button>
          @if (expandedGroups().has(entry.slug)) {
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
        } @else {
          <a
            class="sidebar-nav-link"
            [routerLink]="'/' + entry.slug"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            >{{ entry.label }}</a
          >
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
      .sidebar-nav-group {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 0.4rem 1rem;
        background: none;
        border: none;
        border-left: 3px solid transparent;
        color: var(--bs-body-color);
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        text-align: left;
        transition: background 0.15s;
      }
      .sidebar-nav-group:hover {
        background: var(--bb-hover-list-item-bg);
      }
      .chevron {
        flex-shrink: 0;
        opacity: 0.6;
        transition: transform 0.2s ease;
        transform: rotate(0deg);
      }
      .chevron.open {
        transform: rotate(90deg);
      }
    `,
  ],
})
export class LeftSidebarComponent {
  private readonly contentService = inject(ContentService);

  readonly nav: NavEntry[] = (() => {
    const files = this.contentService.files;
    const folders = [...new Set(files.filter((f) => f.folder !== null).map((f) => f.folder!))];

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
      ...folders.map((folder) => ({
        isGroup: true,
        label: folderLabel(folder),
        slug: folder,
        order: folderOrder(folder),
        children: files
          .filter((f) => f.folder === folder)
          .sort((a, b) => (a.attributes.order ?? 99) - (b.attributes.order ?? 99)),
      })),
    ];

    return entries.sort((a, b) => a.order - b.order);
  })();

  readonly expandedGroups = signal<Set<string>>(
    new Set(this.nav.filter((e) => e.isGroup).map((e) => e.slug)),
  );

  toggleGroup(slug: string): void {
    this.expandedGroups.update((set) => {
      const next = new Set(set);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }
}
