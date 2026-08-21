const noop = () => {};
const noopAsync = () => Promise.resolve(null);
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

(window as any).bitbutler = {
  electron: {
    isDev: () => Promise.resolve(false),
    openExternalUrl: noopAsync,
    showOpenDialog: () => Promise.resolve(null),
    getDownloadsPath: () => Promise.resolve(''),
    openPath: noopAsync,
    showItemInFolder: noop,
    getPlatform: () => Promise.resolve('linux'),
    checkForUpdate: () => Promise.resolve({ updateAvailable: false, error: null }),
    setLoginItem: noopAsync,
  },
  updater: {
    getCapability: () => Promise.resolve({ supported: false }),
    updateNow: noopAsync,
    onEvent: noopSubscription,
  },
  server: {
    list: () => Promise.resolve([]),
    add: noopAsync,
    update: noopAsync,
    delete: noopAsync,
    getById: noopAsync,
    getByHost: noopAsync,
    setConnectionInfo: noopAsync,
    setActive: noop,
  },
  qb: {
    login: noopAsync,
    logout: noopAsync,
    hasCookie: () => Promise.resolve(false),
    request: noopAsync,
    torrentsAdd: noopAsync,
    startSyncStream: noop,
    onSyncChunk: noopSubscription,
  },
  window: {
    maximize: noopAsync,
    unmaximize: noopAsync,
    toggleMaximize: noopAsync,
    setSize: noopAsync,
    setOpenFilesEnabled: noopAsync,
    onOpenFiles: noopSubscription,
    onTorrentDrafts: noopSubscription,
    onStateChange: noopSubscription,
    drainOpenFiles: noopAsync,
    drainOpenTorrents: noopAsync,
    onOpenBbe: noopSubscription,
    drainOpenBbe: () => Promise.resolve([]),
    simulateOpenFiles: noopAsync,
  },
  torrent: {
    parse: noopAsync,
    deleteFile: noopAsync,
    scanFolder: () => Promise.resolve([]),
  },
  menu: {
    onClick: noopSubscription,
  },
  notification: {
    show: noopAsync,
  },
  settings: {
    get: () => Promise.resolve(null),
    upsert: noopAsync,
    delete: noopAsync,
  },
  i18n: {
    languageChanged: noop,
  },
  export: {
    start: noop,
    cancel: noop,
    openBbePicker: () => Promise.resolve(undefined),
    readBbe: noopAsync,
    getServerInfo: noopAsync,
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
