import type { TorrentDraft } from '@bitbutler/shared';
import { ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { parseTorrentBufferToDraft } from '../torrents/parse-torrent.js';

export function registerTorrentIpcHandlers(): void {
  ipcMain.handle(
    'torrent:delete-file',
    async (_e, payload: unknown): Promise<{ ok: boolean; error?: string }> => {
      const p = payload as Record<string, unknown>;
      const filePath = typeof p?.path === 'string' ? p.path.trim() : null;
      if (!filePath) return { ok: false, error: 'No path provided' };

      try {
        await fs.promises.unlink(filePath);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String((e as Error)?.message ?? e) };
      }
    },
  );

  ipcMain.handle('torrent:parse', async (_e, payload: unknown): Promise<TorrentDraft> => {
    const p = payload as Record<string, unknown>;
    const source = typeof p?.source === 'string' ? (p.source as TorrentDraft['source']) : 'manual';

    if (typeof p?.path === 'string' && p.path.trim()) {
      const filePath = p.path.trim();

      try {
        const buf = await fs.promises.readFile(filePath);
        return await parseTorrentBufferToDraft(buf, {
          source,
          originalPath: filePath,
          originalName: path.basename(filePath),
        });
      } catch (e) {
        return {
          source,
          receivedAt: Date.now(),
          originalPath: filePath,
          originalName: path.basename(filePath),
          error: {
            message: `Failed to read file: ${String((e as Error)?.message ?? e)}`,
            code: 'READ_FAILED',
          },
        };
      }
    }

    if (Array.isArray(p?.bytes) && (p.bytes as unknown[]).length) {
      const originalName = typeof p?.originalName === 'string' ? p.originalName : 'upload.torrent';

      try {
        const buf = Buffer.from(p.bytes as number[]);
        return await parseTorrentBufferToDraft(buf, {
          source,
          originalPath: null,
          originalName,
        });
      } catch (e) {
        return {
          source,
          receivedAt: Date.now(),
          originalName,
          error: { message: String((e as Error)?.message ?? e), code: 'PARSE_FAILED' },
        };
      }
    }

    return {
      source,
      receivedAt: Date.now(),
      error: { message: 'Invalid payload: expected {path} or {bytes}', code: 'INVALID_PAYLOAD' },
    };
  });
}
