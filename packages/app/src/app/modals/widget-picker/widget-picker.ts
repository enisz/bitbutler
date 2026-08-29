import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { WidgetTypeId } from '../../models/dashboard.model';
import { WIDGET_CATALOG, WidgetCatalogMeta } from '../../pages/dashboard/widget-catalog';

@Component({
  selector: 'app-widget-picker',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './widget-picker.html',
  styleUrl: './widget-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetPicker {
  private readonly activeModal = inject(NgbActiveModal);

  readonly catalogEntries: WidgetCatalogMeta[] = Object.values(WIDGET_CATALOG);

  choose(widgetTypeId: WidgetTypeId): void {
    this.activeModal.close(widgetTypeId);
  }

  cancel(): void {
    this.activeModal.dismiss();
  }
}
