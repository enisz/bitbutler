import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject, Subject } from 'rxjs';
import { CommandBusService } from './command-bus.service';
import { ElectronService } from './electron.service';
import { PathService } from './path.service';
import { QbPollingService } from './qb-polling.service';
import { QbService } from './qb.service';
import { SelectionStoreService } from './selection-store.service';
import { ServerStoreService } from './server-store.service';
import { ToastService } from './toast.service';
import { TorrentListGridSettingsService } from './torrent-list-grid.settings.service';
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
  let mockPollingService: { pause: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn> };
  let gridSettings$: BehaviorSubject<{ pausePollingOnModal: boolean }>;

  beforeAll(async () => {
    // Load all modal chunks into the Node.js ESM cache once before any test runs.
    // The service uses dynamic import() for each modal; without pre-warming, the first
    // import for each module requires async I/O which completes after flushPromises resolves.
    await Promise.all([
      import('../modals/delete-torrent/delete-torrent'),
      import('../modals/settings/settings'),
      import('../modals/qb-settings/qb-settings'),
      import('../modals/torrent-details/torrent-details'),
      import('../modals/add-torrent/add-torrent'),
      import('../components/about/about'),
      import('../modals/rename-torrent/rename-torrent'),
      import('../modals/set-torrent-location/set-torrent-location'),
      import('../modals/transfer-limit/transfer-limit'),
      import('../modals/share-limit/share-limit'),
      import('../modals/set-torrent-tags/set-torrent-tags'),
      import('../modals/set-torrent-category/set-torrent-category'),
      import('../modals/server-editor/server-editor'),
      import('../modals/update-available/update-available'),
      import('../modals/manage-tags/manage-tags'),
      import('../modals/manage-categories/manage-categories'),
      import('../modals/manage-servers/manage-servers'),
      import('../modals/export-torrents/export-torrents'),
      import('../modals/import-torrents/import-torrents'),
    ]);
  });

  beforeEach(() => {
    commands$ = new Subject();
    commandBusEmit = vi.fn();
    setInputSpy = vi.fn();

    mockPollingService = {
      pause: vi.fn().mockReturnValue(Symbol('pause-token')),
      resume: vi.fn(),
    };
    gridSettings$ = new BehaviorSubject<{ pausePollingOnModal: boolean }>({
      pausePollingOnModal: false,
    });

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
        {
          provide: TorrentListGridSettingsService,
          useValue: { asObservable: vi.fn().mockReturnValue(gridSettings$.asObservable()) },
        },
        {
          provide: QbPollingService,
          useValue: mockPollingService,
        },
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

  describe('pausePollingOnModal', () => {
    it('should not pause polling when setting is disabled and a modal opens', () => {
      gridSettings$.next({ pausePollingOnModal: false });
      mockModalService.activeInstances.next([{} as any]);
      expect(mockPollingService.pause).not.toHaveBeenCalled();
    });

    it('should pause polling when setting is enabled and a modal opens', () => {
      gridSettings$.next({ pausePollingOnModal: true });
      mockModalService.activeInstances.next([{} as any]);
      expect(mockPollingService.pause).toHaveBeenCalledTimes(1);
    });

    it('should resume polling with the correct token when the last modal closes', () => {
      const token = Symbol('test-token');
      mockPollingService.pause.mockReturnValueOnce(token);
      gridSettings$.next({ pausePollingOnModal: true });
      mockModalService.activeInstances.next([{} as any]);
      mockModalService.activeInstances.next([]);
      expect(mockPollingService.resume).toHaveBeenCalledWith(token);
    });

    it('should not call pause a second time when an additional modal opens while already paused', () => {
      gridSettings$.next({ pausePollingOnModal: true });
      mockModalService.activeInstances.next([{} as any]);
      mockModalService.activeInstances.next([{} as any, {} as any]);
      expect(mockPollingService.pause).toHaveBeenCalledTimes(1);
    });

    it('should resume polling when the service is destroyed while a modal is open', async () => {
      gridSettings$.next({ pausePollingOnModal: true });
      mockModalService.activeInstances.next([{} as any]);
      expect(mockPollingService.pause).toHaveBeenCalledTimes(1);
      expect(mockPollingService.resume).not.toHaveBeenCalled();

      await TestBed.resetTestingModule();

      expect(mockPollingService.resume).toHaveBeenCalledTimes(1);
    });
  });
});
