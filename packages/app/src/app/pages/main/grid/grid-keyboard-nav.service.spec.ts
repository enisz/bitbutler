import { TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { Torrent } from '../../../models/torrent.model';
import { CommandBusService } from '../../../services/command-bus.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { TorrentListGridSettingsService } from '../../../services/torrent-list-grid.settings.service';
import { GridKeyboardNavService } from './grid-keyboard-nav.service';

describe('GridKeyboardNavService', () => {
  let service: GridKeyboardNavService;
  let commandBusService: { emit: ReturnType<typeof vi.fn> };
  let modalService: { hasOpenModals: ReturnType<typeof vi.fn> };
  let selectionStoreService: { selected: ReturnType<typeof vi.fn> };
  let torrentListGridSettingsService: { asObservable: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    commandBusService = { emit: vi.fn() };
    modalService = { hasOpenModals: vi.fn().mockReturnValue(false) };
    selectionStoreService = { selected: vi.fn().mockReturnValue([]) };
    torrentListGridSettingsService = {
      asObservable: vi.fn().mockReturnValue(of({ rowDoubleClickAction: 'DETAILS' })),
    };

    TestBed.configureTestingModule({
      providers: [
        GridKeyboardNavService,
        { provide: CommandBusService, useValue: commandBusService },
        { provide: NgbModal, useValue: modalService },
        { provide: SelectionStoreService, useValue: selectionStoreService },
        { provide: TorrentListGridSettingsService, useValue: torrentListGridSettingsService },
      ],
    });

    service = TestBed.inject(GridKeyboardNavService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('anchorIndex', () => {
    it('should be null initially', () => {
      expect(service.anchorIndex).toBeNull();
    });

    it('should set and return the value', () => {
      service.anchorIndex = 3;
      expect(service.anchorIndex).toBe(3);
    });

    it('should accept null', () => {
      service.anchorIndex = 3;
      service.anchorIndex = null;
      expect(service.anchorIndex).toBeNull();
    });
  });

  describe('leadIndex', () => {
    it('should be null initially', () => {
      expect(service.leadIndex).toBeNull();
    });

    it('should set and return the value', () => {
      service.leadIndex = 7;
      expect(service.leadIndex).toBe(7);
    });

    it('should accept null', () => {
      service.leadIndex = 7;
      service.leadIndex = null;
      expect(service.leadIndex).toBeNull();
    });
  });

  describe('onKeyUp', () => {
    it('should emit UI_TORRENT_DELETE_REQUEST when Delete is pressed', () => {
      const event = new KeyboardEvent('keyup', { code: 'Delete' });
      service.onKeyUp(event);
      expect(commandBusService.emit).toHaveBeenCalledWith({
        type: 'UI_TORRENT_DELETE_REQUEST',
        defaultRemoveFiles: false,
      });
    });

    it('should emit with defaultRemoveFiles=true when Shift+Delete is pressed', () => {
      const event = new KeyboardEvent('keyup', { code: 'Delete', shiftKey: true });
      service.onKeyUp(event);
      expect(commandBusService.emit).toHaveBeenCalledWith({
        type: 'UI_TORRENT_DELETE_REQUEST',
        defaultRemoveFiles: true,
      });
    });

    it('should not emit when Delete is pressed in an INPUT element', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      const event = new KeyboardEvent('keyup', { code: 'Delete', bubbles: true });
      Object.defineProperty(event, 'target', { value: input, configurable: true });
      service.onKeyUp(event);
      expect(commandBusService.emit).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });

    it('should not emit when Delete is pressed in a TEXTAREA element', () => {
      const textarea = document.createElement('textarea');
      const event = new KeyboardEvent('keyup', { code: 'Delete' });
      Object.defineProperty(event, 'target', { value: textarea, configurable: true });
      service.onKeyUp(event);
      expect(commandBusService.emit).not.toHaveBeenCalled();
    });

    it('should not emit for non-Delete keys', () => {
      const event = new KeyboardEvent('keyup', { code: 'Space' });
      service.onKeyUp(event);
      expect(commandBusService.emit).not.toHaveBeenCalled();
    });
  });

  describe('onKeyDown', () => {
    it('should not process when a modal is open', () => {
      modalService.hasOpenModals.mockReturnValue(true);
      const event = new KeyboardEvent('keydown', { code: 'KeyA', ctrlKey: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      service.onKeyDown(event);
      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it('should emit TORRENT_RESUME when F3 is pressed', () => {
      const event = new KeyboardEvent('keydown', { code: 'F3' });
      service.onKeyDown(event);
      expect(commandBusService.emit).toHaveBeenCalledWith({ type: 'TORRENT_RESUME' });
    });

    it('should emit TORRENT_FORCE_RESUME when Shift+F3 is pressed', () => {
      const event = new KeyboardEvent('keydown', { code: 'F3', shiftKey: true });
      service.onKeyDown(event);
      expect(commandBusService.emit).toHaveBeenCalledWith({ type: 'TORRENT_FORCE_RESUME' });
    });

    it('should emit TORRENT_PAUSE when F4 is pressed', () => {
      const event = new KeyboardEvent('keydown', { code: 'F4' });
      service.onKeyDown(event);
      expect(commandBusService.emit).toHaveBeenCalledWith({ type: 'TORRENT_PAUSE' });
    });

    it('should not emit when Shift+F4 is pressed', () => {
      const event = new KeyboardEvent('keydown', { code: 'F4', shiftKey: true });
      service.onKeyDown(event);
      expect(commandBusService.emit).not.toHaveBeenCalled();
    });

    it('should not emit F3/F4 hotkeys when Ctrl is held', () => {
      const event = new KeyboardEvent('keydown', { code: 'F3', ctrlKey: true });
      service.onKeyDown(event);
      expect(commandBusService.emit).not.toHaveBeenCalled();
    });

    it('should not emit TORRENT_PAUSE when Alt+F4 is pressed', () => {
      const event = new KeyboardEvent('keydown', { code: 'F4', altKey: true });
      service.onKeyDown(event);
      expect(commandBusService.emit).not.toHaveBeenCalled();
    });

    it('should not emit when F3 is pressed in an INPUT element', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      const event = new KeyboardEvent('keydown', { code: 'F3', bubbles: true });
      Object.defineProperty(event, 'target', { value: input, configurable: true });
      service.onKeyDown(event);
      expect(commandBusService.emit).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });

    describe('F2 rename hotkey', () => {
      const torrent = { hash: 'abc123' } as Torrent;

      function makeApi(overrides: Record<string, unknown> = {}) {
        return {
          getColumnState: vi.fn().mockReturnValue([{ colId: 'name', hide: false }]),
          getSelectedNodes: vi.fn().mockReturnValue([{ rowIndex: 2 }]),
          ensureIndexVisible: vi.fn(),
          setFocusedCell: vi.fn(),
          startEditingCell: vi.fn(),
          ...overrides,
        };
      }

      it('should not emit when no torrent is selected', async () => {
        selectionStoreService.selected.mockReturnValue([]);
        const event = new KeyboardEvent('keydown', { code: 'F2' });
        service.onKeyDown(event);
        await Promise.resolve();
        expect(commandBusService.emit).not.toHaveBeenCalled();
      });

      it('should not emit when more than one torrent is selected', async () => {
        selectionStoreService.selected.mockReturnValue([torrent, torrent]);
        const event = new KeyboardEvent('keydown', { code: 'F2' });
        service.onKeyDown(event);
        await Promise.resolve();
        expect(commandBusService.emit).not.toHaveBeenCalled();
      });

      it('should open the rename modal when inline edit is disabled', async () => {
        selectionStoreService.selected.mockReturnValue([torrent]);
        torrentListGridSettingsService.asObservable.mockReturnValue(
          of({ rowDoubleClickAction: 'DETAILS' }),
        );
        const event = new KeyboardEvent('keydown', { code: 'F2' });
        service.onKeyDown(event);
        await Promise.resolve();
        await Promise.resolve();
        expect(commandBusService.emit).toHaveBeenCalledWith({
          type: 'UI_RENAME_TORRENT',
          torrent,
        });
      });

      it('should open the rename modal when inline edit is enabled but the name column is hidden', async () => {
        selectionStoreService.selected.mockReturnValue([torrent]);
        torrentListGridSettingsService.asObservable.mockReturnValue(
          of({ rowDoubleClickAction: 'INLINE_EDIT' }),
        );
        const api = makeApi({
          getColumnState: vi.fn().mockReturnValue([{ colId: 'name', hide: true }]),
        });
        service.init(api as any);

        const event = new KeyboardEvent('keydown', { code: 'F2' });
        service.onKeyDown(event);
        await Promise.resolve();
        await Promise.resolve();

        expect(commandBusService.emit).toHaveBeenCalledWith({
          type: 'UI_RENAME_TORRENT',
          torrent,
        });
        expect(api.startEditingCell).not.toHaveBeenCalled();
      });

      it('should start inline editing the name cell when inline edit is enabled and the name column is visible', async () => {
        selectionStoreService.selected.mockReturnValue([torrent]);
        torrentListGridSettingsService.asObservable.mockReturnValue(
          of({ rowDoubleClickAction: 'INLINE_EDIT' }),
        );
        const api = makeApi();
        service.init(api as any);

        const event = new KeyboardEvent('keydown', { code: 'F2' });
        service.onKeyDown(event);
        await Promise.resolve();
        await Promise.resolve();

        expect(commandBusService.emit).not.toHaveBeenCalled();
        expect(api.ensureIndexVisible).toHaveBeenCalledWith(2);
        expect(api.setFocusedCell).toHaveBeenCalledWith(2, 'name');
        expect(api.startEditingCell).toHaveBeenCalledWith({ rowIndex: 2, colKey: 'name' });
      });

      it('should not process F2 when Ctrl is held', async () => {
        selectionStoreService.selected.mockReturnValue([torrent]);
        const event = new KeyboardEvent('keydown', { code: 'F2', ctrlKey: true });
        service.onKeyDown(event);
        await Promise.resolve();
        expect(commandBusService.emit).not.toHaveBeenCalled();
      });

      it('should not process F2 when pressed in an INPUT element', async () => {
        selectionStoreService.selected.mockReturnValue([torrent]);
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();
        const event = new KeyboardEvent('keydown', { code: 'F2', bubbles: true });
        Object.defineProperty(event, 'target', { value: input, configurable: true });
        service.onKeyDown(event);
        await Promise.resolve();
        expect(commandBusService.emit).not.toHaveBeenCalled();
        document.body.removeChild(input);
      });
    });
  });
});
