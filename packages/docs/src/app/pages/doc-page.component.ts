import { Component, OnInit, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { ContentService } from '../content.service';

export type { DocAttributes } from '../content.service';

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
        max-width: 860px;
      }
    `,
  ],
})
export class DocPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly contentService = inject(ContentService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly html = signal<SafeHtml>('');

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug') ?? 'index';
      const file = this.contentService.getFile(slug);
      this.html.set(this.sanitizer.bypassSecurityTrustHtml(file?.html ?? '<p>Page not found.</p>'));
    });
  }
}
