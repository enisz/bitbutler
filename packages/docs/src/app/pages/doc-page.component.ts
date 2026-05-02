import { AsyncPipe } from '@angular/common';
import { Component } from '@angular/core';
import { MarkdownComponent, injectContent } from '@analogjs/content';

export interface DocAttributes {
  title: string;
  order: number;
  slug: string;
}

@Component({
  selector: 'bb-doc-page',
  standalone: true,
  imports: [MarkdownComponent, AsyncPipe],
  template: `
    <div class="doc-content">
      @if (post$ | async; as post) {
        <analog-markdown [content]="post.content" />
      } @else {
        <p>Loading…</p>
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
export class DocPageComponent {
  readonly post$ = injectContent<DocAttributes>('slug');
}
