import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ContentService, DocFile } from './content.service';

interface NavGroup {
  page: DocFile;
  children: DocFile[];
}

@Component({
  selector: 'bb-left-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="left-sidebar-nav">
      @for (group of groups; track group.page.slug) {
        <a
          class="sidebar-nav-link"
          [routerLink]="['/', group.page.slug]"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
          >{{ group.page.attributes.title }}</a
        >
        @for (child of group.children; track child.slug) {
          <a
            class="sidebar-nav-link sidebar-nav-child"
            [routerLink]="['/', child.slug]"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            >{{ child.attributes.title }}</a
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
    `,
  ],
})
export class LeftSidebarComponent {
  private readonly contentService = inject(ContentService);

  readonly groups: NavGroup[] = (() => {
    const all = this.contentService.files;
    const topLevel = all.filter((f) => !f.attributes.parent);
    return topLevel.map((page) => ({
      page,
      children: all.filter((f) => f.attributes.parent === page.slug),
    }));
  })();
}
