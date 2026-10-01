import { Component, inject } from '@angular/core';
import type { ServerRecord } from '@bitbutler/shared';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
import { faStar } from '@fortawesome/free-solid-svg-icons';
import { TranslateService } from '@ngx-translate/core';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';

export interface DefaultToggleParams extends ICellRendererParams<ServerRecord, boolean> {
  onToggle: (server: ServerRecord) => void;
}

@Component({
  selector: 'app-default-toggle-renderer',
  standalone: true,
  imports: [FontAwesomeModule],
  template: `
    <button
      type="button"
      class="btn btn-sm btn-link p-0"
      (click)="toggle()"
      [attr.aria-pressed]="checked"
      [title]="checked ? unsetLabel : setLabel"
    >
      <fa-icon [icon]="checked ? faStar : faStarRegular" />
    </button>
  `,
})
export class DefaultToggleRenderer implements ICellRendererAngularComp {
  private readonly translateService = inject(TranslateService);
  private params!: DefaultToggleParams;

  checked = false;
  readonly faStar = faStar;
  readonly faStarRegular = faStarRegular;
  readonly setLabel = this.translateService.instant(
    'components.modals.manage-servers.tooltip.set-as-default',
  );
  readonly unsetLabel = this.translateService.instant(
    'components.modals.manage-servers.tooltip.unset-default',
  );

  agInit(params: DefaultToggleParams): void {
    this.params = params;
    this.checked = params.value === true;
  }

  refresh(params: DefaultToggleParams): boolean {
    this.params = params;
    this.checked = params.value === true;
    return true;
  }

  toggle(): void {
    if (this.params.data) this.params.onToggle(this.params.data);
  }
}
