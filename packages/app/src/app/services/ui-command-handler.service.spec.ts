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
      import('../modals/set-path/set-path'),
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
      import('../modals/torrent-exists/torrent-exists'),
      import('../modals/credential-prompt/credential-prompt'),
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
          useValue: {
            torrents: { files: vi.fn().mockResolvedValue([{ name: 'file.mkv' }]) },
            auth: { hasCookie: vi.fn(), login: vi.fn() },
          },
        },
        {
          provide: ServerStoreService,
          useValue: {
            currentServerId: signal('server-1'),
            servers: signal([]),
            select: vi.fn(),
          },
        },
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

  it('should open ImportTorrents modal at xl size for UI_IMPORT_TORRENTS', async () => {
    commands$.next({ type: 'UI_IMPORT_TORRENTS' });
    await flushPromises();
    expect(mockModalService.open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ size: 'xl', scrollable: true }),
    );
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

  it('should open TorrentExists modal for UI_TORRENT_EXISTS', async () => {
    commands$.next({ type: 'UI_TORRENT_EXISTS', hash: 'abc123', originalPath: '/tmp/a.torrent' });
    await flushPromises();
    expect(mockModalService.open).toHaveBeenCalled();
    expect(setInputSpy).toHaveBeenCalledWith('hash', 'abc123');
    expect(setInputSpy).toHaveBeenCalledWith('originalPath', '/tmp/a.torrent');
  });

  it('should open a new TorrentExists modal even if one is already open (no isModalOpen guard)', async () => {
    commands$.next({ type: 'UI_TORRENT_EXISTS', hash: 'abc123', originalPath: null });
    await flushPromises();
    mockModalService.open.mockClear();

    commands$.next({ type: 'UI_TORRENT_EXISTS', hash: 'def456', originalPath: null });
    await flushPromises();

    expect(mockModalService.open).toHaveBeenCalled();
  });

  it('should open UpdateAvailable modal with the update input for UI_UPDATE_AVAILABLE', async () => {
    const update = { releases: [], updateAvailable: true } as any;
    commands$.next({ type: 'UI_UPDATE_AVAILABLE', update });
    await flushPromises();
    expect(mockModalService.open).toHaveBeenCalled();
    expect(setInputSpy).toHaveBeenCalledWith('update', update);
  });

  it('should open ServerEditor modal for UI_SERVER_EDITOR_OPEN', async () => {
    commands$.next({ type: 'UI_SERVER_EDITOR_OPEN' });
    await flushPromises();
    expect(mockModalService.open).toHaveBeenCalled();
  });

  it('should open SetPath modal with pathType "save" for UI_SET_SAVE_PATH', async () => {
    commands$.next({ type: 'UI_SET_SAVE_PATH', torrent: { hash: 'abc' } });
    await flushPromises();
    expect(mockModalService.open).toHaveBeenCalled();
    expect(setInputSpy).toHaveBeenCalledWith('pathType', 'save');
  });

  it('should open SetPath modal with pathType "download" for UI_SET_DOWNLOAD_PATH', async () => {
    commands$.next({ type: 'UI_SET_DOWNLOAD_PATH', torrent: { hash: 'abc' } });
    await flushPromises();
    expect(mockModalService.open).toHaveBeenCalled();
    expect(setInputSpy).toHaveBeenCalledWith('pathType', 'download');
  });

  describe('UI_SERVER_SWITCH', () => {
    let qbAuthMock: { hasCookie: ReturnType<typeof vi.fn>; login: ReturnType<typeof vi.fn> };
    let serverStoreMock: {
      servers: ReturnType<typeof signal<any[]>>;
      select: ReturnType<typeof vi.fn>;
      currentServerId: ReturnType<typeof signal<string | null>>;
    };
    let toastMock: { danger: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };

    function loaderRef() {
      return { close: vi.fn() };
    }

    function credentialRef(result: Promise<unknown>) {
      const componentInstance: Record<string, unknown> = {};
      return {
        componentInstance,
        result,
        _contentRef: {
          componentRef: {
            setInput: vi.fn((name: string, value: unknown) => {
              componentInstance[name] = value;
            }),
          },
        },
      };
    }

    function setServer(overrides: Record<string, unknown> = {}) {
      serverStoreMock.servers.set([
        {
          id: 'server-1',
          name: 'My Server',
          host: 'localhost',
          port: 8080,
          protocol: 'http',
          username: '',
          has_password: false,
          ...overrides,
        },
      ]);
    }

    beforeEach(() => {
      qbAuthMock = (TestBed.inject(QbService) as any).auth;
      serverStoreMock = TestBed.inject(ServerStoreService) as any;
      toastMock = TestBed.inject(ToastService) as any;
    });

    it('opens the credential prompt when there is no session and credentials are missing', async () => {
      setServer();
      qbAuthMock.hasCookie.mockResolvedValue(false);
      const cancelled = Promise.reject(undefined);
      cancelled.catch(() => {});
      const firstLoader = loaderRef();
      mockModalService.open
        .mockReturnValueOnce(firstLoader)
        .mockReturnValueOnce(credentialRef(cancelled));

      commands$.next({ type: 'UI_SERVER_SWITCH', id: 'server-1' });
      await flushPromises();

      expect(mockModalService.open).toHaveBeenCalledTimes(2);
      expect(firstLoader.close).toHaveBeenCalledTimes(1);
      // Proves the loader was closed *before* the credential prompt opened, not just that
      // both happened - a stacking regression (skipping the close) would fail this.
      const closeOrder = firstLoader.close.mock.invocationCallOrder[0];
      const promptOpenOrder = mockModalService.open.mock.invocationCallOrder[1];
      expect(closeOrder).toBeLessThan(promptOpenOrder);
      expect(qbAuthMock.login).not.toHaveBeenCalled();
    });

    it('skips the credential prompt when a session already exists', async () => {
      setServer();
      qbAuthMock.hasCookie.mockResolvedValue(true);
      const loader = loaderRef();
      mockModalService.open.mockReturnValueOnce(loader);

      commands$.next({ type: 'UI_SERVER_SWITCH', id: 'server-1' });
      await flushPromises();

      expect(mockModalService.open).toHaveBeenCalledTimes(1);
      expect(qbAuthMock.login).not.toHaveBeenCalled();
      expect(serverStoreMock.select).toHaveBeenCalledWith('server-1');
      expect(loader.close).toHaveBeenCalledTimes(1);
    });

    it('skips the credential prompt when credentials are already saved', async () => {
      setServer({ username: 'admin', has_password: true });
      qbAuthMock.hasCookie.mockResolvedValue(false);
      qbAuthMock.login.mockResolvedValue({ loggedIn: true });
      const loader = loaderRef();
      mockModalService.open.mockReturnValueOnce(loader);

      commands$.next({ type: 'UI_SERVER_SWITCH', id: 'server-1' });
      await flushPromises();

      expect(mockModalService.open).toHaveBeenCalledTimes(1);
      expect(qbAuthMock.login).toHaveBeenCalledWith('server-1', undefined, undefined);
      expect(loader.close).toHaveBeenCalledTimes(1);
    });

    it('persists credentials and logs in with no runtime args when the prompt saves', async () => {
      setServer();
      qbAuthMock.hasCookie.mockResolvedValue(false);
      qbAuthMock.login.mockResolvedValue({ loggedIn: true });
      const updateSpy = vi
        .spyOn(window.bitbutler.server, 'update')
        .mockResolvedValue({ updated: true });
      const firstLoader = loaderRef();
      const reopenedLoader = loaderRef();
      mockModalService.open
        .mockReturnValueOnce(firstLoader)
        .mockReturnValueOnce(
          credentialRef(Promise.resolve({ username: 'admin', password: 'secret', save: true })),
        )
        .mockReturnValueOnce(reopenedLoader);

      commands$.next({ type: 'UI_SERVER_SWITCH', id: 'server-1' });
      await flushPromises();

      // Proves the loader is genuinely reopened after the prompt resolves - a regression
      // that silently dropped the `appLoaderModal = openLoader()` reopen line would still
      // satisfy the credential/login assertions below, but would fail this call count.
      expect(mockModalService.open).toHaveBeenCalledTimes(3);
      expect(firstLoader.close).toHaveBeenCalledTimes(1);
      expect(reopenedLoader.close).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledWith({
        id: 'server-1',
        changes: { username: 'admin', password: 'secret' },
      });
      expect(commandBusEmit).toHaveBeenCalledWith({ type: 'SERVER_UPDATED', id: 'server-1' });
      expect(qbAuthMock.login).toHaveBeenCalledWith('server-1', undefined, undefined);
    });

    it('logs in with the entered credentials without persisting when the prompt does not save', async () => {
      setServer();
      qbAuthMock.hasCookie.mockResolvedValue(false);
      qbAuthMock.login.mockResolvedValue({ loggedIn: true });
      const updateSpy = vi.spyOn(window.bitbutler.server, 'update');
      const firstLoader = loaderRef();
      const reopenedLoader = loaderRef();
      mockModalService.open
        .mockReturnValueOnce(firstLoader)
        .mockReturnValueOnce(
          credentialRef(Promise.resolve({ username: 'admin', password: 'secret', save: false })),
        )
        .mockReturnValueOnce(reopenedLoader);

      commands$.next({ type: 'UI_SERVER_SWITCH', id: 'server-1' });
      await flushPromises();

      expect(mockModalService.open).toHaveBeenCalledTimes(3);
      expect(firstLoader.close).toHaveBeenCalledTimes(1);
      expect(reopenedLoader.close).toHaveBeenCalledTimes(1);
      expect(updateSpy).not.toHaveBeenCalled();
      expect(qbAuthMock.login).toHaveBeenCalledWith('server-1', 'admin', 'secret');
    });

    it('aborts quietly without a toast when the credential prompt is cancelled', async () => {
      setServer();
      qbAuthMock.hasCookie.mockResolvedValue(false);
      const cancelled = Promise.reject(undefined);
      cancelled.catch(() => {});
      const firstLoader = loaderRef();
      mockModalService.open
        .mockReturnValueOnce(firstLoader)
        .mockReturnValueOnce(credentialRef(cancelled));

      commands$.next({ type: 'UI_SERVER_SWITCH', id: 'server-1' });
      await flushPromises();

      expect(qbAuthMock.login).not.toHaveBeenCalled();
      expect(toastMock.danger).not.toHaveBeenCalled();
      // The loader must close exactly once on the cancel path (no reopen, no double-close
      // via the nullable appLoaderModal pattern in the `finally` block).
      expect(mockModalService.open).toHaveBeenCalledTimes(2);
      expect(firstLoader.close).toHaveBeenCalledTimes(1);
    });

    it('shows a danger toast and falls back to the current server when login fails', async () => {
      setServer({ username: 'admin', has_password: true });
      qbAuthMock.hasCookie.mockResolvedValue(false);
      qbAuthMock.login.mockResolvedValue({ loggedIn: false });
      const loader = loaderRef();
      mockModalService.open.mockReturnValueOnce(loader);

      commands$.next({ type: 'UI_SERVER_SWITCH', id: 'server-1' });
      await flushPromises();

      expect(toastMock.danger).toHaveBeenCalledWith('"My Server"', expect.any(String));
      expect(loader.close).toHaveBeenCalledTimes(1);
    });
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
