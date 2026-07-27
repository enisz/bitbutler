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
  server: {
    list: () => Promise.resolve([]),
    add: noopAsync,
    update: noopAsync,
    delete: noopAsync,
    getById: noopAsync,
    getByHost: noopAsync,
    setExportAvailable: noopAsync,
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
    checkAvailability: () => Promise.resolve({ available: false }),
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
