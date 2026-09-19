import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { faFloppyDisk, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { AutofocusDirective } from '../../directives/autofocus';
import { RssFeed } from '../../models/rss.model';
import { RssStoreService } from '../../services/rss-store.service';

@Component({
  selector: 'app-rename-subscription',
  imports: [ReactiveFormsModule, AutofocusDirective, TranslatePipe, BbBtnContent],
  templateUrl: './rename-subscription.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RenameSubscription implements OnInit {
  public readonly feed = input.required<RssFeed>();

  public readonly activeModal = inject(NgbActiveModal);
  private readonly rssStore = inject(RssStoreService);

  public readonly icons = { faFloppyDisk, faXmark };
  public readonly processing = signal(false);

  public readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[^\\]*$/)],
    }),
  });

  public ngOnInit(): void {
    this.form.controls.name.setValue(this.feed().name);
  }

  public canSave(): boolean {
    const name = this.form.controls.name.value.trim();
    return this.form.valid && name.length > 0 && name !== this.feed().name && !this.processing();
  }

  public async handleSubmit(): Promise<void> {
    if (!this.canSave()) return;

    this.processing.set(true);
    try {
      if (await this.rssStore.renameFeed(this.feed(), this.form.controls.name.value)) {
        this.activeModal.close(true);
      }
    } finally {
      this.processing.set(false);
    }
  }
}
