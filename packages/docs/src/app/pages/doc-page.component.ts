import { Component, DOCUMENT, HostListener, OnInit, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { ContentService } from '../content.service';

export type { DocAttributes } from '../content.service';

const HEADER_OFFSET = 56;

@Component({
  selector: 'bb-doc-page',
  standalone: true,
  imports: [],
  template: ` <div class="doc-content markdown-body" [innerHTML]="html()"></div> `,
  styles: [
    `
      :host {
        display: block;
      }
      .doc-content {
        padding: 1.5rem;
      }
    `,
  ],
})
export class DocPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly contentService = inject(ContentService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly doc = inject(DOCUMENT);

  readonly html = signal<SafeHtml>('');

  ngOnInit(): void {
    this.route.url.subscribe((segments) => {
      const slug = segments.map((s) => s.path).join('/') || 'index';
      const file = this.contentService.getFile(slug);
      this.html.set(this.sanitizer.bypassSecurityTrustHtml(file?.html ?? '<p>Page not found.</p>'));

      const fragment = this.route.snapshot.fragment;
      if (fragment) {
        setTimeout(() => this.scrollToFragment(fragment), 0);
      } else {
        this.doc.defaultView?.scrollTo({ top: 0 });
      }
    });

    this.route.fragment.subscribe((fragment) => {
      if (fragment) {
        setTimeout(() => this.scrollToFragment(fragment), 0);
      }
    });
  }

  private scrollToFragment(id: string): void {
    const el = this.doc.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + (this.doc.defaultView?.scrollY ?? 0) - HEADER_OFFSET;
    this.doc.defaultView?.scrollTo({ top: y, behavior: 'smooth' });
  }

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    const anchor = (event.target as HTMLElement).closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href || /^(https?:|\/\/|mailto:)/.test(href)) return;
    event.preventDefault();
    const resolved = new URL(anchor.href);
    this.router.navigateByUrl(resolved.pathname + resolved.search + resolved.hash);
  }
}
