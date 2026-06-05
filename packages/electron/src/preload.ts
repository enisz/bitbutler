import type {
  BbeMetadata,
  BitButlerAPI,
  BitButlerSyncStreamResponse,
  ExportDoneEvent,
  ExportProgressEvent,
  ExportStartPayload,
  ImportStartPayload,
  MenuClickPayload,
  TorrentDraft,
  WindowState,
} from '@bitbutler/shared';
import { contextBridge, ipcRenderer } from 'electron';

let cachedWindowState: WindowState | null = null;
ipcRenderer.on('window:state-change', (_event, state) => {
  cachedWindowState = state as WindowState;
});

function makeIpcSubscription<T>(
  channel: string,
  mapPayload: (payload: unknown) => T,
  callback: ((payload: T) => void) | undefined,
): () => void {
  if (typeof callback !== 'function') return () => {};

  const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
    try {
      callback(mapPayload(payload));
    } catch (e) {
      console.error(`[preload] handler failed for ${channel}`, e);
    }
  };

  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const api: BitButlerAPI = {
  electron: {
    isDev: () => ipcRenderer.invoke('electron:is-dev'),
    openExternalUrl: (url) => ipcRenderer.invoke('electron:open-external-url', url),
    showOpenDialog: () => ipcRenderer.invoke('electron:show-open-dialog'),
    openPath: (path) => ipcRenderer.invoke('electron:open-path', path),
    showItemInFolder: (path) => ipcRenderer.invoke('electron:show-item-in-folder', path),
    getPlatform: () => ipcRenderer.invoke('electron:get-platform'),
    checkForUpdate: () => ipcRenderer.invoke('electron:check-for-update'),
    setLoginItem: (settings) => ipcRenderer.invoke('electron:set-login-item', settings),
  },

  server: {
    list: () => ipcRenderer.invoke('server:list'),
    add: (server) => ipcRenderer.invoke('server:add', server),
    update: (payload) => ipcRenderer.invoke('server:update', payload),
    delete: ({ id }) => ipcRenderer.invoke('server:delete', { id }),
    getById: ({ id }) => ipcRenderer.invoke('server:getById', { id }),
    getByHost: ({ host }) => ipcRenderer.invoke('server:getByHost', { host }),
    setActive: (id) => ipcRenderer.send('server:set-active', id),
  },

  qb: {
    login: ({ id, username, password }) =>
      ipcRenderer.invoke('qb:login', { id, username, password }),
    logout: ({ id }) => ipcRenderer.invoke('qb:logout', { id }),
    hasCookie: ({ id }) => ipcRenderer.invoke('qb:has-cookie', { id }),
    request: (payload) => ipcRenderer.invoke('qb:request', payload),
    torrentsAdd: (payload) => ipcRenderer.invoke('qb:torrentsAdd', payload),
    startSyncStream: (payload) => ipcRenderer.send('qb:sync-maindata-stream', payload),
    onSyncChunk: (callback) =>
      makeIpcSubscription(
        'qb:sync-maindata-chunk',
        (p) => p as BitButlerSyncStreamResponse,
        callback,
      ),
  },

  window: {
    maximize: () => ipcRenderer.invoke('window:maximize'),
    unmaximize: () => ipcRenderer.invoke('window:unmaximize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    setSize: (width, height) => ipcRenderer.invoke('window:set-size', width, height),

    setOpenFilesEnabled: (enabled) =>
      ipcRenderer.invoke('window:open-files:set-enabled', !!enabled),

    onOpenFiles: (callback) =>
      makeIpcSubscription(
        'bb:open-files',
        (paths) =>
          Array.isArray(paths)
            ? ((paths as unknown[]).filter((p) => typeof p === 'string') as string[])
            : [],
        callback,
      ),

    onTorrentDrafts: (callback) =>
      makeIpcSubscription(
        'bb:torrent-drafts',
        (drafts) => {
          if (!Array.isArray(drafts)) return [] as TorrentDraft[];
          return (drafts as unknown[]).filter((d) => d && typeof d === 'object') as TorrentDraft[];
        },
        callback,
      ),

    onStateChange: (callback) => {
      const unsubscribe = makeIpcSubscription(
        'window:state-change',
        (state) => state as WindowState,
        callback,
      );
      if (cachedWindowState) {
        try {
          callback(cachedWindowState);
        } catch {}
      }
      return unsubscribe;
    },

    drainOpenFiles: () => ipcRenderer.invoke('window:open-files:drain'),
    drainOpenTorrents: () => ipcRenderer.invoke('window:open-torrents:drain'),
    onOpenBbe: (callback) => makeIpcSubscription('bb:open-bbe', (path) => path as string, callback),
    drainOpenBbe: () => ipcRenderer.invoke('window:open-bbe:drain'),
    simulateOpenFiles: (paths) => ipcRenderer.invoke('window:open-files:simulate', { paths }),
  },

  torrent: {
    parse: (payload) => ipcRenderer.invoke('torrent:parse', payload),
    deleteFile: (payload) => ipcRenderer.invoke('torrent:delete-file', payload),
  },

  menu: {
    onClick: (handler) =>
      makeIpcSubscription(
        'menu:clicked',
        (payload) => (payload ?? {}) as MenuClickPayload,
        handler,
      ),
  },

  notification: {
    show: (payload) => ipcRenderer.invoke('notification:show', payload),
  },

  settings: {
    get: (payload) => ipcRenderer.invoke('settings:get', payload),
    upsert: (payload) => ipcRenderer.invoke('settings:upsert', payload),
    delete: (payload) => ipcRenderer.invoke('settings:delete', payload),
  },

  i18n: {
    languageChanged: (lang) => ipcRenderer.send('i18n:language-changed', { lang }),
  },

  export: {
    start: (payload: ExportStartPayload) => ipcRenderer.send('export:start', payload),
    cancel: () => ipcRenderer.send('export:cancel'),
    openBbePicker: () => ipcRenderer.invoke('export:open-bbe-picker'),
    readBbe: (payload: { path: string }) =>
      ipcRenderer.invoke('export:read-bbe', payload) as Promise<BbeMetadata>,
    importStart: (payload: ImportStartPayload) => ipcRenderer.send('export:import-start', payload),
    importCancel: () => ipcRenderer.send('export:import-cancel'),
    onProgress: (cb: (e: ExportProgressEvent) => void) =>
      makeIpcSubscription('export:progress', (e) => e as ExportProgressEvent, cb),
    onDone: (cb: (e: ExportDoneEvent) => void) =>
      makeIpcSubscription('export:done', (e) => e as ExportDoneEvent, cb),
    onError: (cb: (e: { message: string }) => void) =>
      makeIpcSubscription('export:error', (e) => e as { message: string }, cb),
    onImportProgress: (cb: (e: ExportProgressEvent) => void) =>
      makeIpcSubscription('export:import-progress', (e) => e as ExportProgressEvent, cb),
    onImportDone: (cb: (e: { total: number; skipped: number }) => void) =>
      makeIpcSubscription('export:import-done', (e) => e as { total: number; skipped: number }, cb),
    onImportError: (cb: (e: { message: string }) => void) =>
      makeIpcSubscription('export:import-error', (e) => e as { message: string }, cb),
  },
};

contextBridge.exposeInMainWorld('bitbutler', api);
