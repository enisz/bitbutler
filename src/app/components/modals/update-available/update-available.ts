import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { MarkdownComponent } from 'ngx-markdown';
import { clean } from 'semver';
import { UpdateCheckResponse } from '../../../models/electron.model';
import { FilesizePipe } from '../../../pipes/filesize-pipe';

@Component({
  selector: 'app-update-available',
  standalone: true,
  imports: [CommonModule, MarkdownComponent, FilesizePipe, TranslatePipe],
  templateUrl: './update-available.html',
  styleUrl: './update-available.scss',
})
export class UpdateAvailable {
  public update = signal<UpdateCheckResponse | null>(null);
  public readonly activeModal = inject(NgbActiveModal);
  public clean = clean;

  get cleanedBody(): string {
    const body = this.update()?.release?.body || '';
    return body.replace(/^#+\s*What's\s*Changed\s*\n/i, '').trim();
  }

  downloadAsset(url: string): void {
    window.open(url, '_self');
  }
}
