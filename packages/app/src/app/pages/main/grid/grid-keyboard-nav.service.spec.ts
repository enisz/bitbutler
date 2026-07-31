import { TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CommandBusService } from '../../../services/command-bus.service';
import { GridKeyboardNavService } from './grid-keyboard-nav.service';

describe('GridKeyboardNavService', () => {
  let service: GridKeyboardNavService;
  let commandBusService: { emit: ReturnType<typeof vi.fn> };
  let modalService: { hasOpenModals: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    commandBusService = { emit: vi.fn() };
    modalService = { hasOpenModals: vi.fn().mockReturnValue(false) };

    TestBed.configureTestingModule({
      providers: [
        GridKeyboardNavService,
        { provide: CommandBusService, useValue: commandBusService },
        { provide: NgbModal, useValue: modalService },
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
  });
});
