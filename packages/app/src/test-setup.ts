// Vitest 4's `vi.spyOn()` returns the *existing* mock when the target property is already a mock
// instead of installing a fresh wrapper (Vitest 3 re-wrapped it). Since the `window.bitbutler`
// stubs below are shared by every test in a file, a spy installed in one test would otherwise keep
// accumulating calls into the next one. Restore spies after each test to keep tests isolated.
afterEach(() => {
  vi.restoreAllMocks();
});

const noop = () => {};
const noopAsync = () => Promise.resolve(null);
const noopVoidAsync = () => Promise.resolve();
const noopSubscription = () => noop;

// jsdom does not implement the Popover API (https://github.com/jsdom/jsdom/issues/3294).
// Stub it on the prototype so tests can `vi.spyOn` these methods.
const htmlElementProto = HTMLElement.prototype as {
  showPopover?: () => void;
  hidePopover?: () => void;
};
if (!htmlElementProto.showPopover) {
  htmlElementProto.showPopover = noop;
  htmlElementProto.hidePopover = noop;
}

// Node 22+ defines its own `localStorage`/`sessionStorage` globals, which throw an
// ExperimentalWarning and resolve to `undefined` unless `--localstorage-file` is passed.
// Vitest's jsdom environment only copies over keys from a hardcoded list that predates this
// Node addition, so it leaves Node's non-functional globals in place instead of jsdom's real
// Storage implementation (https://github.com/vitest-dev/vitest/blob/main/packages/vitest/src/integrations/env/jsdom.ts).
// Provide a minimal in-memory Storage polyfill so tests can use localStorage/sessionStorage.
class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

for (const key of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(globalThis, key, {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
}

window.bitbutler = {
  electron: {
    isDev: () => Promise.resolve(false),
    openExternalUrl: noopVoidAsync,
    showOpenDialog: () => Promise.resolve(''),
    getDownloadsPath: () => Promise.resolve(''),
    openPath: () => Promise.resolve(''),
    showItemInFolder: noopVoidAsync,
    getPlatform: () => Promise.resolve('linux'),
    checkForUpdate: () => Promise.resolve({ updateAvailable: false, error: null }),
    setLoginItem: noopVoidAsync,
  },
  updater: {
    getCapability: () => Promise.resolve({ supported: false }),
    updateNow: noopVoidAsync,
    cancelDownload: noopVoidAsync,
    onEvent: noopSubscription,
  },
  server: {
    list: () => Promise.resolve([]),
    add: () => Promise.resolve({ id: '' }),
    update: () => Promise.resolve({ updated: false }),
    delete: () => Promise.resolve({ deleted: false }),
    getById: noopAsync,
    getByHost: noopAsync,
    setConnectionInfo: () => Promise.resolve({ updated: false }),
    setActive: noop,
  },
  view: {
    setActive: noop,
  },
  qb: {
    login: () => Promise.resolve({ loggedIn: false }),
    logout: () => Promise.resolve({ loggedOut: false }),
    hasCookie: () => Promise.resolve({ hasCookie: false }),
    request: <TResponse = unknown>(_payload: unknown) => Promise.resolve(null as TResponse),
    torrentsAdd: noopAsync,
  },
  window: {
    maximize: noopVoidAsync,
    unmaximize: noopVoidAsync,
    toggleMaximize: noopVoidAsync,
    setSize: noopVoidAsync,
    setOpenFilesEnabled: () => Promise.resolve({ enabled: false }),
    onOpenFiles: noopSubscription,
    onTorrentDrafts: noopSubscription,
    onStateChange: noopSubscription,
    drainOpenFiles: () => Promise.resolve([]),
    drainOpenTorrents: () => Promise.resolve([]),
    onOpenBbe: noopSubscription,
    drainOpenBbe: () => Promise.resolve([]),
    simulateOpenFiles: () => Promise.resolve([]),
  },
  torrent: {
    parse: () => Promise.resolve({ source: 'manual', receivedAt: 0 }),
    deleteFile: () => Promise.resolve({ ok: false }),
    scanFolder: () => Promise.resolve([]),
  },
  menu: {
    onClick: noopSubscription,
  },
  notification: {
    show: () => Promise.resolve({ ok: false }),
  },
  log: {
    write: noop,
  },
  settings: {
    get: () => Promise.resolve(null),
    upsert: () => Promise.resolve({ ok: true as const }),
    delete: () => Promise.resolve({ ok: true as const }),
  },
  i18n: {
    languageChanged: noop,
  },
  export: {
    start: noop,
    cancel: noop,
    openBbePicker: () => Promise.resolve(undefined),
    readBbe: () =>
      Promise.resolve({
        version: 0,
        exported_at: 0,
        source_server: '',
        export_mode: 'full' as const,
        torrents: [],
      }),
    getServerInfo: () => Promise.resolve({ webapiVersion: '', qbVersion: '', isFullMode: false }),
    saveTorrentFiles: () => Promise.resolve({ cancelled: true, savedPaths: [], failed: [] }),
    importStart: noop,
    importCancel: noop,
    onProgress: noopSubscription,
    onDone: noopSubscription,
    onError: noopSubscription,
    onImportProgress: noopSubscription,
    onImportDone: noopSubscription,
    onImportError: noopSubscription,
  },
};
