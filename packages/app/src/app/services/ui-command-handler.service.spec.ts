import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';
import { CommandBusService } from './command-bus.service';
import { ElectronService } from './electron.service';
import { PathService } from './path.service';
import { QbService } from './qb.service';
import { SelectionStoreService } from './selection-store.service';
import { ServerStoreService } from './server-store.service';
import { ToastService } from './toast.service';
import { UiCommandHandlerService } from './ui-command-handler.service';

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve));

describe('UiCommandHandlerService', () => {
  let service: UiCommandHandlerService;
  let commands$: Subject<any>;
  let mockModalService: any;
  let commandBusEmit: ReturnType<typeof vi.fn>;
  let selectionStore: any;
  let setInputSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    commands$ = new Subject();
    commandBusEmit = vi.fn();
    setInputSpy = vi.fn();

    mockModalService = {
      activeInstances: new Subject(),
      open: vi.fn().mockReturnValue({
        componentInstance: {},
        _contentRef: { componentRef: { setInput: setInputSpy } },
        result: Promise.resolve({}),
      }),
    };

    selectionStore = {
      selected: signal([{ hash: 'abc' }]),
      selectedHashes: signal(['abc']),
    };

    TestBed.configureTestingModule({
      providers: [
        UiCommandHandlerService,
        { provide: NgbModal, useValue: mockModalService },
        {
          provide: CommandBusService,
          useValue: { commands$: commands$.asObservable(), emit: commandBusEmit },
        },
        { provide: SelectionStoreService, useValue: selectionStore },
        {
          provide: PathService,
          useValue: { resolveLocalPath: vi.fn().mockResolvedValue('/local/path') },
        },
        { provide: ToastService, useValue: { danger: vi.fn(), info: vi.fn() } },
        { provide: ElectronService, useValue: { showItemInFolder: vi.fn(), openPath: vi.fn() } },
        {
          provide: QbService,
          useValue: { torrents: { files: vi.fn().mockResolvedValue([{ name: 'file.mkv' }]) } },
        },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
      ],
    });

    service = TestBed.inject(UiCommandHandlerService);
    service.start();
  });

  it('should only process UI_ commands (ignore others)', () => {
    commands$.next({ type: 'SERVER_ADDED', id: '1' });
    expect(mockModalService.open).not.toHaveBeenCalled();
  });

  it('should open DeleteTorrent modal for UI_TORRENT_DELETE_REQUEST', () => {
    commands$.next({ type: 'UI_TORRENT_DELETE_REQUEST', defaultRemoveFiles: false });
    expect(mockModalService.open).toHaveBeenCalled();
  });

  it('should not open DeleteTorrent modal when selection is empty and no hashes override is given', () => {
    selectionStore.selectedHashes.set([]);
    commands$.next({ type: 'UI_TORRENT_DELETE_REQUEST', defaultRemoveFiles: false });
    expect(mockModalService.open).not.toHaveBeenCalled();
  });

  it('should open DeleteTorrent modal when hashes are provided even if selection is empty', () => {
    selectionStore.selectedHashes.set([]);
    commands$.next({ type: 'UI_TORRENT_DELETE_REQUEST', hashes: ['xyz'] });
    expect(mockModalService.open).toHaveBeenCalled();
  });

  it('should forward the hashes override into the emitted TORRENT_DELETE_CONFIRM command', async () => {
    mockModalService.open.mockReturnValueOnce({
      componentInstance: {},
      _contentRef: { componentRef: { setInput: setInputSpy } },
      result: Promise.resolve({ removeFiles: true }),
    });

    commands$.next({ type: 'UI_TORRENT_DELETE_REQUEST', hashes: ['xyz'] });
    await flushPromises();

    expect(commandBusEmit).toHaveBeenCalledWith({
      type: 'TORRENT_DELETE_CONFIRM',
      removeFiles: true,
      hashes: ['xyz'],
    });
  });

  it('should forward undefined hashes into TORRENT_DELETE_CONFIRM when no override is given', async () => {
    mockModalService.open.mockReturnValueOnce({
      componentInstance: {},
      _contentRef: { componentRef: { setInput: setInputSpy } },
      result: Promise.resolve({ removeFiles: false }),
    });

    commands$.next({ type: 'UI_TORRENT_DELETE_REQUEST' });
    await flushPromises();

    expect(commandBusEmit).toHaveBeenCalledWith({
      type: 'TORRENT_DELETE_CONFIRM',
      removeFiles: false,
      hashes: undefined,
    });
  });

  it('should set the hashes input on the DeleteTorrent modal when an override is given', () => {
    commands$.next({ type: 'UI_TORRENT_DELETE_REQUEST', hashes: ['xyz'] });
    expect(setInputSpy).toHaveBeenCalledWith('hashes', ['xyz']);
  });

  it('should not set the hashes input on the DeleteTorrent modal when no override is given', () => {
    commands$.next({ type: 'UI_TORRENT_DELETE_REQUEST', defaultRemoveFiles: false });
    const hashesCalls = setInputSpy.mock.calls.filter(([inputName]) => inputName === 'hashes');
    expect(hashesCalls).toHaveLength(0);
  });

  it('should open Settings modal for UI_OPEN_SETTINGS', () => {
    commands$.next({ type: 'UI_OPEN_SETTINGS' });
    expect(mockModalService.open).toHaveBeenCalled();
  });

  it('should open QbSettings modal for UI_OPEN_QB_SETTINGS', () => {
    commands$.next({ type: 'UI_OPEN_QB_SETTINGS' });
    expect(mockModalService.open).toHaveBeenCalled();
  });

  it('should open About modal for UI_OPEN_ABOUT', () => {
    commands$.next({ type: 'UI_OPEN_ABOUT' });
    expect(mockModalService.open).toHaveBeenCalled();
  });

  it('should open AddTorrent modal for UI_ADD_TORRENT', () => {
    commands$.next({ type: 'UI_ADD_TORRENT' });
    expect(mockModalService.open).toHaveBeenCalled();
  });

  it('should not open TorrentDetails when hash is missing for UI_OPEN_TORRENT_DETAILS', () => {
    commands$.next({ type: 'UI_OPEN_TORRENT_DETAILS', hash: null });
    expect(mockModalService.open).not.toHaveBeenCalled();
  });

  it('should open TorrentDetails when hash is provided for UI_OPEN_TORRENT_DETAILS', () => {
    commands$.next({ type: 'UI_OPEN_TORRENT_DETAILS', hash: 'abc123' });
    expect(mockModalService.open).toHaveBeenCalled();
  });

  it('should open ServerEditor modal for UI_SERVER_EDITOR_OPEN', () => {
    commands$.next({ type: 'UI_SERVER_EDITOR_OPEN' });
    expect(mockModalService.open).toHaveBeenCalled();
  });
});
