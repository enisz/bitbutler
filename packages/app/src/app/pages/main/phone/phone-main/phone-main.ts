import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faBars,
  faCheck,
  faGear,
  faMagnifyingGlass,
  faPlus,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { TranslatePipe } from '@ngx-translate/core';
import { BbLogo } from '../../../../components/bb-logo/bb-logo';
import { CommandBusService } from '../../../../services/command-bus.service';
import { FilterService } from '../../../../services/filter.service';
import { PlatformService } from '../../../../services/platform.service';
import { SelectionStoreService } from '../../../../services/selection-store.service';
import { ServerStoreService } from '../../../../services/server-store.service';
import { Status } from '../../status/status';
import { PhoneActionBar } from '../phone-action-bar/phone-action-bar';
import { PhoneListStateService } from '../phone-list-state.service';
import { TorrentCardList } from '../torrent-card-list/torrent-card-list';

@Component({
  selector: 'app-phone-main',
  imports: [FontAwesomeModule, TranslatePipe, BbLogo, Status, TorrentCardList, PhoneActionBar],
  templateUrl: './phone-main.html',
  styleUrl: './phone-main.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhoneMain implements OnDestroy {
  private readonly filterService = inject(FilterService);
  private readonly selectionStore = inject(SelectionStoreService);
  private readonly commandBus = inject(CommandBusService);
  private readonly serverStore = inject(ServerStoreService);
  private readonly listState = inject(PhoneListStateService);
  private readonly router = inject(Router);
  private readonly platform = inject(PlatformService);

  public readonly icons = {
    faBars,
    faCheck,
    faGear,
    faMagnifyingGlass,
    faPlus,
    faXmark,
  };

  public readonly search = computed(() => this.filterService.external().search);
  public readonly serverName = computed(() => this.serverStore.currentServer()?.name ?? '');

  public readonly selectionMode = computed(() => this.selectionStore.selected().length > 0);
  public readonly selectedCount = computed(() => this.selectionStore.selected().length);

  public readonly drawerOpen = signal(false);

  public onSearch(value: string): void {
    this.filterService.setSearch(value);
  }

  public openSettings(): void {
    void this.router.navigate([this.platform.settingsPath]);
  }

  public add(): void {
    this.commandBus.emit({ type: 'UI_ADD_TORRENT' });
  }

  public selectAll(): void {
    this.selectionStore.set(this.listState.items());
  }

  // The desktop grid starts empty when the window grows back, so a leftover selection would
  // make toolbar and keyboard actions hit torrents nobody can see as selected.
  public ngOnDestroy(): void {
    this.selectionStore.clear();
  }

  public clearSelection(): void {
    this.selectionStore.clear();
  }
}
