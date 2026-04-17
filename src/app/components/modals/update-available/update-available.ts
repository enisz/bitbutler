import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { NgbAccordionModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { MarkdownComponent } from 'ngx-markdown';
import { TimeagoPipe } from 'ngx-timeago';
import { Release, UpdateCheckResponse } from '../../../models/electron.model';
import { FilesizePipe } from '../../../pipes/filesize-pipe';

@Component({
  selector: 'app-update-available',
  standalone: true,
  imports: [
    CommonModule,
    NgbAccordionModule,
    MarkdownComponent,
    FilesizePipe,
    TimeagoPipe,
    TranslatePipe,
  ],
  templateUrl: './update-available.html',
  styleUrl: './update-available.scss',
})
export class UpdateAvailable {
  public update = signal<UpdateCheckResponse | null>(null);
  public readonly activeModal = inject(NgbActiveModal);

  get latestRelease(): Release | undefined {
    return this.update()?.releases?.[0];
  }

  public cleanedBody(release: Release): string {
    const body = release.body || '';
    return body.replace(/^#+\s*What's\s*Changed\s*\r?\n/i, '').trim();
  }

  public getVersion(version: string): string {
    return version.replace(/^v/, '');
  }

  public toMs(dateStr: string | null | undefined): number {
    return dateStr ? new Date(dateStr).getTime() : 0;
  }

  public downloadAsset(url: string): void {
    window.open(url, '_self');
  }
}
