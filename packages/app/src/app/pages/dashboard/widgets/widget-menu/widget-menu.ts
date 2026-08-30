import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faEllipsisVertical, faSliders, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-widget-menu',
  standalone: true,
  imports: [NgbDropdownModule, FontAwesomeModule, TranslatePipe],
  templateUrl: './widget-menu.html',
  styleUrl: './widget-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetMenu {
  readonly configure = output<void>();
  readonly remove = output<void>();

  readonly icon = { faEllipsisVertical, faSliders, faTrashCan };
}
