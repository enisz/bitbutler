import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgbActiveOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { WidgetTypeId } from '../../models/dashboard.model';
import { WIDGET_CATALOG, WidgetCatalogMeta } from '../../pages/dashboard/widget-catalog';

@Component({
  selector: 'app-widget-picker',
  standalone: true,
  imports: [TranslatePipe, FontAwesomeModule],
  templateUrl: './widget-picker.html',
  styleUrl: './widget-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetPicker {
  private readonly activeOffcanvas = inject(NgbActiveOffcanvas);

  readonly catalogEntries: WidgetCatalogMeta[] = Object.values(WIDGET_CATALOG);

  choose(widgetTypeId: WidgetTypeId): void {
    this.activeOffcanvas.close(widgetTypeId);
  }

  cancel(): void {
    this.activeOffcanvas.dismiss();
  }
}
