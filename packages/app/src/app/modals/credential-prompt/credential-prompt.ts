import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { faPlug, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { AutofocusDirective } from '../../directives/autofocus';
import { TooltipOverflow } from '../../directives/tooltip-overflow';

@Component({
  selector: 'app-credential-prompt',
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    AutofocusDirective,
    BbBtnContent,
    NgbTooltip,
    TooltipOverflow,
  ],
  templateUrl: './credential-prompt.html',
  styleUrl: './credential-prompt.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CredentialPrompt {
  private readonly activeModal = inject(NgbActiveModal);

  public icons = { faPlug, faXmark };

  readonly serverName = input.required<string>();
  readonly prefillUsername = input<string>('');

  public credentialForm = new FormGroup({
    username: new FormControl<string>('', { nonNullable: true }),
    password: new FormControl<string>('', { nonNullable: true }),
    saveCredentials: new FormControl<boolean>(false, { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const pre = this.prefillUsername();
      if (pre) {
        this.credentialForm.get('username')?.patchValue(pre);
      }
    });
  }

  public connect(): void {
    const { username, password, saveCredentials } = this.credentialForm.getRawValue();
    const save = saveCredentials && (!!username || !!password);
    this.activeModal.close({ username, password, save });
  }

  public cancel(): void {
    this.activeModal.dismiss();
  }
}
