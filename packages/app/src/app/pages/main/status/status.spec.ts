import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommandBusService } from '../../../services/command-bus.service';
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
    categoriesWithCounts: ReturnType<
      typeof signal<{ key: string; label: string; count: number }[]>
    >;
    tagsWithCounts: ReturnType<typeof signal<{ key: string; label: string; count: number }[]>>;
  };
  let commandBusMock: { emit: ReturnType<typeof vi.fn> };

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
      categoriesWithCounts: signal([]),
      tagsWithCounts: signal([]),
    };
    commandBusMock = { emit: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Status],
      providers: [
        { provide: FilterService, useValue: filterMock },
        { provide: TorrentStoreService, useValue: torrentStoreMock },
        { provide: CommandBusService, useValue: commandBusMock },
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

    it('should add the downloading group states when not yet active', () => {
      filterMock.external.set({ ...GRID_FILTER_INITIAL.external, states: new Set() });
      component.setGroup('downloading');
      expect(filterMock.setStates).toHaveBeenCalledWith(
        new Set(['downloading', 'forcedDL', 'queuedDL', 'metaDL', 'stalledDL']),
      );
    });

    it('should preserve a previously selected group when adding a second one', () => {
      filterMock.external.set({
        ...GRID_FILTER_INITIAL.external,
        states: new Set(['pausedDL', 'pausedUP', 'stoppedDL', 'stoppedUP']),
      });
      component.setGroup('downloading');
      expect(filterMock.setStates).toHaveBeenCalledWith(
        new Set([
          'pausedDL',
          'pausedUP',
          'stoppedDL',
          'stoppedUP',
          'downloading',
          'forcedDL',
          'queuedDL',
          'metaDL',
          'stalledDL',
        ]),
      );
    });

    it('should remove the stopped group states when already fully active', () => {
      filterMock.external.set({
        ...GRID_FILTER_INITIAL.external,
        states: new Set(['pausedDL', 'pausedUP', 'stoppedDL', 'stoppedUP']),
      });
      component.setGroup('stopped');
      expect(filterMock.setStates).toHaveBeenCalledWith(new Set());
    });

    it('should not add or remove anything for an unknown key', () => {
      filterMock.external.set({
        ...GRID_FILTER_INITIAL.external,
        states: new Set(['downloading']),
      });
      component.setGroup('nonexistent');
      expect(filterMock.setStates).not.toHaveBeenCalled();
    });
  });

  describe('setTrackerGroup', () => {
    it('should call clearTrackers when key is "all"', () => {
      component.setTrackerGroup('all');
      expect(filterMock.clearTrackers).toHaveBeenCalled();
    });

    it('should add the key to the current set when not yet selected', () => {
      filterMock.external.set({
        ...GRID_FILTER_INITIAL.external,
        trackers: new Set(['tracker.a.com']),
      });
      component.setTrackerGroup('tracker.b.com');
      expect(filterMock.setTrackers).toHaveBeenCalledWith(
        new Set(['tracker.a.com', 'tracker.b.com']),
      );
    });

    it('should remove the key from the current set when already selected', () => {
      filterMock.external.set({
        ...GRID_FILTER_INITIAL.external,
        trackers: new Set(['tracker.a.com', 'tracker.b.com']),
      });
      component.setTrackerGroup('tracker.a.com');
      expect(filterMock.setTrackers).toHaveBeenCalledWith(new Set(['tracker.b.com']));
    });
  });

  describe('setSavePathGroup', () => {
    it('should call clearSavePaths when key is "all"', () => {
      component.setSavePathGroup('all');
      expect(filterMock.clearSavePaths).toHaveBeenCalled();
    });

    it('should add the key to the current set when not yet selected', () => {
      filterMock.external.set({
        ...GRID_FILTER_INITIAL.external,
        savePaths: new Set(['/downloads']),
      });
      component.setSavePathGroup('/media');
      expect(filterMock.setSavePaths).toHaveBeenCalledWith(new Set(['/downloads', '/media']));
    });

    it('should remove the key from the current set when already selected', () => {
      filterMock.external.set({
        ...GRID_FILTER_INITIAL.external,
        savePaths: new Set(['/downloads', '/media']),
      });
      component.setSavePathGroup('/downloads');
      expect(filterMock.setSavePaths).toHaveBeenCalledWith(new Set(['/media']));
    });
  });

  describe('setCategoryGroup', () => {
    it('should call clearCategories when key is "all"', () => {
      component.setCategoryGroup('all');
      expect(filterMock.clearCategories).toHaveBeenCalled();
    });

    it('should add the key to the current set when not yet selected', () => {
      filterMock.external.set({
        ...GRID_FILTER_INITIAL.external,
        categories: new Set(['Movies']),
      });
      component.setCategoryGroup('TV');
      expect(filterMock.setCategories).toHaveBeenCalledWith(new Set(['Movies', 'TV']));
    });

    it('should remove the key from the current set when already selected', () => {
      filterMock.external.set({
        ...GRID_FILTER_INITIAL.external,
        categories: new Set(['Movies', 'TV']),
      });
      component.setCategoryGroup('Movies');
      expect(filterMock.setCategories).toHaveBeenCalledWith(new Set(['TV']));
    });
  });

  describe('setTagGroup', () => {
    it('should call clearTags when key is "all"', () => {
      component.setTagGroup('all');
      expect(filterMock.clearTags).toHaveBeenCalled();
    });

    it('should add the key to the current set when not yet selected', () => {
      filterMock.external.set({ ...GRID_FILTER_INITIAL.external, tags: new Set(['hd']) });
      component.setTagGroup('4k');
      expect(filterMock.setTags).toHaveBeenCalledWith(new Set(['hd', '4k']));
    });

    it('should remove the key from the current set when already selected', () => {
      filterMock.external.set({
        ...GRID_FILTER_INITIAL.external,
        tags: new Set(['hd', '4k']),
      });
      component.setTagGroup('hd');
      expect(filterMock.setTags).toHaveBeenCalledWith(new Set(['4k']));
    });
  });

  describe('clearAll', () => {
    it('should call filterService.resetAll', () => {
      component.clearAll();
      expect(filterMock.resetAll).toHaveBeenCalled();
    });
  });

  describe('activeStatusKeys', () => {
    it('should return an empty set when no states filter is active', () => {
      filterMock.external.set({ ...GRID_FILTER_INITIAL.external, states: new Set() });
      expect(component.activeStatusKeys()).toEqual(new Set());
    });

    it('should include "stopped" when the stopped states are fully active', () => {
      filterMock.external.set({
        ...GRID_FILTER_INITIAL.external,
        states: new Set(['pausedDL', 'pausedUP', 'stoppedDL', 'stoppedUP']),
      });
      expect(component.activeStatusKeys()).toEqual(new Set(['stopped']));
    });

    it('should include both keys when the union of two groups is active', () => {
      filterMock.external.set({
        ...GRID_FILTER_INITIAL.external,
        states: new Set([
          'downloading',
          'forcedDL',
          'queuedDL',
          'metaDL',
          'stalledDL',
          'pausedDL',
          'pausedUP',
          'stoppedDL',
          'stoppedUP',
        ]),
      });
      expect(component.activeStatusKeys()).toEqual(new Set(['downloading', 'stopped']));
    });

    it('should return an empty set for an unrecognised/partial combination of states', () => {
      filterMock.external.set({
        ...GRID_FILTER_INITIAL.external,
        states: new Set(['downloading', 'uploading']),
      });
      expect(component.activeStatusKeys()).toEqual(new Set());
    });
  });

  describe('categoriesAction', () => {
    it('should emit UI_MANAGE_CATEGORIES when invoked', () => {
      component.categoriesAction().action();
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'UI_MANAGE_CATEGORIES' });
    });
  });

  describe('tagsAction', () => {
    it('should emit UI_MANAGE_TAGS when invoked', () => {
      component.tagsAction().action();
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'UI_MANAGE_TAGS' });
    });
  });

  describe('statusItems variant', () => {
    it('should not assign a variant to any status item', () => {
      for (const item of component.statusItems()) {
        expect(item.variant).toBeUndefined();
      }
    });
  });
});
