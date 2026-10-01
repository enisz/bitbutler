import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { GridContextMenuService } from '../../pages/main/grid/context-menu/grid-context-menu.service';
import { CommandBusService } from '../../services/command-bus.service';
import { ConfirmService } from '../../services/confirm.service';
import { ContextMenuService } from '../../services/context-menu.service';
import { ManageTagsGridSettingsService } from '../../services/manage-tags-grid.settings.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ThemeService } from '../../services/theme.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { mockTranslateService } from '../../test-utils/translate.mock';
import { ManageTags } from './manage-tags';

describe('ManageTags', () => {
  let component: ManageTags;
  let fixture: ComponentFixture<ManageTags>;
  let serverStoreService: { currentServerId: ReturnType<typeof signal<string | null>> };
  let torrentStoreService: { torrentsArray: ReturnType<typeof signal<any[]>> };
  let manageTagsGridSettingsService: {
    load: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let activeModal: { dismiss: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
  let modalService: { open: ReturnType<typeof vi.fn> };
  let commandBusService: { emit: ReturnType<typeof vi.fn> };
  let confirmService: { confirm: ReturnType<typeof vi.fn> };
  let qbService: {
    torrents: { tags: ReturnType<typeof vi.fn>; deleteTags: ReturnType<typeof vi.fn> };
  };
  let contextMenuService: { open: ReturnType<typeof vi.fn> };
  let gridContextMenuService: { buildHeaderMenu: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    serverStoreService = { currentServerId: signal('srv-1') };
    torrentStoreService = {
      torrentsArray: signal([
        { tags: 'linux,ubuntu' } as never,
        { tags: 'linux' } as never,
        { tags: '' } as never,
      ]),
    };
    manageTagsGridSettingsService = {
      load: vi.fn().mockResolvedValue({ columnState: [], filterModel: null }),
      save: vi.fn().mockResolvedValue(undefined),
    };
    activeModal = { dismiss: vi.fn(), close: vi.fn() };
    modalService = { open: vi.fn() };
    commandBusService = { emit: vi.fn() };
    confirmService = { confirm: vi.fn().mockResolvedValue(true) };
    qbService = {
      torrents: {
        tags: vi.fn().mockResolvedValue(['linux', 'ubuntu']),
        deleteTags: vi.fn().mockResolvedValue(undefined),
      },
    };
    contextMenuService = { open: vi.fn() };
    gridContextMenuService = { buildHeaderMenu: vi.fn().mockReturnValue([]) };

    await TestBed.configureTestingModule({
      imports: [ManageTags],
      providers: [
        { provide: ServerStoreService, useValue: serverStoreService },
        { provide: TorrentStoreService, useValue: torrentStoreService },
        { provide: ManageTagsGridSettingsService, useValue: manageTagsGridSettingsService },
        { provide: ThemeService, useValue: { effectiveMode: signal('light') } },
        { provide: TranslateService, useFactory: mockTranslateService },
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: NgbModal, useValue: modalService },
        { provide: CommandBusService, useValue: commandBusService },
        { provide: ConfirmService, useValue: confirmService },
        { provide: QbService, useValue: qbService },
        { provide: ContextMenuService, useValue: contextMenuService },
        { provide: GridContextMenuService, useValue: gridContextMenuService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ManageTags);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads tag names sorted alphabetically from the server on init', () => {
    expect(qbService.torrents.tags).toHaveBeenCalledWith('srv-1');
    expect(component.tagNames()).toEqual(['linux', 'ubuntu']);
  });

  describe('rows', () => {
    it('computes usage count per tag from torrentStoreService, matching full tag membership only', () => {
      torrentStoreService.torrentsArray.set([
        { tags: 'linux,ubuntu' } as never,
        { tags: 'linux' } as never,
        { tags: '' } as never,
      ]);
      component.tagNames.set(['linux', 'ubuntu', 'unused', 'lin']);

      const rows = component.rows();

      expect(rows.find((r) => r.name === 'linux')?.usageCount).toBe(2);
      expect(rows.find((r) => r.name === 'ubuntu')?.usageCount).toBe(1);
      expect(rows.find((r) => r.name === 'unused')?.usageCount).toBe(0);
      // a tag named "lin" must not substring-match a torrent tagged "linux"
      expect(rows.find((r) => r.name === 'lin')?.usageCount).toBe(0);
    });

    it('renders with zero tags without throwing, and disables Delete', () => {
      torrentStoreService.torrentsArray.set([]);
      component.tagNames.set([]);

      expect(() => component.rows()).not.toThrow();
      expect(component.rows()).toEqual([]);
      expect(component.canDelete()).toBe(false);
    });
  });

  describe('canDelete', () => {
    it('is true only when at least one row is selected', () => {
      component.selectedTags.set([]);
      expect(component.canDelete()).toBe(false);

      component.selectedTags.set([{ name: 'linux', usageCount: 0 }]);
      expect(component.canDelete()).toBe(true);
    });
  });

  describe('column state persistence', () => {
    it('flushes a pending debounced column-state save immediately on destroy', () => {
      const api = {
        getColumnState: () => [{ colId: 'name', hide: false }],
        getFilterModel: () => null,
      } as never;
      component.onGridReady({ api } as never);
      component.onColumnChanged(); // queues a debounced save; the 500ms timer has not fired yet

      component.ngOnDestroy();

      expect(manageTagsGridSettingsService.save).toHaveBeenCalledWith({
        columnState: [{ colId: 'name', hide: false }],
        filterModel: null,
      });
    });

    it('does nothing on destroy when no column-state change is pending', () => {
      component.ngOnDestroy();
      expect(manageTagsGridSettingsService.save).not.toHaveBeenCalled();
    });
  });

  describe('actions', () => {
    it('refreshes tag names after creating new tags via TagEditor', async () => {
      modalService.open.mockReturnValue({ result: Promise.resolve(undefined) } as never);
      qbService.torrents.tags.mockResolvedValue(['linux', 'ubuntu', 'newtag']);

      await component.openNew();

      expect(component.tagNames()).toEqual(['linux', 'newtag', 'ubuntu']);
    });

    it('does not refetch tags when TagEditor is dismissed', async () => {
      modalService.open.mockReturnValue({ result: Promise.reject('dismissed') } as never);
      qbService.torrents.tags.mockClear();

      await component.openNew();

      expect(qbService.torrents.tags).not.toHaveBeenCalled();
    });

    it('deletes all selected tags in one batched call after confirmation, aggregating the usage-count message', async () => {
      confirmService.confirm.mockResolvedValue(true);
      qbService.torrents.deleteTags.mockResolvedValue(undefined);
      component.selectedTags.set([
        { name: 'linux', usageCount: 2 },
        { name: 'ubuntu', usageCount: 1 },
      ]);

      await component.deleteSelected();

      expect(qbService.torrents.deleteTags).toHaveBeenCalledWith('srv-1', ['linux', 'ubuntu']);
      expect(commandBusService.emit).toHaveBeenCalledWith({
        type: 'TAG_DELETED',
        names: ['linux', 'ubuntu'],
      });
      expect(confirmService.confirm).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ data: expect.objectContaining({ count: 3 }) }),
        expect.any(String),
        undefined,
        undefined,
        faTrashCan,
      );
      expect(component.tagNames()).not.toContain('linux');
      expect(component.tagNames()).not.toContain('ubuntu');
    });

    it('does not delete when confirmation is declined', async () => {
      confirmService.confirm.mockResolvedValue(false);
      component.selectedTags.set([{ name: 'linux', usageCount: 2 }]);

      await component.deleteSelected();

      expect(qbService.torrents.deleteTags).not.toHaveBeenCalled();
    });

    it('does nothing when deleteSelected is called with no selection', async () => {
      component.selectedTags.set([]);

      await component.deleteSelected();

      expect(confirmService.confirm).not.toHaveBeenCalled();
      expect(qbService.torrents.deleteTags).not.toHaveBeenCalled();
    });

    it('opens a single-tag delete confirmation from the row context menu', async () => {
      confirmService.confirm.mockResolvedValue(true);
      contextMenuService.open.mockClear();

      component['onCellContextMenu']({ data: { name: 'linux', usageCount: 2 } } as never);

      const [{ items }] = contextMenuService.open.mock.calls.at(-1) as [
        { items: { label: string; action: () => void }[] },
      ];
      expect(items).toHaveLength(1);
      expect(items[0].label).toBe('general.button.delete');

      items[0].action();
      await Promise.resolve();
      await Promise.resolve();

      expect(qbService.torrents.deleteTags).toHaveBeenCalledWith('srv-1', ['linux']);
    });

    it('builds the header context menu via GridContextMenuService', () => {
      component['onColumnHeaderContextMenu']({ column: {} } as never);
      expect(gridContextMenuService.buildHeaderMenu).toHaveBeenCalled();
      expect(contextMenuService.open).toHaveBeenCalledWith({ items: [] });
    });
  });
});
