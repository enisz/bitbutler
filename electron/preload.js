const { contextBridge, ipcRenderer } = require('electron');

function makeIpcSubscription(channel, mapPayload, callback) {
  if (typeof callback !== 'function') return () => {};

  const handler = (_event, payload) => {
    try {
      callback(mapPayload(payload));
    } catch (e) {
      console.error(`[preload] handler failed for ${channel}`, e);
    }
  };

  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('bitbutler', {
  electron: {
    isDev: () => ipcRenderer.invoke('electron:is-dev'),
    openExternalUrl: (url) => ipcRenderer.invoke('electron:open-external-url', url),
    showOpenDialog: () => ipcRenderer.invoke('electron:show-open-dialog'),
    openPath: (path) => ipcRenderer.invoke('electron:open-path', path),
    showItemInFolder: (path) => ipcRenderer.invoke('electron:show-item-in-folder', path),
    getPlatform: () => ipcRenderer.invoke('electron:get-platform'),
    checkForUpdate: () => ipcRenderer.invoke('electron:check-for-update'),
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
    login: ({ id }) => ipcRenderer.invoke('qb:login', { id }),
    logout: ({ id }) => ipcRenderer.invoke('qb:logout', { id }),
    hasCookie: ({ id }) => ipcRenderer.invoke('qb:has-cookie', { id }),
    request: (payload) => ipcRenderer.invoke('qb:request', payload),
    torrentsAdd: (payload) => ipcRenderer.invoke('qb:torrentsAdd', payload),
    startSyncStream: (payload) => ipcRenderer.send('qb:sync-maindata-stream', payload),
    onSyncChunk: (callback) => makeIpcSubscription('qb:sync-maindata-chunk', (p) => p, callback),
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
        (paths) => (Array.isArray(paths) ? paths.filter((p) => typeof p === 'string') : []),
        callback,
      ),

    onTorrentDrafts: (callback) =>
      makeIpcSubscription(
        'bb:torrent-drafts',
        (drafts) => {
          if (!Array.isArray(drafts)) return [];
          return drafts.filter((d) => d && typeof d === 'object');
        },
        callback,
      ),

    onStateChange: (callback) =>
      makeIpcSubscription('window:state-change', (state) => state, callback),

    drainOpenFiles: () => ipcRenderer.invoke('window:open-files:drain'),

    drainOpenTorrents: () => ipcRenderer.invoke('window:open-torrents:drain'),
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
        (payload) => (payload && typeof payload === 'object' ? payload : null),
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
});
