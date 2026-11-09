import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import {
  DEFAULT_MOBILE_LIST_SETTINGS,
  MobileListSettings,
} from '../../../../models/mobile-list-settings.model';
import { Torrent } from '../../../../models/torrent.model';
import { CommandBusService } from '../../../../services/command-bus.service';
import { FilterService } from '../../../../services/filter.service';
import { MobileListSettingsService } from '../../../../services/mobile-list-settings.service';
import { PlatformService } from '../../../../services/platform.service';
import { SelectionStoreService } from '../../../../services/selection-store.service';
import { ServerStoreService } from '../../../../services/server-store.service';
import { TorrentStoreService } from '../../../../services/torrent-store.service';
import { PhoneMain } from './phone-main';

function makeTorrent(hash: string, state: string): Torrent {
  return {
    hash,
    name: hash,
    state,
    category: '',
    tags: '',
    tracker: '',
    save_path: '/',
    added_on: 1,
    progress: 0,
    dlspeed: 0,
    upspeed: 0,
    size: 1,
    ratio: 0,
    eta: 0,
  } as Torrent;
}

describe('PhoneMain', () => {
  let fixture: ComponentFixture<PhoneMain>;
  let component: PhoneMain;
  let filter: FilterService;
  let selection: SelectionStoreService;
  let store: TorrentStoreService;
  let commandBus: CommandBusService;
  let router: Router;
  let settings$: BehaviorSubject<MobileListSettings>;

  const q = <T extends Element = HTMLElement>(testId: string): T | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);

  beforeEach(async () => {
    settings$ = new BehaviorSubject(DEFAULT_MOBILE_LIST_SETTINGS);
    await TestBed.configureTestingModule({
      imports: [PhoneMain],
      providers: [
        {
          provide: MobileListSettingsService,
          useValue: {
            asObservable: () => settings$.asObservable(),
            load: () => Promise.resolve(settings$.value),
            save: (s: MobileListSettings) => {
              settings$.next(s);
              return Promise.resolve();
            },
          },
        },
        {
          provide: ServerStoreService,
          useValue: { currentServer: signal({ name: 'My server' }) },
        },
      ],
    })
      .overrideComponent(PhoneMain, {
        set: { imports: [TranslatePipe], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    filter = TestBed.inject(FilterService);
    selection = TestBed.inject(SelectionStoreService);
    store = TestBed.inject(TorrentStoreService);
    commandBus = TestBed.inject(CommandBusService);
    router = TestBed.inject(Router);

    store.applyMaindata({
      full_update: true,
      torrents: {
        a: makeTorrent('a', 'downloading'),
        b: makeTorrent('b', 'uploading'),
        c: makeTorrent('c', 'pausedDL'),
        d: makeTorrent('d', 'error'),
      },
    } as never);

    fixture = TestBed.createComponent(PhoneMain);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('applies typed search text to the shared filter', () => {
    const setSearch = vi.spyOn(filter, 'setSearch');
    const input = q<HTMLInputElement>('phone-search') as HTMLInputElement;
    input.value = 'ubuntu';
    input.dispatchEvent(new Event('input'));
    expect(setSearch).toHaveBeenCalledWith('ubuntu');
  });

  it('has no status chips under the search bar (states are filtered in the drawer)', () => {
    expect(fixture.nativeElement.querySelector('[data-testid^="chip-"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.bb-phone__chips')).toBeNull();
  });

  it('header has the menu, search and settings buttons only', () => {
    expect(q('phone-menu')).not.toBeNull();
    expect(q('phone-search')).not.toBeNull();
    expect(q('phone-settings')).not.toBeNull();
    expect(q('phone-sort')).toBeNull();
    expect(q('density-toggle')).toBeNull();
  });

  it('settings button navigates to /pages/mobile-settings on mobile', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    (TestBed.inject(PlatformService) as { settingsPath: string }).settingsPath =
      '/pages/mobile-settings';
    q('phone-settings')?.click();
    expect(navigate).toHaveBeenCalledWith(['/pages/mobile-settings']);
  });

  it('settings button navigates to /pages/settings on desktop platform', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    (TestBed.inject(PlatformService) as { settingsPath: string }).settingsPath = '/pages/settings';
    q('phone-settings')?.click();
    expect(navigate).toHaveBeenCalledWith(['/pages/settings']);
  });

  it('opens the drawer from the hamburger button and closes it again', () => {
    expect(q('phone-drawer')).toBeNull();
    q('phone-menu')?.click();
    fixture.detectChanges();
    expect(q('phone-drawer')).not.toBeNull();
    expect(q('phone-drawer')?.querySelector('app-status')).not.toBeNull();
    q('phone-drawer-backdrop')?.click();
    fixture.detectChanges();
    expect(q('phone-drawer')).toBeNull();
  });

  it('closes the drawer with the X button in the drawer header', () => {
    q('phone-menu')?.click();
    fixture.detectChanges();
    const close = q('phone-drawer-close');
    expect(close).not.toBeNull();
    expect(q('phone-drawer')?.querySelector('.bb-drawer__head')?.contains(close)).toBe(true);
    close?.click();
    fixture.detectChanges();
    expect(q('phone-drawer')).toBeNull();
  });

  it('shows the BitButler logo in the drawer header', () => {
    q('phone-menu')?.click();
    fixture.detectChanges();
    expect(q('phone-drawer')?.querySelector('app-bb-logo')).not.toBeNull();
  });

  it('emits UI_ADD_TORRENT from the add button', () => {
    const emit = vi.spyOn(commandBus, 'emit');
    q('phone-add')?.click();
    expect(emit).toHaveBeenCalledWith({ type: 'UI_ADD_TORRENT' });
  });

  it('shows the selection header with the count while torrents are selected', () => {
    expect(q('selection-header')).toBeNull();
    selection.setByHashes(['a', 'b']);
    fixture.detectChanges();
    expect(q('selection-header')).not.toBeNull();
    expect(component.selectedCount()).toBe(2);
    expect(q('phone-search')).toBeNull();
  });

  it('selects every listed torrent with select all', () => {
    selection.setByHashes(['a']);
    fixture.detectChanges();
    q('selection-select-all')?.click();
    expect(selection.selectedHashes().sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('clears the selection with the close button', () => {
    selection.setByHashes(['a']);
    fixture.detectChanges();
    q('selection-close')?.click();
    expect(selection.selected()).toEqual([]);
  });

  it('clears the selection when the phone shell is destroyed (e.g. the window grows back)', () => {
    selection.setByHashes(['a', 'b']);
    fixture.detectChanges();
    fixture.destroy();
    expect(selection.selected()).toEqual([]);
  });

  it('keeps filter state and selection across re-renders', () => {
    filter.setSearch('x');
    selection.setByHashes(['a']);
    fixture.detectChanges();
    const second = TestBed.createComponent(PhoneMain);
    second.detectChanges();
    expect(filter.external().search).toBe('x');
    expect(selection.selectedHashes()).toEqual(['a']);
  });
});
