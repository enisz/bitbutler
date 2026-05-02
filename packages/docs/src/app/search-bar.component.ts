import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import Fuse, { type FuseResult } from 'fuse.js';
import type { DocFile } from './content.service';
import { ContentService } from './content.service';

const MAX_RESULTS = 8;
const DROPDOWN_GAP = 8;

@Component({
  selector: 'bb-search-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink],
  template: `
    @if (isOpen()) {
      <div class="search-backdrop" (click)="close()"></div>
    }
    <div class="search-wrapper">
      <svg class="search-icon" viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
        <path
          d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.656a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"
        />
      </svg>
      <input
        #searchInput
        class="search-input"
        type="search"
        placeholder="Search docs..."
        [(ngModel)]="query"
        (ngModelChange)="onSearch($event)"
        (focus)="onFocus()"
        (keydown.escape)="close()"
      />
    </div>
    @if (isOpen()) {
      <div
        class="search-dropdown"
        [style.top]="dropdownTop()"
        [style.left]="dropdownLeft()"
        [style.width]="dropdownWidth()"
      >
        @if (results().length > 0) {
          <ul class="result-list">
            @for (result of results(); track result.item.slug) {
              <li>
                <a
                  class="result-item"
                  [routerLink]="'/' + result.item.slug"
                  (click)="onResultClick()"
                >
                  @if (result.item.folder) {
                    <span class="result-folder">{{ formatFolder(result.item.folder) }}</span>
                  }
                  <span class="result-title">{{ result.item.attributes.title }}</span>
                </a>
              </li>
            }
          </ul>
        } @else if (query.trim()) {
          <div class="search-empty">
            No results for "<strong>{{ query.trim() }}</strong
            >"
          </div>
        } @else {
          <div class="search-hint">Type to search documentation…</div>
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        max-width: 360px;
      }

      .search-backdrop {
        position: fixed;
        inset: 0;
        z-index: 99;
        background: rgba(0, 0, 0, 0.35);
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

      .search-dropdown {
        position: fixed;
        z-index: 101;
        background: var(--bs-body-bg);
        border: 1px solid var(--bs-border-color);
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        max-height: 400px;
        overflow-y: auto;
      }

      .result-list {
        list-style: none;
        margin: 0;
        padding: 0.375rem 0;
      }

      .result-item {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
        padding: 0.5rem 0.875rem;
        text-decoration: none;
        color: var(--bs-body-color);
        transition: background 0.1s;
      }

      .result-item:hover {
        background: color-mix(in srgb, var(--bb-accent, var(--bs-primary)) 10%, transparent);
      }

      .result-title {
        font-size: 0.875rem;
        font-weight: 500;
      }

      .result-folder {
        font-size: 0.75rem;
        opacity: 0.55;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .search-empty,
      .search-hint {
        padding: 0.875rem;
        font-size: 0.875rem;
        color: var(--bs-secondary-color);
        text-align: center;
      }
    `,
  ],
})
export class SearchBarComponent {
  private readonly contentService = inject(ContentService);
  private readonly elementRef = inject(ElementRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('searchInput') private readonly searchInputEl!: ElementRef<HTMLInputElement>;

  private readonly fuseTitle = new Fuse(this.contentService.files, {
    keys: ['attributes.title'],
    threshold: 0.4,
    includeScore: true,
  });

  private readonly fuseBody = new Fuse(this.contentService.files, {
    keys: ['body'],
    threshold: 0.4,
    ignoreLocation: true,
    includeScore: true,
  });

  readonly isOpen = signal(false);
  readonly results = signal<FuseResult<DocFile>[]>([]);
  readonly dropdownTop = signal('0px');
  readonly dropdownLeft = signal('0px');
  readonly dropdownWidth = signal('360px');

  query = '';

  onFocus(): void {
    this.isOpen.set(true);
    this.updateDropdownPosition();
  }

  close(): void {
    this.isOpen.set(false);
    this.searchInputEl?.nativeElement?.blur();
  }

  onSearch(query: string): void {
    const trimmed = query.trim();
    if (!trimmed) {
      this.results.set([]);
      return;
    }
    const titleHits = this.fuseTitle.search(trimmed, { limit: MAX_RESULTS });
    const bodyHits = this.fuseBody.search(trimmed, { limit: MAX_RESULTS });
    const seen = new Set<string>();
    const merged: FuseResult<DocFile>[] = [];
    for (const r of [...titleHits, ...bodyHits].sort((a, b) => (a.score ?? 1) - (b.score ?? 1))) {
      if (!seen.has(r.item.slug)) {
        seen.add(r.item.slug);
        merged.push(r);
      }
    }
    this.results.set(merged.slice(0, MAX_RESULTS));
  }

  onResultClick(): void {
    this.query = '';
    this.results.set([]);
    this.close();
    this.cdr.markForCheck();
  }

  formatFolder(folder: string): string {
    return folder.replace(/^\d+-/, '').replace(/-/g, ' ');
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentMousedown(event: MouseEvent): void {
    if (this.isOpen() && !this.elementRef.nativeElement.contains(event.target)) {
      this.close();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.isOpen()) {
      this.updateDropdownPosition();
    }
  }

  private updateDropdownPosition(): void {
    const el = this.searchInputEl?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    this.dropdownTop.set(`${rect.bottom + DROPDOWN_GAP}px`);
    this.dropdownLeft.set(`${rect.left}px`);
    this.dropdownWidth.set(`${Math.max(rect.width, 360)}px`);
  }
}
