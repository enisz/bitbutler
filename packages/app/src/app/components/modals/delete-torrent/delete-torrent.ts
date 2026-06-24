import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { faTrashCan, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';

@Component({
  selector: 'app-delete-torrent',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule,
    AutofocusDirective,
    TranslatePipe,
    FilesizePipe,
    BbBtnContent,
  ],
  templateUrl: './delete-torrent.html',
  styleUrl: './delete-torrent.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteTorrent implements OnInit {
  readonly defaultRemoveFiles = input(false);
  private readonly activeModal = inject(NgbActiveModal);

  private readonly selectionStore = inject(SelectionStoreService);

  public icons = { faTrashCan, faXmark };

  readonly selected = this.selectionStore.selected;
  readonly totalSize = computed(() => this.selected().reduce((sum, t) => sum + t.size, 0));

  public deleteForm!: FormGroup;

  public ngOnInit(): void {
    this.deleteForm = new FormGroup({
      removeFiles: new FormControl(this.defaultRemoveFiles()),
    });
  }

  public closeModal(): void {
    this.activeModal.close({ removeFiles: !!this.deleteForm.get('removeFiles')?.value });
  }

  public dismissModal(): void {
    this.activeModal.dismiss();
  }
}
