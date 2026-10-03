import { Component, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';

@Component({
  selector: 'app-active-orb-renderer',
  standalone: true,
  template: `<span
    class="bb-orb"
    [class.bb-orb-active]="active"
    [title]="active ? activeLabel : ''"
  ></span>`,
  styles: [
    `
      .bb-orb {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 1px solid var(--bs-secondary);
      }
      .bb-orb-active {
        background: var(--bs-success);
        border-color: var(--bs-success);
      }
    `,
  ],
})
export class ActiveOrbRenderer implements ICellRendererAngularComp {
  private readonly translateService = inject(TranslateService);

  active = false;
  readonly activeLabel = this.translateService.instant(
    'components.modals.manage-servers.tooltip.active',
  );

  agInit(params: ICellRendererParams<unknown, boolean>): void {
    this.active = params.value === true;
  }

  refresh(params: ICellRendererParams<unknown, boolean>): boolean {
    this.active = params.value === true;
    return true;
  }
}
