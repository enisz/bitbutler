import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';
import { SelectionStoreService } from '../../../services/selection-store.service';

@Component({
  selector: 'app-delete-torrent',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, AutofocusDirective, TranslatePipe],
  templateUrl: './delete-torrent.html',
  styleUrl: './delete-torrent.scss',
})
export class DeleteTorrent implements OnInit {
  @Input() defaultRemoveFiles = false;
  private readonly activeModal = inject(NgbActiveModal);

  private readonly selectionStore = inject(SelectionStoreService);

  readonly selected = this.selectionStore.selected;

  public deleteForm!: FormGroup;

  public ngOnInit(): void {
    this.deleteForm = new FormGroup({
      removeFiles: new FormControl(false || this.defaultRemoveFiles),
    });
  }

  public closeModal(): void {
    this.activeModal.close({ removeFiles: !!this.deleteForm.get('removeFiles')?.value });
  }

  public dismissModal(): void {
    this.activeModal.dismiss();
  }
}
