import { Component, ElementRef, inject, Input, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal, NgbTooltip, NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { TypeaheadService } from '../../../services/typeahead.service';

@Component({
  selector: 'app-set-torrent-location',
  imports: [
    ReactiveFormsModule,
    NgbTypeahead,
    AutofocusDirective,
    NgbTooltip,
    TranslatePipe,
    TooltipOverflow,
  ],
  templateUrl: './set-torrent-location.html',
  styleUrl: './set-torrent-location.scss',
})
export class SetTorrentLocation implements OnInit {
  @Input() torrent!: Torrent;

  @ViewChild('savePathControl') public savePathControl!: ElementRef;
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly selectionStoreService = inject(SelectionStoreService);
  private readonly typeaheadService = inject(TypeaheadService);
  private readonly toastService = inject(ToastService);
  private readonly qbService = inject(QbService);
  public readonly activeModal = inject(NgbActiveModal);
  private readonly translateService = inject(TranslateService);

  public readonly searchSavePaths = this.typeaheadService.searchSavePaths;
  public setLocationForm = new FormGroup({
    path: new FormControl('', [Validators.required]),
  });

  public selected = this.selectionStoreService.selected().length;

  public ngOnInit(): void {
    this.setLocationForm.get('path')?.patchValue(this.torrent.save_path);
  }

  public async handleSubmit(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId() ?? '';
    const newPath = this.setLocationForm.get('path')?.value ?? this.torrent.save_path;

    if (!serverId) {
      console.error(SetTorrentLocation.name, 'handleSubmit', 'Failed to get server id');
      return;
    }

    if (!newPath) {
      console.error(SetTorrentLocation.name, 'handleSubmit', 'New path is invalid!');
      return;
    }

    try {
      console.log({
        serverId,
        selectedHashes: this.selectionStoreService.selectedHashes() || this.torrent.hash,
        newPath,
      });
      await this.qbService.setTorrentLocation(
        serverId,
        this.selectionStoreService.selectedHashes(),
        newPath,
      );
      this.activeModal.close();
    } catch (error: any) {
      console.error(
        SetTorrentLocation.name,
        'handleSubmit',
        'Failed to set torrent location!',
        error,
      );
      this.toastService.danger(
        error.message,
        this.translateService.instant(
          'components.modals.set-torrent-location.error.failed-to-relocate',
        ),
      );
    }
  }

  public canSave(): boolean {
    return this.setLocationForm.valid;
  }
}
