import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Fuse from 'fuse.js';
import { ContentService } from './content.service';

@Component({
  selector: 'bb-search-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="search-wrapper">
      <svg class="search-icon" viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
        <path
          d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.656a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"
        />
      </svg>
      <input
        class="search-input"
        type="search"
        placeholder="Search docs..."
        [(ngModel)]="query"
        (ngModelChange)="onSearch($event)"
      />
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        max-width: 360px;
      }
      .search-wrapper {
        position: relative;
        width: 100%;
      }
      .search-icon {
        position: absolute;
        left: 0.6rem;
        top: 50%;
        transform: translateY(-50%);
        opacity: 0.4;
        pointer-events: none;
      }
      .search-input {
        width: 100%;
        height: 32px;
        padding: 0 0.75rem 0 2rem;
        font-size: 0.875rem;
        background: var(--bs-body-bg);
        color: var(--bs-body-color);
        border: 1px solid var(--bs-border-color);
        border-radius: 6px;
        outline: none;
        transition:
          border-color 0.15s,
          box-shadow 0.15s;
      }
      .search-input:focus {
        border-color: var(--bb-accent, var(--bs-primary));
        box-shadow: 0 0 0 2px
          color-mix(in srgb, var(--bb-accent, var(--bs-primary)) 20%, transparent);
      }
      .search-input::placeholder {
        opacity: 0.45;
      }
      .search-input::-webkit-search-cancel-button {
        cursor: pointer;
      }
    `,
  ],
})
export class SearchBarComponent {
  private readonly contentService = inject(ContentService);

  private readonly fuse = new Fuse(this.contentService.files, {
    keys: [
      { name: 'attributes.title', weight: 0.7 },
      { name: 'body', weight: 0.3 },
    ],
    threshold: 0.4,
    includeScore: true,
  });

  query = '';

  onSearch(query: string): void {
    const trimmed = query.trim();
    if (!trimmed) {
      console.log('[Search] cleared');
      return;
    }
    const results = this.fuse.search(trimmed);
    console.log(
      '[Search]',
      results.map((r) => ({
        title: r.item.attributes.title,
        slug: r.item.slug,
        score: r.score?.toFixed(3),
      })),
    );
  }
}
