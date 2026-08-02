import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DEFAULT_TORRENT_LIST_GRID_SETTINGS } from '../../../models/torrent-list-grid.model';
import { TorrentListGridSettingsService } from '../../../services/torrent-list-grid.settings.service';
import { SettingsStateService } from '../settings-state.service';
import { TorrentListGrid } from './torrent-list-grid';

const DEFAULT_SETTINGS = {
  columnState: [],
  pagination: true,
  animateRows: true,
  rowDoubleClickAction: 'DETAILS' as const,
  pausePollingOnModal: false,
};

describe('TorrentListGrid', () => {
  let component: TorrentListGrid;
  let fixture: ComponentFixture<TorrentListGrid>;

  let stateServiceMock: {
    registerSave: ReturnType<typeof vi.fn>;
    markDirty: ReturnType<typeof vi.fn>;
  };
  let gridSettingsMock: {
    asObservable: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    stateServiceMock = { registerSave: vi.fn(), markDirty: vi.fn() };
    gridSettingsMock = {
      asObservable: vi.fn().mockReturnValue(of(DEFAULT_SETTINGS)),
      save: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [TorrentListGrid],
      providers: [
        { provide: SettingsStateService, useValue: stateServiceMock },
        { provide: TorrentListGridSettingsService, useValue: gridSettingsMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TorrentListGrid);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialise pausePollingOnModal form control to false from settings', () => {
    expect(component.torrentListGridForm.get('pausePollingOnModal')?.value).toBe(false);
  });

  describe('drop', () => {
    it('should reorder orderedColumns when an item is moved', () => {
      component.orderedColumns.set([
        { value: 'name', label: 'Name' },
        { value: 'size', label: 'Size' },
        { value: 'progress', label: 'Progress' },
      ]);
      component.drop({ previousIndex: 0, currentIndex: 2 } as any);
      const ids = component.orderedColumns().map((c) => c.value);
      expect(ids[0]).toBe('size');
      expect(ids[1]).toBe('progress');
      expect(ids[2]).toBe('name');
    });

    it('should mark torrent-list-grid as dirty after a drop', () => {
      component.orderedColumns.set([
        { value: 'name', label: 'Name' },
        { value: 'size', label: 'Size' },
      ]);
      component.drop({ previousIndex: 0, currentIndex: 1 } as any);
      expect(stateServiceMock.markDirty).toHaveBeenCalledWith('torrent-list-grid', true);
    });
  });

  describe('moveUp', () => {
    it('should swap the item with its predecessor', () => {
      component.orderedColumns.set([
        { value: 'name', label: 'Name' },
        { value: 'size', label: 'Size' },
        { value: 'progress', label: 'Progress' },
      ]);
      component.moveUp(1);
      const ids = component.orderedColumns().map((c) => c.value);
      expect(ids).toEqual(['size', 'name', 'progress']);
    });

    it('should be a no-op at the first index', () => {
      component.orderedColumns.set([
        { value: 'name', label: 'Name' },
        { value: 'size', label: 'Size' },
      ]);
      component.moveUp(0);
      const ids = component.orderedColumns().map((c) => c.value);
      expect(ids).toEqual(['name', 'size']);
    });

    it('should be a no-op for an out-of-range index', () => {
      component.orderedColumns.set([
        { value: 'name', label: 'Name' },
        { value: 'size', label: 'Size' },
      ]);
      component.moveUp(5);
      const ids = component.orderedColumns().map((c) => c.value);
      expect(ids).toEqual(['name', 'size']);
      expect(stateServiceMock.markDirty).not.toHaveBeenCalled();
    });

    it('should mark torrent-list-grid as dirty', () => {
      component.orderedColumns.set([
        { value: 'name', label: 'Name' },
        { value: 'size', label: 'Size' },
      ]);
      component.moveUp(1);
      expect(stateServiceMock.markDirty).toHaveBeenCalledWith('torrent-list-grid', true);
    });
  });

  describe('moveDown', () => {
    it('should swap the item with its successor', () => {
      component.orderedColumns.set([
        { value: 'name', label: 'Name' },
        { value: 'size', label: 'Size' },
        { value: 'progress', label: 'Progress' },
      ]);
      component.moveDown(0);
      const ids = component.orderedColumns().map((c) => c.value);
      expect(ids).toEqual(['size', 'name', 'progress']);
    });

    it('should be a no-op at the last index', () => {
      component.orderedColumns.set([
        { value: 'name', label: 'Name' },
        { value: 'size', label: 'Size' },
      ]);
      component.moveDown(1);
      const ids = component.orderedColumns().map((c) => c.value);
      expect(ids).toEqual(['name', 'size']);
    });

    it('should mark torrent-list-grid as dirty', () => {
      component.orderedColumns.set([
        { value: 'name', label: 'Name' },
        { value: 'size', label: 'Size' },
      ]);
      component.moveDown(0);
      expect(stateServiceMock.markDirty).toHaveBeenCalledWith('torrent-list-grid', true);
    });
  });

  describe('moveToTop', () => {
    it('should move the item to the front', () => {
      component.orderedColumns.set([
        { value: 'name', label: 'Name' },
        { value: 'size', label: 'Size' },
        { value: 'progress', label: 'Progress' },
      ]);
      component.moveToTop(2);
      const ids = component.orderedColumns().map((c) => c.value);
      expect(ids).toEqual(['progress', 'name', 'size']);
    });

    it('should be a no-op at the first index', () => {
      component.orderedColumns.set([
        { value: 'name', label: 'Name' },
        { value: 'size', label: 'Size' },
      ]);
      component.moveToTop(0);
      const ids = component.orderedColumns().map((c) => c.value);
      expect(ids).toEqual(['name', 'size']);
    });

    it('should be a no-op for an out-of-range index', () => {
      component.orderedColumns.set([
        { value: 'name', label: 'Name' },
        { value: 'size', label: 'Size' },
      ]);
      component.moveToTop(5);
      const ids = component.orderedColumns().map((c) => c.value);
      expect(ids).toEqual(['name', 'size']);
      expect(stateServiceMock.markDirty).not.toHaveBeenCalled();
    });
  });

  describe('moveToBottom', () => {
    it('should move the item to the end', () => {
      component.orderedColumns.set([
        { value: 'name', label: 'Name' },
        { value: 'size', label: 'Size' },
        { value: 'progress', label: 'Progress' },
      ]);
      component.moveToBottom(0);
      const ids = component.orderedColumns().map((c) => c.value);
      expect(ids).toEqual(['size', 'progress', 'name']);
    });

    it('should be a no-op at the last index', () => {
      component.orderedColumns.set([
        { value: 'name', label: 'Name' },
        { value: 'size', label: 'Size' },
      ]);
      component.moveToBottom(1);
      const ids = component.orderedColumns().map((c) => c.value);
      expect(ids).toEqual(['name', 'size']);
    });
  });

  describe('reset', () => {
    it('should restore the default visible columns and their order', () => {
      component.orderedColumns.set([
        { value: 'size', label: 'Size' },
        { value: 'name', label: 'Name' },
      ]);
      component.reset();
      const ids = component.orderedColumns().map((c) => c.value);
      expect(ids).toEqual(DEFAULT_TORRENT_LIST_GRID_SETTINGS.columnState);
    });

    it('should sync the columns form control to the default ids', () => {
      component.reset();
      expect(component.torrentListGridForm.get('columns')?.value).toEqual(
        DEFAULT_TORRENT_LIST_GRID_SETTINGS.columnState,
      );
    });

    it('should mark torrent-list-grid as dirty', () => {
      component.reset();
      expect(stateServiceMock.markDirty).toHaveBeenCalledWith('torrent-list-grid', true);
    });
  });

  describe('remove', () => {
    it('should drop the column id from the columns form control', () => {
      component.torrentListGridForm.patchValue({ columns: ['name', 'size', 'progress'] });
      component.remove('size');
      expect(component.torrentListGridForm.get('columns')?.value).toEqual(['name', 'progress']);
    });

    it('should remove the column from orderedColumns via the existing picker sync', () => {
      component.torrentListGridForm.patchValue({ columns: ['name', 'size'] });
      component.remove('size');
      const ids = component.orderedColumns().map((c) => c.value);
      expect(ids).toEqual(['name']);
    });

    it('should mark torrent-list-grid as dirty via the columns control valueChanges', () => {
      component.torrentListGridForm.patchValue({ columns: ['name', 'size'] });
      component.remove('size');
      expect(stateServiceMock.markDirty).toHaveBeenCalledWith('torrent-list-grid', true);
    });
  });
});
