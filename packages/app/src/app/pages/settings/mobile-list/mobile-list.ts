import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowDown, faArrowUp } from '@fortawesome/free-solid-svg-icons';
import { TranslatePipe } from '@ngx-translate/core';
import { BbSectionCard } from '../../../components/bb-section-card/bb-section-card';
import { BbSwitch } from '../../../components/form-controls/bb-switch/bb-switch';
import { PHONE_SORT_KEYS, PhoneSortKey } from '../../../models/mobile-list-settings.model';
import { PhoneListStateService } from '../../main/phone/phone-list-state.service';
import { SettingsTabComponent } from '../settings.interface';

/** Mobile torrent list sort and row density. Applies immediately, so it is never dirty. */
@Component({
  selector: 'app-mobile-list',
  imports: [BbSectionCard, BbSwitch, FontAwesomeModule, TranslatePipe],
  templateUrl: './mobile-list.html',
  styleUrl: './mobile-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileList implements SettingsTabComponent {
  protected readonly listState = inject(PhoneListStateService);
  protected readonly sortKeys = PHONE_SORT_KEYS;
  protected readonly icons = { faArrowUp, faArrowDown };

  protected onSort(key: PhoneSortKey): void {
    void this.listState.setSort(key);
  }

  protected onCompact(value: boolean): void {
    void this.listState.setCompact(value);
  }
}
