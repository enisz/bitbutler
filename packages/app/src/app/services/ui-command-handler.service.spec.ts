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

// The module cache is pre-warmed in beforeAll so dynamic import() calls in the service
// resolve as microtasks. setTimeout(0) lets all pending microtasks drain before asserting.
const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve));

describe('UiCommandHandlerService', () => {
  let service: UiCommandHandlerService;
  let commands$: Subject<any>;
  let mockModalService: any;
  let commandBusEmit: ReturnType<typeof vi.fn>;
  let selectionStore: any;
  let setInputSpy: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    // Load all modal chunks into the Node.js ESM cache once before any test runs.
    // The service uses dynamic import() for each modal; without pre-warming, the first
    // import for each module requires async I/O which completes after flushPromises resolves.
    await Promise.all([
      import('../components/modals/delete-torrent/delete-torrent'),
      import('../pages/settings/settings'),
      import('../pages/qb-settings/qb-settings'),
      import('../components/modals/torrent-details/torrent-details'),
      import('../components/add-torrent/add-torrent'),
      import('../components/about/about'),
      import('../components/modals/rename-torrent/rename-torrent'),
      import('../components/modals/set-torrent-location/set-torrent-location'),
      import('../components/modals/transfer-limit/transfer-limit'),
      import('../components/modals/share-limit/share-limit'),
      import('../components/modals/set-torrent-tags/set-torrent-tags'),
      import('../components/modals/set-torrent-category/set-torrent-category'),
      import('../components/modals/server-editor/server-editor'),
      import('../components/modals/update-available/update-available'),
      import('../components/modals/manage-tags/manage-tags'),
      import('../components/modals/manage-categories/manage-categories'),
      import('../components/modals/manage-servers/manage-servers'),
      import('../components/modals/export-torrents/export-torrents'),
      import('../components/modals/import-torrents/import-torrents'),
    ]);
  });

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

  it('should open DeleteTorrent modal for UI_TORRENT_DELETE_REQUEST', async () => {
    commands$.next({ type: 'UI_TORRENT_DELETE_REQUEST', defaultRemoveFiles: false });
    await flushPromises();
    expect(mockModalService.open).toHaveBeenCalled();
  });

  it('should not open DeleteTorrent modal when selection is empty and no hashes override is given', () => {
    selectionStore.selectedHashes.set([]);
    commands$.next({ type: 'UI_TORRENT_DELETE_REQUEST', defaultRemoveFiles: false });
    expect(mockModalService.open).not.toHaveBeenCalled();
  });

  it('should open DeleteTorrent modal when hashes are provided even if selection is empty', async () => {
    selectionStore.selectedHashes.set([]);
    commands$.next({ type: 'UI_TORRENT_DELETE_REQUEST', hashes: ['xyz'] });
    await flushPromises();
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

  it('should set the hashes input on the DeleteTorrent modal when an override is given', async () => {
    commands$.next({ type: 'UI_TORRENT_DELETE_REQUEST', hashes: ['xyz'] });
    await flushPromises();
    expect(setInputSpy).toHaveBeenCalledWith('hashes', ['xyz']);
  });

  it('should not set the hashes input on the DeleteTorrent modal when no override is given', async () => {
    commands$.next({ type: 'UI_TORRENT_DELETE_REQUEST', defaultRemoveFiles: false });
    await flushPromises();
    const hashesCalls = setInputSpy.mock.calls.filter(([inputName]) => inputName === 'hashes');
    expect(hashesCalls).toHaveLength(0);
  });

  it('should open Settings modal for UI_OPEN_SETTINGS', async () => {
    commands$.next({ type: 'UI_OPEN_SETTINGS' });
    await flushPromises();
    expect(mockModalService.open).toHaveBeenCalled();
  });

  it('should open QbSettings modal for UI_OPEN_QB_SETTINGS', async () => {
    commands$.next({ type: 'UI_OPEN_QB_SETTINGS' });
    await flushPromises();
    expect(mockModalService.open).toHaveBeenCalled();
  });

  it('should open About modal for UI_OPEN_ABOUT', async () => {
    commands$.next({ type: 'UI_OPEN_ABOUT' });
    await flushPromises();
    expect(mockModalService.open).toHaveBeenCalled();
  });

  it('should open AddTorrent modal for UI_ADD_TORRENT', async () => {
    commands$.next({ type: 'UI_ADD_TORRENT' });
    await flushPromises();
    expect(mockModalService.open).toHaveBeenCalled();
  });

  it('should not open TorrentDetails when hash is missing for UI_OPEN_TORRENT_DETAILS', () => {
    commands$.next({ type: 'UI_OPEN_TORRENT_DETAILS', hash: null });
    expect(mockModalService.open).not.toHaveBeenCalled();
  });

  it('should open TorrentDetails when hash is provided for UI_OPEN_TORRENT_DETAILS', async () => {
    commands$.next({ type: 'UI_OPEN_TORRENT_DETAILS', hash: 'abc123' });
    await flushPromises();
    expect(mockModalService.open).toHaveBeenCalled();
  });

  it('should open ServerEditor modal for UI_SERVER_EDITOR_OPEN', async () => {
    commands$.next({ type: 'UI_SERVER_EDITOR_OPEN' });
    await flushPromises();
    expect(mockModalService.open).toHaveBeenCalled();
  });
});
