// src/app/pages/main/button-bar/button-bar.spec.ts
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommandBusService } from '../../../services/command-bus.service';
import { FilterService } from '../../../services/filter.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { ButtonBar } from './button-bar';

describe('ButtonBar', () => {
  let component: ButtonBar;
  let fixture: ComponentFixture<ButtonBar>;

  let commandBusMock: { emit: ReturnType<typeof vi.fn> };
  let filterMock: { setSearch: ReturnType<typeof vi.fn>; clearSearch: ReturnType<typeof vi.fn> };
  let selectionMock: { selected: ReturnType<typeof signal<any[]>> };
  let torrentStoreMock: { totalCount: ReturnType<typeof signal<number>> };

  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  beforeEach(async () => {
    commandBusMock = { emit: vi.fn() };
    filterMock = { setSearch: vi.fn(), clearSearch: vi.fn() };
    selectionMock = { selected: signal([]) };
    torrentStoreMock = { totalCount: signal(0) };

    await TestBed.configureTestingModule({
      imports: [ButtonBar],
      providers: [
        { provide: CommandBusService, useValue: commandBusMock },
        { provide: FilterService, useValue: filterMock },
        { provide: SelectionStoreService, useValue: selectionMock },
        { provide: TorrentStoreService, useValue: torrentStoreMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonBar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('hasSelection', () => {
    it('should be false when nothing is selected', () => {
      selectionMock.selected.set([]);
      expect(component.hasSelection()).toBe(false);
    });

    it('should be true when at least one torrent is selected', () => {
      selectionMock.selected.set([{ hash: 'a' }] as any);
      expect(component.hasSelection()).toBe(true);
    });
  });

  describe('trackBy', () => {
    it('should return a:id for action entries', () => {
      expect(component.trackBy(0, { kind: 'action', id: 'control.resume' } as any)).toBe(
        'a:control.resume',
      );
    });

    it('should return d:index for divider entries', () => {
      expect(component.trackBy(3, { kind: 'divider' } as any)).toBe('d:3');
    });
  });

  describe('clearSearchField', () => {
    it('should reset the search form control to empty', () => {
      component.searchForm.get('search')?.setValue('hello');
      component.clearSearchField();
      expect(component.searchForm.get('search')?.value).toBe('');
    });

    it('should call filterService.clearSearch', () => {
      component.clearSearchField();
      expect(filterMock.clearSearch).toHaveBeenCalled();
    });
  });

  describe('onClick', () => {
    it('should emit TORRENT_RESUME for control.resume', () => {
      component.onClick('control.resume');
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'TORRENT_RESUME' });
    });

    it('should emit TORRENT_PAUSE for control.pause', () => {
      component.onClick('control.pause');
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'TORRENT_PAUSE' });
    });

    it('should emit TORRENT_RESUME_ALL for control.resumeAll', () => {
      component.onClick('control.resumeAll');
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'TORRENT_RESUME_ALL' });
    });

    it('should emit TORRENT_PAUSE_ALL for control.pauseAll', () => {
      component.onClick('control.pauseAll');
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'TORRENT_PAUSE_ALL' });
    });

    it('should emit UI_OPEN_SETTINGS for settings.open', () => {
      component.onClick('settings.open');
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'UI_OPEN_SETTINGS' });
    });

    it('should emit UI_ADD_TORRENT for new.addTorrentFile', () => {
      component.onClick('new.addTorrentFile');
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'UI_ADD_TORRENT' });
    });

    it('should emit QUEUE_MOVE_TOP for queue.moveTop', () => {
      component.onClick('queue.moveTop');
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'QUEUE_MOVE_TOP' });
    });

    it('should emit QUEUE_MOVE_UP for queue.moveUp', () => {
      component.onClick('queue.moveUp');
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'QUEUE_MOVE_UP' });
    });

    it('should emit QUEUE_MOVE_DOWN for queue.moveDown', () => {
      component.onClick('queue.moveDown');
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'QUEUE_MOVE_DOWN' });
    });

    it('should emit QUEUE_MOVE_BOTTOM for queue.moveBottom', () => {
      component.onClick('queue.moveBottom');
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'QUEUE_MOVE_BOTTOM' });
    });

    it('should emit UI_TORRENT_DELETE_REQUEST with defaultRemoveFiles false by default', () => {
      component.onClick('delete.deleteTorrent');
      expect(commandBusMock.emit).toHaveBeenCalledWith({
        type: 'UI_TORRENT_DELETE_REQUEST',
        defaultRemoveFiles: false,
      });
    });

    it('should throw for an unknown action id', () => {
      expect(() => component.onClick('unknown.action')).toThrow();
    });
  });
});
