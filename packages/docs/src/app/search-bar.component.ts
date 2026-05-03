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
import Fuse from 'fuse.js';
import type { DocFile } from './content.service';
import { ContentService } from './content.service';

const MAX_RESULTS = 8;
const DROPDOWN_GAP = 8;
const SNIPPET_RADIUS = 120;

interface TextPart {
  text: string;
  highlighted: boolean;
}

interface ResultDisplay {
  item: DocFile;
  slug: string;
  bestScore: number;
  titleParts: TextPart[];
  sectionHeading: string | null;
  snippetParts: TextPart[] | null;
}

type MatchIndices = ReadonlyArray<readonly [number, number]>;

function buildParts(text: string, indices?: MatchIndices): TextPart[] {
  if (!indices?.length) return [{ text, highlighted: false }];
  const parts: TextPart[] = [];
  let cursor = 0;
  for (const [s, e] of indices) {
    if (s > cursor) parts.push({ text: text.slice(cursor, s), highlighted: false });
    parts.push({ text: text.slice(s, e + 1), highlighted: true });
    cursor = e + 1;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), highlighted: false });
  return parts;
}

function extractHeading(body: string, matchPos: number): string | null {
  const lines = body.substring(0, matchPos).split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/^#{2,6}\s+(.+)$/);
    if (m) return m[1].trim();
  }
  return null;
}

function cleanMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function buildSnippet(body: string, indices: MatchIndices): TextPart[] | null {
  if (!indices.length) return null;
  const [firstStart, firstEnd] = indices[0];
  const snippetStart = Math.max(0, firstStart - SNIPPET_RADIUS);
  const snippetEnd = Math.min(body.length, firstEnd + SNIPPET_RADIUS);
  const snippet = body.substring(snippetStart, snippetEnd);
  const offset = snippetStart;

  const adjusted: Array<readonly [number, number]> = indices
    .filter(([s, e]) => s >= snippetStart && e < snippetEnd)
    .map(([s, e]) => [s - offset, e - offset] as const);

  const parts = buildParts(snippet, adjusted);
  if (snippetStart > 0 && parts.length) parts[0] = { ...parts[0], text: '…' + parts[0].text };
  if (snippetEnd < body.length && parts.length) {
    parts[parts.length - 1] = {
      ...parts[parts.length - 1],
      text: parts[parts.length - 1].text + '…',
    };
  }

  return parts.map((p) => ({ ...p, text: cleanMarkdown(p.text) })).filter((p) => p.text.length > 0);
}

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
        @if (displayResults().length > 0) {
          <ul class="result-list">
            @for (display of displayResults(); track display.slug) {
              <li>
                <a class="result-item" [routerLink]="'/' + display.slug" (click)="onResultClick()">
                  <span class="result-heading">
                    @for (part of display.titleParts; track $index) {
                      @if (part.highlighted) {
                        <mark class="result-mark">{{ part.text }}</mark>
                      } @else {
                        {{ part.text }}
                      }
                    }
                    @if (display.sectionHeading) {
                      <span class="result-sep">›</span>
                      <span class="result-section">{{ display.sectionHeading }}</span>
                    }
                  </span>
                  @if (display.snippetParts) {
                    <span class="result-snippet">
                      @for (part of display.snippetParts; track $index) {
                        @if (part.highlighted) {
                          <mark class="result-mark">{{ part.text }}</mark>
                        } @else {
                          {{ part.text }}
                        }
                      }
                    </span>
                  }
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
        background: rgba(0, 0, 0, 0.2);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
      }

      .search-wrapper {
        position: relative;
        width: 100%;
        z-index: 100;
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
        max-height: 480px;
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
        gap: 0.25rem;
        padding: 0.625rem 0.875rem;
        text-decoration: none;
        color: var(--bs-body-color);
        transition: background 0.1s;
      }

      .result-item:hover {
        background: color-mix(in srgb, var(--bb-accent, var(--bs-primary)) 10%, transparent);
      }

      .result-heading {
        display: flex;
        align-items: baseline;
        gap: 0.375rem;
        flex-wrap: wrap;
        font-size: 0.875rem;
        font-weight: 500;
        line-height: 1.3;
      }

      .result-sep {
        opacity: 0.35;
        font-size: 0.75rem;
        flex-shrink: 0;
      }

      .result-section {
        font-size: 0.8125rem;
        font-weight: 400;
        color: var(--bs-secondary-color);
      }

      .result-snippet {
        font-size: 0.75rem;
        line-height: 1.5;
        color: var(--bs-secondary-color);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .result-mark {
        background: color-mix(in srgb, var(--bb-accent, var(--bs-warning)) 35%, transparent);
        color: inherit;
        border-radius: 2px;
        padding: 0 1px;
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
    includeMatches: true,
  });

  private readonly fuseBody = new Fuse(this.contentService.files, {
    keys: ['body'],
    threshold: 0.4,
    ignoreLocation: true,
    includeScore: true,
    includeMatches: true,
  });

  readonly isOpen = signal(false);
  readonly displayResults = signal<ResultDisplay[]>([]);
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
      this.displayResults.set([]);
      return;
    }

    const titleMap = new Map<string, { score: number; indices?: MatchIndices }>();
    for (const r of this.fuseTitle.search(trimmed, { limit: MAX_RESULTS * 2 })) {
      titleMap.set(r.item.slug, {
        score: r.score ?? 1,
        indices: r.matches?.[0]?.indices as MatchIndices | undefined,
      });
    }

    const bodyMap = new Map<string, { score: number; indices?: MatchIndices }>();
    for (const r of this.fuseBody.search(trimmed, { limit: MAX_RESULTS * 2 })) {
      bodyMap.set(r.item.slug, {
        score: r.score ?? 1,
        indices: r.matches?.[0]?.indices as MatchIndices | undefined,
      });
    }

    const allSlugs = new Set([...titleMap.keys(), ...bodyMap.keys()]);
    const displays: ResultDisplay[] = [];

    for (const slug of allSlugs) {
      const titleData = titleMap.get(slug);
      const bodyData = bodyMap.get(slug);
      const item = this.contentService.files.find((f) => f.slug === slug)!;
      const bestScore = Math.min(titleData?.score ?? 1, bodyData?.score ?? 1);

      let sectionHeading: string | null = null;
      let snippetParts: TextPart[] | null = null;
      if (bodyData?.indices?.length) {
        sectionHeading = extractHeading(item.body, bodyData.indices[0][0]);
        snippetParts = buildSnippet(item.body, bodyData.indices);
      }

      displays.push({
        item,
        slug,
        bestScore,
        titleParts: buildParts(item.attributes.title, titleData?.indices),
        sectionHeading,
        snippetParts,
      });
    }

    displays.sort((a, b) => a.bestScore - b.bestScore);
    this.displayResults.set(displays.slice(0, MAX_RESULTS));
  }

  onResultClick(): void {
    this.query = '';
    this.displayResults.set([]);
    this.close();
    this.cdr.markForCheck();
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
