import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FilterService, GRID_FILTER_INITIAL } from '../../../services/filter.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { Status } from './status';

describe('Status', () => {
  let component: Status;
  let fixture: ComponentFixture<Status>;

  let filterMock: {
    external: ReturnType<typeof signal<typeof GRID_FILTER_INITIAL.external>>;
    clearStates: ReturnType<typeof vi.fn>;
    setStates: ReturnType<typeof vi.fn>;
    clearTrackers: ReturnType<typeof vi.fn>;
    setTrackers: ReturnType<typeof vi.fn>;
    clearSavePaths: ReturnType<typeof vi.fn>;
    setSavePaths: ReturnType<typeof vi.fn>;
    clearCategories: ReturnType<typeof vi.fn>;
    setCategories: ReturnType<typeof vi.fn>;
    clearTags: ReturnType<typeof vi.fn>;
    setTags: ReturnType<typeof vi.fn>;
    resetAll: ReturnType<typeof vi.fn>;
  };
  let torrentStoreMock: {
    totalCount: ReturnType<typeof signal<number>>;
    countsByState: ReturnType<typeof signal<Record<string, number>>>;
    torrentsArray: ReturnType<typeof signal<any[]>>;
    categoriesMap: ReturnType<typeof signal<Map<string, any>>>;
    tagsSet: ReturnType<typeof signal<Set<string>>>;
  };

  beforeEach(async () => {
    filterMock = {
      external: signal({ ...GRID_FILTER_INITIAL.external }),
      clearStates: vi.fn(),
      setStates: vi.fn(),
      clearTrackers: vi.fn(),
      setTrackers: vi.fn(),
      clearSavePaths: vi.fn(),
      setSavePaths: vi.fn(),
      clearCategories: vi.fn(),
      setCategories: vi.fn(),
      clearTags: vi.fn(),
      setTags: vi.fn(),
      resetAll: vi.fn(),
    };
    torrentStoreMock = {
      totalCount: signal(0),
      countsByState: signal({}),
      torrentsArray: signal([]),
      categoriesMap: signal(new Map()),
      tagsSet: signal(new Set()),
    };

    await TestBed.configureTestingModule({
      imports: [Status],
      providers: [
        { provide: FilterService, useValue: filterMock },
        { provide: TorrentStoreService, useValue: torrentStoreMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(Status);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('setGroup', () => {
    it('should call filterService.clearStates when key is "all"', () => {
      component.setGroup('all');
      expect(filterMock.clearStates).toHaveBeenCalled();
    });

    it('should call filterService.setStates with the downloading group', () => {
      component.setGroup('downloading');
      expect(filterMock.setStates).toHaveBeenCalledWith(
        expect.arrayContaining(['downloading', 'forcedDL', 'stalledDL']),
      );
    });

    it('should call filterService.setStates with the stopped group', () => {
      component.setGroup('stopped');
      expect(filterMock.setStates).toHaveBeenCalledWith(
        expect.arrayContaining(['pausedDL', 'pausedUP', 'stoppedDL', 'stoppedUP']),
      );
    });

    it('should call filterService.setStates with an empty array for unknown keys', () => {
      component.setGroup('nonexistent');
      expect(filterMock.setStates).toHaveBeenCalledWith([]);
    });
  });

  describe('setTrackerGroup', () => {
    it('should call clearTrackers when key is "all"', () => {
      component.setTrackerGroup('all');
      expect(filterMock.clearTrackers).toHaveBeenCalled();
    });

    it('should call setTrackers with the key when not "all"', () => {
      component.setTrackerGroup('tracker.example.com');
      expect(filterMock.setTrackers).toHaveBeenCalledWith(['tracker.example.com']);
    });
  });

  describe('setSavePathGroup', () => {
    it('should call clearSavePaths when key is "all"', () => {
      component.setSavePathGroup('all');
      expect(filterMock.clearSavePaths).toHaveBeenCalled();
    });

    it('should call setSavePaths with the key when not "all"', () => {
      component.setSavePathGroup('/downloads');
      expect(filterMock.setSavePaths).toHaveBeenCalledWith(['/downloads']);
    });
  });

  describe('setCategoryGroup', () => {
    it('should call clearCategories when key is "all"', () => {
      component.setCategoryGroup('all');
      expect(filterMock.clearCategories).toHaveBeenCalled();
    });

    it('should call setCategories with the key when not "all"', () => {
      component.setCategoryGroup('Movies');
      expect(filterMock.setCategories).toHaveBeenCalledWith(['Movies']);
    });
  });

  describe('setTagGroup', () => {
    it('should call clearTags when key is "all"', () => {
      component.setTagGroup('all');
      expect(filterMock.clearTags).toHaveBeenCalled();
    });

    it('should call setTags with the key when not "all"', () => {
      component.setTagGroup('hd');
      expect(filterMock.setTags).toHaveBeenCalledWith(['hd']);
    });
  });

  describe('clearAll', () => {
    it('should call filterService.resetAll', () => {
      component.clearAll();
      expect(filterMock.resetAll).toHaveBeenCalled();
    });
  });

  describe('activeKey', () => {
    it('should return "all" when no states filter is active', () => {
      filterMock.external.set({ ...GRID_FILTER_INITIAL.external, states: new Set() });
      expect(component.activeKey()).toBe('all');
    });

    it('should return "stopped" when the stopped states are active', () => {
      filterMock.external.set({
        ...GRID_FILTER_INITIAL.external,
        states: new Set(['pausedDL', 'pausedUP', 'stoppedDL', 'stoppedUP']),
      });
      expect(component.activeKey()).toBe('stopped');
    });

    it('should return "all" for an unrecognised combination of states', () => {
      filterMock.external.set({
        ...GRID_FILTER_INITIAL.external,
        states: new Set(['downloading', 'uploading']),
      });
      expect(component.activeKey()).toBe('all');
    });
  });
});
