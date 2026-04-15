import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { ShareLimit } from '../../share-limit/share-limit';

@Component({
  selector: 'app-limit-torrent-share',
  imports: [ReactiveFormsModule, TranslatePipe, ShareLimit],
  templateUrl: './limit-torrent-share.html',
  styleUrl: './limit-torrent-share.scss',
})
export class LimitTorrentShare {
  public readonly activeModal = inject(NgbActiveModal);

  public canSave(): boolean {
    return true;
  }
}
