import { app, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { draftFromPathBuffer } from '../torrents/parse-torrent.js';

const WINDOW_ANIMATE = true;

const CHANNEL_OPEN_FILES = 'bb:open-files';
const CHANNEL_TORRENT_DRAFTS = 'bb:torrent-drafts';

let mainWindowRef = null;

let pendingOpenFiles = [];

let openHandlingEnabled = false;

function getArgStartIndex() {
  if (!app.isPackaged) return 2;
  return 1;
}

/**
 * Extract only existing .torrent files from argv.
 */
function extractExistingTorrentFiles(argv = [], startIndex = 0) {
  const out = [];

  for (const arg of argv.slice(startIndex)) {
    if (!arg || typeof arg !== 'string') continue;
    if (arg.startsWith('-')) continue;

    const cleaned = arg.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
    const resolved = path.isAbsolute(cleaned) ? cleaned : path.resolve(process.cwd(), cleaned);

    try {
      if (!fs.existsSync(resolved)) continue;
      const stat = fs.statSync(resolved);
      if (!stat.isFile()) continue;

      if (path.extname(resolved).toLowerCase() !== '.torrent') continue;

      out.push(resolved);
    } catch {}
  }

  return out;
}

function focusMainWindow() {
  if (!mainWindowRef || mainWindowRef.isDestroyed()) return;

  if (mainWindowRef.isMinimized()) mainWindowRef.restore();
  mainWindowRef.show();
  mainWindowRef.focus();
}

function canSendToRendererNow() {
  return (
    openHandlingEnabled &&
    mainWindowRef &&
    !mainWindowRef.isDestroyed() &&
    mainWindowRef.webContents &&
    !mainWindowRef.webContents.isDestroyed() &&
    !!mainWindowRef.webContents.getURL()
  );
}

function pushOpenFilesToRenderer(paths) {
  const unique = Array.from(new Set((paths ?? []).filter(Boolean)));
  if (!unique.length) return;

  console.log('[BitButler][open-files] push -> renderer (paths):', unique);
  try {
    mainWindowRef.webContents.send(CHANNEL_OPEN_FILES, unique);
  } catch (e) {
    console.error('[BitButler][open-files] Failed to send open-files to renderer.', e);
  }
}

function pushTorrentDraftsToRenderer(drafts) {
  const safe = Array.isArray(drafts) ? drafts.filter(Boolean) : [];
  if (!safe.length) return;

  console.log(
    '[BitButler][open-files] push -> renderer (drafts):',
    safe.map((d) => d?.originalName ?? d?.originalPath),
  );

  try {
    mainWindowRef.webContents.send(CHANNEL_TORRENT_DRAFTS, safe);
  } catch (e) {
    console.error(
      '[BitButler][open-files] Failed to send torrent drafts (structured clone error?).',
      e,
    );
  }
}

function queueOpenFiles(paths, reason) {
  const unique = Array.from(new Set((paths ?? []).filter(Boolean)));
  if (!unique.length) return;

  console.log(`[BitButler][open-files] queued (${reason})`, unique);
  pendingOpenFiles.push(...unique);
}

async function pathsToDrafts(paths, source) {
  const out = [];

  for (const p of paths ?? []) {
    try {
      const buf = await fs.promises.readFile(p);
      const draft = await draftFromPathBuffer(buf, p, source);
      out.push(draft);
    } catch (e) {
      out.push({
        source,
        receivedAt: Date.now(),
        originalPath: p,
        originalName: path.basename(p),
        error: { message: `Failed to read file: ${String(e?.message ?? e)}`, code: 'READ_FAILED' },
      });
    }
  }

  return out;
}

async function handleIncomingOpenFiles(paths, reason) {
  try {
    const unique = Array.from(new Set((paths ?? []).filter(Boolean)));
    if (!unique.length) return;

    console.log(`[BitButler][open-files] received (${reason}):`, unique);

    if (!canSendToRendererNow()) {
      queueOpenFiles(
        unique,
        !openHandlingEnabled ? 'disabled (not logged in)' : 'window not ready',
      );
      return;
    }

    pushOpenFilesToRenderer(unique);

    const source =
      reason === 'startup'
        ? 'startup'
        : reason === 'second-instance'
          ? 'second-instance'
          : reason === 'simulate'
            ? 'simulate'
            : 'unknown';

    const drafts = await pathsToDrafts(unique, source);
    pushTorrentDraftsToRenderer(drafts);
  } catch (e) {
    console.error('[BitButler][open-files] handleIncomingOpenFiles failed', e);
  }
}

async function flushQueueIfPossible() {
  try {
    if (!pendingOpenFiles.length) return;
    if (!canSendToRendererNow()) return;

    const toSend = Array.from(new Set(pendingOpenFiles));
    pendingOpenFiles = [];

    console.log('[BitButler][open-files] flushing queue -> renderer:', toSend);

    pushOpenFilesToRenderer(toSend);

    const drafts = await pathsToDrafts(toSend, 'startup');
    pushTorrentDraftsToRenderer(drafts);
  } catch (e) {
    console.error('[BitButler][open-files] flushQueueIfPossible failed', e);
  }
}

/**
 * ✅ Called by electron-main.js when a second instance is launched with argv
 */
export function handleSecondInstanceArgv(argv) {
  console.log('[BitButler][second-instance] argv:', argv);

  const startIndex = getArgStartIndex();
  const paths = extractExistingTorrentFiles(argv, startIndex);

  void handleIncomingOpenFiles(paths, 'second-instance');
  focusMainWindow();
}

export function registerWindowIpcHandlers(mainWindow) {
  mainWindowRef = mainWindow;

  ipcMain.handle('window:open-files:simulate', async (_e, { paths }) => {
    const safe = Array.isArray(paths)
      ? paths
          .filter((p) => typeof p === 'string' && p.trim())
          .map((p) => p.trim())
          .filter((p) => path.extname(p).toLowerCase() === '.torrent')
      : [];

    void handleIncomingOpenFiles(safe, 'simulate');
    return { ok: true, count: safe.length };
  });

  ipcMain.handle('window:maximize', () => maximize(mainWindow));
  ipcMain.handle('window:unmaximize', () => unmaximize(mainWindow));
  ipcMain.handle('window:toggle-maximize', () => toggleMaximize(mainWindow));
  ipcMain.handle('window:set-size', (_event, width, height) => setSize(mainWindow, width, height));

  ipcMain.handle('window:open-files:set-enabled', async (_e, enabled) => {
    openHandlingEnabled = !!enabled;
    console.log('[BitButler][open-files] set-enabled:', openHandlingEnabled);

    if (openHandlingEnabled) {
      void flushQueueIfPossible();
    }

    return { enabled: openHandlingEnabled };
  });

  ipcMain.handle('window:open-files:drain', async () => {
    const toSend = Array.from(new Set(pendingOpenFiles));
    pendingOpenFiles = [];
    console.log('[BitButler][open-files] drained by renderer (paths):', toSend);
    return toSend;
  });

  ipcMain.handle('window:open-torrents:drain', async () => {
    const toSend = Array.from(new Set(pendingOpenFiles));
    pendingOpenFiles = [];

    console.log('[BitButler][open-files] drained by renderer (drafts):', toSend);
    return pathsToDrafts(toSend, 'startup');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    void flushQueueIfPossible();
  });

  console.log('[BitButler][startup] process.argv:', process.argv);
  const initial = extractExistingTorrentFiles(process.argv, getArgStartIndex());
  void handleIncomingOpenFiles(initial, 'startup');
}

function maximize(mainWindow) {
  console.log('window.js', 'maximize');
  mainWindow.maximize();
}

function unmaximize(mainWindow) {
  mainWindow.unmaximize();
}

function toggleMaximize(mainWindow) {
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
}

function setSize(mainWindow, width, height) {
  console.log('window.js', 'setSize', { width, height });

  if (!Number.isFinite(width) || !Number.isFinite(height)) return;

  if (mainWindow.isFullScreen()) {
    mainWindow.setFullScreen(false);
  }
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  }

  mainWindow.setSize(Math.max(200, width), Math.max(200, height), WINDOW_ANIMATE);
}
