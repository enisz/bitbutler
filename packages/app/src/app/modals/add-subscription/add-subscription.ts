import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { AutofocusDirective } from '../../directives/autofocus';
import { RssStoreService } from '../../services/rss-store.service';

@Component({
  selector: 'app-add-subscription',
  imports: [ReactiveFormsModule, AutofocusDirective, TranslatePipe, BbBtnContent],
  templateUrl: './add-subscription.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddSubscription {
  public readonly activeModal = inject(NgbActiveModal);
  private readonly rssStore = inject(RssStoreService);

  public readonly icons = { faPlus, faXmark };
  public readonly processing = signal(false);

  public readonly form = new FormGroup({
    url: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^https?:\/\/\S+$/i)],
    }),
    // A backslash is qB's folder separator, so it cannot be part of a feed name.
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(/^[^\\]*$/)],
    }),
  });

  public canSave(): boolean {
    return this.form.valid && !this.processing();
  }

  public async handleSubmit(): Promise<void> {
    if (!this.canSave()) return;

    this.processing.set(true);
    try {
      const { url, name } = this.form.getRawValue();
      if (await this.rssStore.addFeed(url, name)) this.activeModal.close(true);
    } finally {
      this.processing.set(false);
    }
  }
}
