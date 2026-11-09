import { TestBed } from '@angular/core/testing';
import { Torrent } from '../../../../models/torrent.model';
import { CommandBusService } from '../../../../services/command-bus.service';
import { SelectionStoreService } from '../../../../services/selection-store.service';
import { ContextMenuEntry } from '../../grid/context-menu/context-menu.types';
import { GridContextMenuService } from '../../grid/context-menu/grid-context-menu.service';
import { PhoneActionBar } from './phone-action-bar';

const t = (hash: string): Torrent => ({ hash, name: hash }) as Torrent;

describe('PhoneActionBar', () => {
  let selection: SelectionStoreService;
  let commandBus: CommandBusService;
  let menuFn: ReturnType<typeof vi.fn>;
  let entryAction: ReturnType<typeof vi.fn<() => void>>;

  const create = () => {
    const fixture = TestBed.createComponent(PhoneActionBar);
    fixture.detectChanges();
    return fixture;
  };

  const button = (fixture: ReturnType<typeof create>, id: string): HTMLButtonElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${id}"]`);

  beforeEach(() => {
    entryAction = vi.fn<() => void>();
    const menu: ContextMenuEntry[] = [
      { kind: 'item', id: 'control.start', label: 'start' },
      {
        kind: 'submenu',
        id: 'files',
        label: 'files',
        children: [
          { kind: 'item', id: 'files.exportFile', label: 'export' },
          { kind: 'item', id: 'files.setSavePath', label: 'setpath', action: entryAction },
        ],
      },
      {
        kind: 'item',
        id: 'maintenance.forceRecheck',
        label: 'recheck',
        action: { type: 'TORRENT_RECHECK' },
      },
    ];
    menuFn = vi.fn().mockResolvedValue(menu);

    TestBed.overrideComponent(PhoneActionBar, {
      set: {
        providers: [{ provide: GridContextMenuService, useValue: { buildTorrentMenu: menuFn } }],
      },
    });
    selection = TestBed.inject(SelectionStoreService);
    commandBus = TestBed.inject(CommandBusService);
  });

  it('is hidden when nothing is selected', () => {
    const fixture = create();
    expect(fixture.nativeElement.querySelector('[data-testid="phone-action-bar"]')).toBeNull();
  });

  it('emits resume, pause and a selection-based delete request', () => {
    selection.set([t('a'), t('b')]);
    const emit = vi.spyOn(commandBus, 'emit');
    const fixture = create();

    button(fixture, 'action-start')?.click();
    button(fixture, 'action-stop')?.click();
    button(fixture, 'action-delete')?.click();

    expect(emit).toHaveBeenNthCalledWith(1, { type: 'TORRENT_RESUME' });
    expect(emit).toHaveBeenNthCalledWith(2, { type: 'TORRENT_PAUSE' });
    expect(emit).toHaveBeenNthCalledWith(3, { type: 'UI_TORRENT_DELETE_REQUEST' });
  });

  it('builds the more list for a single selected torrent with set save path first', async () => {
    selection.set([t('a')]);
    const fixture = create();

    button(fixture, 'action-more')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(menuFn).toHaveBeenCalledWith({
      row: expect.objectContaining({ hash: 'a' }),
      selected: [expect.objectContaining({ hash: 'a' })],
      rowPinned: null,
    });
    const labels = [...fixture.nativeElement.querySelectorAll('[data-testid^="more-entry-"]')].map(
      (el: Element) => el.getAttribute('data-testid'),
    );
    expect(labels[0]).toBe('more-entry-files.setSavePath');
    expect(labels).not.toContain('more-entry-control.start');
  });

  it('builds the more list for a multi selection', async () => {
    selection.set([t('a'), t('b'), t('c')]);
    const fixture = create();

    button(fixture, 'action-more')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(menuFn.mock.calls[0][0].selected).toHaveLength(3);
    expect(
      fixture.nativeElement.querySelector('[data-testid="more-entry-files.setSavePath"]'),
    ).not.toBeNull();
  });

  it('runs a function action and closes the sheet', async () => {
    selection.set([t('a')]);
    const fixture = create();
    button(fixture, 'action-more')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-testid="more-entry-files.setSavePath"]').click();
    fixture.detectChanges();

    expect(entryAction).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('.bb-sheet')).toBeNull();
  });

  it('emits a command action through the command bus', async () => {
    selection.set([t('a')]);
    const emit = vi.spyOn(commandBus, 'emit');
    const fixture = create();
    button(fixture, 'action-more')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.nativeElement
      .querySelector('[data-testid="more-entry-maintenance.forceRecheck"]')
      .click();

    expect(emit).toHaveBeenCalledWith({ type: 'TORRENT_RECHECK' });
  });
});
