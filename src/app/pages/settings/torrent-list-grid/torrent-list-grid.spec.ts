// src/app/pages/settings/torrent-list-grid/torrent-list-grid.spec.ts
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TorrentListGridSettingsService } from '../../../services/torrent-list-grid.settings.service';
import { SettingsStateService } from '../settings-state.service';
import { TorrentListGrid } from './torrent-list-grid';

const DEFAULT_SETTINGS = {
  columnState: [],
  pagination: true,
  animateRows: true,
  rowDoubleClickAction: 'DETAILS' as const,
  floatingFilters: false,
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
        // UiFormatService and TranslateService resolve from global providers
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
});
