import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MarkdownComponent } from '@analogjs/content';
import { ContentService } from '../content.service';

export type { DocAttributes } from '../content.service';

@Component({
  selector: 'bb-doc-page',
  standalone: true,
  imports: [MarkdownComponent],
  template: `
    <div class="doc-content">
      @if (body(); as content) {
        <analog-markdown [content]="content" />
      } @else {
        <p>Page not found.</p>
      }
    </div>
  `,
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
  private readonly contentService = inject(ContentService);

  readonly body = signal('');

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug') ?? 'index';
      const file = this.contentService.getFile(slug);
      this.body.set(file?.body ?? '');
    });
  }
}
