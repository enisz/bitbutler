import {
  ChangeDetectorRef,
  Component,
  DOCUMENT,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';

const HEADER_HEIGHT = 56;

interface TocEntry {
  id: string;
  text: string;
  level: number; // 2 = h2, 3 = h3
}

@Component({
  selector: 'bb-right-sidebar',
  standalone: true,
  imports: [],
  template: `
    @if (toc().length > 0) {
      <nav class="toc-nav">
        <div class="toc-title">On this page</div>
        @for (entry of toc(); track entry.id) {
          <a
            class="toc-link"
            [class.toc-h3]="entry.level === 3"
            [class.active]="activeId() === entry.id"
            [href]="'#' + entry.id"
            (click)="scrollTo($event, entry.id)"
            >{{ entry.text }}</a
          >
        }
      </nav>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .toc-nav {
        padding: 1rem 0;
      }
      .toc-title {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        opacity: 0.6;
        margin-bottom: 0.5rem;
        padding: 0 0.5rem;
      }
      .toc-link {
        display: block;
        padding: 0.25rem 0.5rem;
        font-size: 0.85rem;
        color: var(--bs-body-color);
        text-decoration: none;
        border-left: 2px solid transparent;
        transition: all 0.15s;
        opacity: 0.75;
      }
      .toc-link.toc-h3 {
        padding-left: 1rem;
        font-size: 0.8rem;
      }
      .toc-link:hover {
        opacity: 1;
      }
      .toc-link.active {
        border-left-color: var(--bs-primary);
        color: var(--bs-primary);
        opacity: 1;
      }
    `,
  ],
})
export class RightSidebarComponent implements OnInit, OnDestroy {
  private readonly doc = inject(DOCUMENT);
  private readonly cdr = inject(ChangeDetectorRef);
  private observer: IntersectionObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private scrollingTimer: ReturnType<typeof setTimeout> | null = null;
  private isScrolling = false;

  readonly toc = signal<TocEntry[]>([]);
  readonly activeId = signal<string>('');

  ngOnInit(): void {
    this.mutationObserver = new MutationObserver(() => this.buildToc());
    const contentArea = this.doc.querySelector('.content-area');
    if (contentArea) {
      this.mutationObserver.observe(contentArea, { childList: true, subtree: true });
    }
    this.buildToc();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.mutationObserver?.disconnect();
    if (this.scrollingTimer !== null) clearTimeout(this.scrollingTimer);
  }

  private buildToc(): void {
    this.observer?.disconnect();

    const headings = Array.from(
      this.doc.querySelectorAll<HTMLElement>('.content-area h2, .content-area h3'),
    );

    if (headings.length === 0) {
      this.toc.set([]);
      return;
    }

    headings.forEach((h) => {
      if (!h.id) {
        h.id =
          h.textContent
            ?.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') ?? '';
      }
    });

    this.toc.set(
      headings.map((h) => ({
        id: h.id,
        text: h.textContent ?? '',
        level: parseInt(h.tagName[1], 10),
      })),
    );

    // Top margin accounts for sticky header; bottom margin narrows the active zone
    // to the band just below the header so the active entry tracks what the user is reading.
    this.observer = new IntersectionObserver(
      (entries) => {
        if (this.isScrolling) return;
        const visible = entries.find((e) => e.isIntersecting);
        if (visible) {
          this.activeId.set(visible.target.id);
          this.cdr.markForCheck();
        }
      },
      { rootMargin: `-${HEADER_HEIGHT}px 0px -60% 0px`, threshold: 0 },
    );

    headings.forEach((h) => this.observer!.observe(h));
  }

  scrollTo(event: Event, id: string): void {
    event.preventDefault();

    // Pause scroll-spy during smooth scrolling to prevent flickering
    this.isScrolling = true;
    if (this.scrollingTimer !== null) clearTimeout(this.scrollingTimer);

    this.activeId.set(id);

    const target = this.doc.getElementById(id);
    if (target) {
      const y = target.getBoundingClientRect().top + this.doc.defaultView!.scrollY - HEADER_HEIGHT;
      this.doc.defaultView!.scrollTo({ top: y, behavior: 'smooth' });
    }

    // Re-enable scroll-spy after scroll animation completes (~600ms is enough for smooth scroll)
    this.scrollingTimer = setTimeout(() => {
      this.isScrolling = false;
      this.scrollingTimer = null;
    }, 600);
  }
}
