import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { TimeagoPipe } from 'ngx-timeago';

interface GithubRelease {
  id: number;
  tag_name: string;
  published_at: string;
  body: string | null;
  html_url: string;
}

interface Release {
  id: number;
  tagName: string;
  publishedAt: string;
  bodyHtml: SafeHtml;
  url: string;
}

@Component({
  selector: 'bb-changelog-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TimeagoPipe],
  template: `
    <div class="changelog-content">
      @if (loading()) {
        <p class="changelog-loading">Loading release history...</p>
      } @else if (error()) {
        <p class="changelog-error">
          Could not load release history.
          <a href="https://github.com/enisz/bitbutler/releases" target="_blank" rel="noopener">
            View on GitHub
          </a>
        </p>
      } @else {
        @for (release of releases(); track release.id) {
          <h2>
            {{ release.tagName }} &mdash;
            {{ release.publishedAt | date: 'MMM d, yyyy' }}
            ({{ release.publishedAt | timeago }})
          </h2>
          <div class="markdown-body" [innerHTML]="release.bodyHtml"></div>
        }
      }
    </div>
  `,
  styles: [
    `
      .changelog-content {
        padding: 1.5rem;
        max-width: 860px;
      }
      .changelog-loading,
      .changelog-error {
        color: var(--bs-secondary-color);
        padding: 2rem 0;
      }
    `,
  ],
})
export class ChangelogPageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly doc = inject(DOCUMENT);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly releases = signal<Release[]>([]);

  ngOnInit(): void {
    this.doc.defaultView?.scrollTo({ top: 0 });

    this.http
      .get<GithubRelease[]>('https://api.github.com/repos/enisz/bitbutler/releases')
      .subscribe({
        next: (data) => {
          this.releases.set(
            data.map((r) => ({
              id: r.id,
              tagName: r.tag_name,
              publishedAt: r.published_at,
              bodyHtml: this.sanitizer.bypassSecurityTrustHtml(String(marked.parse(r.body ?? ''))),
              url: r.html_url,
            })),
          );
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }
}
