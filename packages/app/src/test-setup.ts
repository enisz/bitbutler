const noop = () => {};
const noopAsync = () => Promise.resolve(null);
const noopSubscription = () => noop;

(window as any).bitbutler = {
  electron: {
    isDev: () => Promise.resolve(false),
    openExternalUrl: noopAsync,
    showOpenDialog: () => Promise.resolve(null),
    openPath: noopAsync,
    showItemInFolder: noop,
    getPlatform: () => Promise.resolve('linux'),
    checkForUpdate: () => Promise.resolve({ updateAvailable: false, error: null }),
  },
  server: {
    list: () => Promise.resolve([]),
    add: noopAsync,
    update: noopAsync,
    delete: noopAsync,
    getById: noopAsync,
    getByHost: noopAsync,
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
    simulateOpenFiles: noopAsync,
  },
  torrent: {
    parse: noopAsync,
    deleteFile: noopAsync,
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
