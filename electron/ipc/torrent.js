import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { parseTorrentBufferToDraft } from '../torrents/parse-torrent.js';

export function registerTorrentIpcHandlers() {
  ipcMain.handle('torrent:parse', async (_e, payload) => {
    const source = typeof payload?.source === 'string' ? payload.source : 'manual';

    if (typeof payload?.path === 'string' && payload.path.trim()) {
      const p = payload.path.trim();

      try {
        const buf = await fs.promises.readFile(p);
        return await parseTorrentBufferToDraft(buf, {
          source,
          originalPath: p,
          originalName: path.basename(p),
        });
      } catch (e) {
        return {
          source,
          receivedAt: Date.now(),
          originalPath: p,
          originalName: path.basename(p),
          error: {
            message: `Failed to read file: ${String(e?.message ?? e)}`,
            code: 'READ_FAILED',
          },
        };
      }
    }

    if (Array.isArray(payload?.bytes) && payload.bytes.length) {
      const originalName =
        typeof payload?.originalName === 'string' ? payload.originalName : 'upload.torrent';

      try {
        const buf = Buffer.from(payload.bytes);
        return await parseTorrentBufferToDraft(buf, {
          source,
          originalPath: null,
          originalName,
        });
      } catch (e) {
        return {
          source,
          receivedAt: Date.now(),
          originalPath: null,
          originalName,
          error: { message: String(e?.message ?? e), code: 'PARSE_FAILED' },
        };
      }
    }

    return {
      source,
      receivedAt: Date.now(),
      originalPath: null,
      originalName: null,
      error: { message: 'Invalid payload: expected {path} or {bytes}', code: 'INVALID_PAYLOAD' },
    };
  });
}
