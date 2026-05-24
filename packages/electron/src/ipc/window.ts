import type { TorrentDraft, TorrentDraftSource } from '@bitbutler/shared';
import { app, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { draftFromPathBuffer } from '../torrents/parse-torrent.js';

const WINDOW_ANIMATE = true;

const CHANNEL_OPEN_FILES = 'bb:open-files';
const CHANNEL_TORRENT_DRAFTS = 'bb:torrent-drafts';

let mainWindowRef: Electron.BrowserWindow | null = null;
let pendingOpenFiles: string[] = [];
let openHandlingEnabled = false;

function getArgStartIndex(): number {
  return app.isPackaged ? 1 : 2;
}

function extractExistingTorrentFiles(argv: string[], startIndex = 0): string[] {
  const out: string[] = [];

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

function focusMainWindow(): void {
  if (!mainWindowRef || mainWindowRef.isDestroyed()) return;
  if (mainWindowRef.isMinimized()) mainWindowRef.restore();
  mainWindowRef.show();
  mainWindowRef.focus();
}

function canSendToRendererNow(): boolean {
  return (
    openHandlingEnabled &&
    mainWindowRef !== null &&
    !mainWindowRef.isDestroyed() &&
    mainWindowRef.webContents !== null &&
    !mainWindowRef.webContents.isDestroyed() &&
    !!mainWindowRef.webContents.getURL()
  );
}

function pushOpenFilesToRenderer(paths: string[]): void {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (!unique.length || !mainWindowRef) return;

  try {
    mainWindowRef.webContents.send(CHANNEL_OPEN_FILES, unique);
  } catch (e) {
    console.error('[BitButler][open-files] Failed to send open-files to renderer.', e);
  }
}

function pushTorrentDraftsToRenderer(drafts: TorrentDraft[]): void {
  const safe = Array.isArray(drafts) ? drafts.filter(Boolean) : [];
  if (!safe.length || !mainWindowRef) return;

  try {
    mainWindowRef.webContents.send(CHANNEL_TORRENT_DRAFTS, safe);
  } catch (e) {
    console.error('[BitButler][open-files] Failed to send torrent drafts.', e);
  }
}

function queueOpenFiles(paths: string[]): void {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (!unique.length) return;
  pendingOpenFiles.push(...unique);
}

async function pathsToDrafts(paths: string[], source: TorrentDraftSource): Promise<TorrentDraft[]> {
  const out: TorrentDraft[] = [];

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
        error: {
          message: `Failed to read file: ${String((e as Error)?.message ?? e)}`,
          code: 'READ_FAILED',
        },
      });
    }
  }

  return out;
}

async function handleIncomingOpenFiles(paths: string[], reason: string): Promise<void> {
  try {
    const unique = Array.from(new Set(paths.filter(Boolean)));
    if (!unique.length) return;

    if (!canSendToRendererNow()) {
      queueOpenFiles(unique);
      return;
    }

    pushOpenFilesToRenderer(unique);

    const source: TorrentDraftSource =
      reason === 'startup'
        ? 'startup'
        : reason === 'second-instance'
          ? 'second-instance'
          : 'renderer';

    const drafts = await pathsToDrafts(unique, source);
    pushTorrentDraftsToRenderer(drafts);
  } catch (e) {
    console.error('[BitButler][open-files] handleIncomingOpenFiles failed', e);
  }
}

async function flushQueueIfPossible(): Promise<void> {
  try {
    if (!pendingOpenFiles.length) return;
    if (!canSendToRendererNow()) return;

    const toSend = Array.from(new Set(pendingOpenFiles));
    pendingOpenFiles = [];
    pushOpenFilesToRenderer(toSend);

    const drafts = await pathsToDrafts(toSend, 'startup');
    pushTorrentDraftsToRenderer(drafts);
  } catch (e) {
    console.error('[BitButler][open-files] flushQueueIfPossible failed', e);
  }
}

export function handleSecondInstanceArgv(argv: string[]): void {
  const startIndex = getArgStartIndex();
  const paths = extractExistingTorrentFiles(argv, startIndex);
  void handleIncomingOpenFiles(paths, 'second-instance');
  focusMainWindow();
}

export function registerWindowIpcHandlers(mainWindow: Electron.BrowserWindow): void {
  mainWindowRef = mainWindow;

  ipcMain.handle('window:open-files:simulate', async (_e, { paths }: { paths: string[] }) => {
    const safe = Array.isArray(paths)
      ? paths
          .filter((p) => typeof p === 'string' && p.trim())
          .map((p) => p.trim())
          .filter((p) => path.extname(p).toLowerCase() === '.torrent')
      : [];

    void handleIncomingOpenFiles(safe, 'simulate');
    return { ok: true, count: safe.length };
  });

  ipcMain.handle('window:maximize', () => mainWindow.maximize());
  ipcMain.handle('window:unmaximize', () => mainWindow.unmaximize());
  ipcMain.handle('window:toggle-maximize', () =>
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize(),
  );
  ipcMain.handle('window:set-size', (_event, width: number, height: number) =>
    setSize(mainWindow, width, height),
  );

  ipcMain.handle('window:open-files:set-enabled', async (_e, enabled: boolean) => {
    openHandlingEnabled = !!enabled;
    if (openHandlingEnabled) void flushQueueIfPossible();
    return { enabled: openHandlingEnabled };
  });

  ipcMain.handle('window:open-files:drain', async () => {
    const toSend = Array.from(new Set(pendingOpenFiles));
    pendingOpenFiles = [];
    return toSend;
  });

  ipcMain.handle('window:open-torrents:drain', async () => {
    const toSend = Array.from(new Set(pendingOpenFiles));
    pendingOpenFiles = [];
    return pathsToDrafts(toSend, 'startup');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    void flushQueueIfPossible();
  });

  const initial = extractExistingTorrentFiles(process.argv, getArgStartIndex());
  void handleIncomingOpenFiles(initial, 'startup');
}

function setSize(mainWindow: Electron.BrowserWindow, width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return;

  if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false);
  if (mainWindow.isMaximized()) mainWindow.unmaximize();

  mainWindow.setSize(Math.max(200, width), Math.max(200, height), WINDOW_ANIMATE);
}
