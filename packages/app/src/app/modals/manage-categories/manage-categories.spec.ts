import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { GridContextMenuService } from '../../pages/main/grid/context-menu/grid-context-menu.service';
import { CommandBusService } from '../../services/command-bus.service';
import { ConfirmService } from '../../services/confirm.service';
import { ContextMenuService } from '../../services/context-menu.service';
import { ManageCategoriesGridSettingsService } from '../../services/manage-categories-grid.settings.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ThemeService } from '../../services/theme.service';
import { ToastService } from '../../services/toast.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { mockTranslateService } from '../../test-utils/translate.mock';
import { ManageCategories } from './manage-categories';

describe('ManageCategories', () => {
  let component: ManageCategories;
  let fixture: ComponentFixture<ManageCategories>;
  let serverStoreService: { currentServerId: ReturnType<typeof signal<string | null>> };
  let torrentStoreService: { torrentsArray: ReturnType<typeof signal<any[]>> };
  let manageCategoriesGridSettingsService: {
    load: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let activeModal: { dismiss: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
  let modalService: { open: ReturnType<typeof vi.fn> };
  let commandBusService: { emit: ReturnType<typeof vi.fn> };
  let confirmService: { confirm: ReturnType<typeof vi.fn> };
  let qbService: {
    torrents: {
      categories: ReturnType<typeof vi.fn>;
      editCategory: ReturnType<typeof vi.fn>;
      removeCategories: ReturnType<typeof vi.fn>;
    };
  };
  let toastService: { danger: ReturnType<typeof vi.fn> };
  let contextMenuService: { open: ReturnType<typeof vi.fn> };
  let gridContextMenuService: { buildHeaderMenu: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    serverStoreService = { currentServerId: signal('srv-1') };
    torrentStoreService = {
      torrentsArray: signal([
        { category: 'movies' } as never,
        { category: 'movies' } as never,
        { category: 'tv' } as never,
      ]),
    };
    manageCategoriesGridSettingsService = {
      load: vi.fn().mockResolvedValue({ columnState: [], filterModel: null }),
      save: vi.fn().mockResolvedValue(undefined),
    };
    activeModal = { dismiss: vi.fn(), close: vi.fn() };
    modalService = { open: vi.fn() };
    commandBusService = { emit: vi.fn() };
    confirmService = { confirm: vi.fn().mockResolvedValue(true) };
    qbService = {
      torrents: {
        categories: vi.fn().mockResolvedValue({
          movies: { name: 'movies', savePath: '/data/movies' },
          tv: { name: 'tv', savePath: '/data/tv' },
        }),
        editCategory: vi.fn().mockResolvedValue(undefined),
        removeCategories: vi.fn().mockResolvedValue(undefined),
      },
    };
    toastService = { danger: vi.fn() };
    contextMenuService = { open: vi.fn() };
    gridContextMenuService = { buildHeaderMenu: vi.fn().mockReturnValue([]) };

    await TestBed.configureTestingModule({
      imports: [ManageCategories],
      providers: [
        { provide: ServerStoreService, useValue: serverStoreService },
        { provide: TorrentStoreService, useValue: torrentStoreService },
        {
          provide: ManageCategoriesGridSettingsService,
          useValue: manageCategoriesGridSettingsService,
        },
        { provide: ThemeService, useValue: { effectiveMode: signal('light') } },
        { provide: TranslateService, useFactory: mockTranslateService },
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: NgbModal, useValue: modalService },
        { provide: CommandBusService, useValue: commandBusService },
        { provide: ConfirmService, useValue: confirmService },
        { provide: QbService, useValue: qbService },
        { provide: ToastService, useValue: toastService },
        { provide: ContextMenuService, useValue: contextMenuService },
        { provide: GridContextMenuService, useValue: gridContextMenuService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ManageCategories);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads categories sorted alphabetically from the server on init', () => {
    expect(qbService.torrents.categories).toHaveBeenCalledWith('srv-1');
    expect(component.categories()).toEqual([
      { name: 'movies', savePath: '/data/movies' },
      { name: 'tv', savePath: '/data/tv' },
    ]);
  });

  describe('rows', () => {
    it('computes usage count per category from torrentStoreService', () => {
      torrentStoreService.torrentsArray.set([
        { category: 'movies' } as never,
        { category: 'movies' } as never,
        { category: 'tv' } as never,
      ]);
      component.categories.set([
        { name: 'movies', savePath: '/data/movies' },
        { name: 'tv', savePath: '/data/tv' },
      ]);

      const rows = component.rows();

      expect(rows.find((r) => r.name === 'movies')?.usageCount).toBe(2);
      expect(rows.find((r) => r.name === 'tv')?.usageCount).toBe(1);
    });

    it('exact-matches category names rather than substring matching', () => {
      torrentStoreService.torrentsArray.set([
        { category: 'movies' } as never,
        { category: 'movies-2' } as never,
      ]);
      component.categories.set([
        { name: 'movies', savePath: '/data/movies' },
        { name: 'mov', savePath: '/data/mov' },
      ]);

      const rows = component.rows();

      expect(rows.find((r) => r.name === 'movies')?.usageCount).toBe(1);
      expect(rows.find((r) => r.name === 'mov')?.usageCount).toBe(0);
    });

    it('renders with zero categories without throwing, and disables Edit/Delete', () => {
      torrentStoreService.torrentsArray.set([]);
      component.categories.set([]);

      expect(() => component.rows()).not.toThrow();
      expect(component.rows()).toEqual([]);
      expect(component.canEdit()).toBe(false);
      expect(component.canDelete()).toBe(false);
    });
  });

  describe('canEdit', () => {
    it('is true only when exactly one row is selected', () => {
      component.selectedCategories.set([]);
      expect(component.canEdit()).toBe(false);

      component.selectedCategories.set([
        { name: 'movies', savePath: '/data/movies', usageCount: 0 },
      ]);
      expect(component.canEdit()).toBe(true);

      component.selectedCategories.set([
        { name: 'movies', savePath: '/data/movies', usageCount: 0 },
        { name: 'tv', savePath: '/data/tv', usageCount: 0 },
      ]);
      expect(component.canEdit()).toBe(false);
    });
  });

  describe('canDelete', () => {
    it('is true only when at least one row is selected', () => {
      component.selectedCategories.set([]);
      expect(component.canDelete()).toBe(false);

      component.selectedCategories.set([
        { name: 'movies', savePath: '/data/movies', usageCount: 0 },
      ]);
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

      expect(manageCategoriesGridSettingsService.save).toHaveBeenCalledWith({
        columnState: [{ colId: 'name', hide: false }],
        filterModel: null,
      });
    });

    it('does nothing on destroy when no column-state change is pending', () => {
      component.ngOnDestroy();
      expect(manageCategoriesGridSettingsService.save).not.toHaveBeenCalled();
    });
  });

  describe('grid layout auto-sizing', () => {
    it('auto-sizes all columns to content then stretches them to fill the grid on first render when no column widths were stored', async () => {
      const autoSizeAllColumns = vi.fn();
      const sizeColumnsToFit = vi.fn();
      await component.onGridReady({ api: {} } as never);

      component.gridOptions.onFirstDataRendered?.({
        api: { autoSizeAllColumns, sizeColumnsToFit },
      } as never);

      expect(autoSizeAllColumns).toHaveBeenCalled();
      expect(sizeColumnsToFit).toHaveBeenCalled();
    });

    it('does not auto-size or fit when a stored column layout was applied', async () => {
      manageCategoriesGridSettingsService.load.mockResolvedValue({
        columnState: [{ colId: 'name', width: 200 }],
        filterModel: null,
      });
      const autoSizeAllColumns = vi.fn();
      const sizeColumnsToFit = vi.fn();
      await component.onGridReady({
        api: { applyColumnState: vi.fn(), setFilterModel: vi.fn() },
      } as never);

      component.gridOptions.onFirstDataRendered?.({
        api: { autoSizeAllColumns, sizeColumnsToFit },
      } as never);

      expect(autoSizeAllColumns).not.toHaveBeenCalled();
      expect(sizeColumnsToFit).not.toHaveBeenCalled();
    });
  });

  describe('startEditSelected', () => {
    it('opens CategoryEditor prefilled with the single selected row and reloads categories on success', async () => {
      modalService.open.mockReturnValue({ result: Promise.resolve(undefined) } as never);
      qbService.torrents.categories.mockClear();

      await component['startEditCategory']({ name: 'movies', savePath: '/data/movies' });

      expect(modalService.open).toHaveBeenCalled();
      expect(qbService.torrents.categories).toHaveBeenCalledWith('srv-1');
    });

    it('does nothing when no row is selected', () => {
      component.selectedCategories.set([]);

      component.startEditSelected();

      expect(modalService.open).not.toHaveBeenCalled();
    });

    it('does not reload categories when the editor is dismissed', async () => {
      modalService.open.mockReturnValue({ result: Promise.reject('dismissed') } as never);
      qbService.torrents.categories.mockClear();

      await component['startEditCategory']({ name: 'movies', savePath: '/data/movies' });

      expect(qbService.torrents.categories).not.toHaveBeenCalled();
    });
  });

  describe('actions', () => {
    it('refreshes categories after creating a new one via CategoryEditor', async () => {
      modalService.open.mockReturnValue({ result: Promise.resolve(undefined) } as never);
      qbService.torrents.categories.mockResolvedValue({
        movies: { name: 'movies', savePath: '/data/movies' },
        tv: { name: 'tv', savePath: '/data/tv' },
        software: { name: 'software', savePath: '/data/software' },
      });

      await component.openNew();

      expect(component.categories()).toEqual([
        { name: 'movies', savePath: '/data/movies' },
        { name: 'software', savePath: '/data/software' },
        { name: 'tv', savePath: '/data/tv' },
      ]);
    });

    it('does not refetch categories when CategoryEditor is dismissed', async () => {
      modalService.open.mockReturnValue({ result: Promise.reject('dismissed') } as never);
      qbService.torrents.categories.mockClear();

      await component.openNew();

      expect(qbService.torrents.categories).not.toHaveBeenCalled();
    });

    it('deletes all selected categories in one batched call after confirmation', async () => {
      confirmService.confirm.mockResolvedValue(true);
      qbService.torrents.removeCategories.mockResolvedValue(undefined);
      component.selectedCategories.set([
        { name: 'movies', savePath: '/data/movies', usageCount: 2 },
        { name: 'tv', savePath: '/data/tv', usageCount: 1 },
      ]);

      await component.deleteSelected();

      expect(qbService.torrents.removeCategories).toHaveBeenCalledWith('srv-1', ['movies', 'tv']);
      expect(commandBusService.emit).toHaveBeenCalledWith({
        type: 'CATEGORY_DELETED',
        names: ['movies', 'tv'],
      });
      expect(confirmService.confirm).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ data: expect.objectContaining({ count: 3 }) }),
        expect.any(String),
        undefined,
        undefined,
        faTrashCan,
      );
      expect(component.categories().map((c) => c.name)).not.toContain('movies');
      expect(component.categories().map((c) => c.name)).not.toContain('tv');
    });

    it('does not delete when confirmation is declined', async () => {
      confirmService.confirm.mockResolvedValue(false);
      component.selectedCategories.set([
        { name: 'movies', savePath: '/data/movies', usageCount: 2 },
      ]);

      await component.deleteSelected();

      expect(qbService.torrents.removeCategories).not.toHaveBeenCalled();
    });

    it('does nothing when deleteSelected is called with no selection', async () => {
      component.selectedCategories.set([]);

      await component.deleteSelected();

      expect(confirmService.confirm).not.toHaveBeenCalled();
      expect(qbService.torrents.removeCategories).not.toHaveBeenCalled();
    });

    it('opens a single-category edit from the row context menu', async () => {
      modalService.open.mockReturnValue({ result: Promise.resolve(undefined) } as never);
      contextMenuService.open.mockClear();

      component['onCellContextMenu']({
        data: { name: 'movies', savePath: '/data/movies', usageCount: 2 },
      } as never);

      const [{ items }] = contextMenuService.open.mock.calls.at(-1) as [
        { items: { label: string; action: () => void }[] },
      ];
      expect(items.map((i) => i.label)).toEqual(['general.button.edit', 'general.button.delete']);

      items[0].action();
      await Promise.resolve();
      await Promise.resolve();

      expect(modalService.open).toHaveBeenCalled();
    });

    it('opens a single-category delete confirmation from the row context menu', async () => {
      confirmService.confirm.mockResolvedValue(true);
      contextMenuService.open.mockClear();

      component['onCellContextMenu']({
        data: { name: 'movies', savePath: '/data/movies', usageCount: 2 },
      } as never);

      const [{ items }] = contextMenuService.open.mock.calls.at(-1) as [
        { items: { label: string; action: () => void }[] },
      ];
      items[1].action();
      await Promise.resolve();
      await Promise.resolve();

      expect(qbService.torrents.removeCategories).toHaveBeenCalledWith('srv-1', ['movies']);
    });

    it('builds the header context menu via GridContextMenuService', () => {
      component['onColumnHeaderContextMenu']({ column: {} } as never);
      expect(gridContextMenuService.buildHeaderMenu).toHaveBeenCalled();
      expect(contextMenuService.open).toHaveBeenCalledWith({ items: [] });
    });

    it('editing a different row via the context menu does not change what the footer Edit/Delete would act on (Finding 2)', async () => {
      modalService.open.mockReturnValue({ result: Promise.reject('dismissed') } as never);
      component.selectedCategories.set([{ name: 'tv', savePath: '/data/tv', usageCount: 1 }]);
      contextMenuService.open.mockClear();

      component['onCellContextMenu']({
        data: { name: 'movies', savePath: '/data/movies', usageCount: 2 },
      } as never);
      const [{ items }] = contextMenuService.open.mock.calls.at(-1) as [
        { items: { label: string; action: () => void }[] },
      ];
      items[0].action();
      await Promise.resolve();
      await Promise.resolve();

      expect(component.selectedCategories()).toEqual([
        { name: 'tv', savePath: '/data/tv', usageCount: 1 },
      ]);
    });

    it('deleting a different row via the context menu does not change what the footer Edit/Delete would act on (Finding 2)', async () => {
      confirmService.confirm.mockResolvedValue(false);
      component.selectedCategories.set([{ name: 'tv', savePath: '/data/tv', usageCount: 1 }]);
      contextMenuService.open.mockClear();

      component['onCellContextMenu']({
        data: { name: 'movies', savePath: '/data/movies', usageCount: 2 },
      } as never);
      const [{ items }] = contextMenuService.open.mock.calls.at(-1) as [
        { items: { label: string; action: () => void }[] },
      ];
      items[1].action();
      await Promise.resolve();
      await Promise.resolve();

      expect(component.selectedCategories()).toEqual([
        { name: 'tv', savePath: '/data/tv', usageCount: 1 },
      ]);
    });
  });

  describe('error handling (Finding 3)', () => {
    it('shows a danger toast when the initial categories load fails', async () => {
      qbService.torrents.categories.mockRejectedValue(new Error('network error'));

      const freshFixture = TestBed.createComponent(ManageCategories);
      freshFixture.detectChanges();
      await freshFixture.whenStable();

      expect(toastService.danger).toHaveBeenCalled();
      expect(freshFixture.componentInstance.categories()).toEqual([]);
    });

    it('shows a danger toast and does not optimistically update local state when deleting categories fails', async () => {
      confirmService.confirm.mockResolvedValue(true);
      qbService.torrents.removeCategories.mockRejectedValue(new Error('409 conflict'));
      component.selectedCategories.set([
        { name: 'movies', savePath: '/data/movies', usageCount: 2 },
      ]);

      await component.deleteSelected();

      expect(toastService.danger).toHaveBeenCalled();
      expect(component.categories().map((c) => c.name)).toContain('movies');
      expect(commandBusService.emit).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'CATEGORY_DELETED' }),
      );
    });
  });
});
