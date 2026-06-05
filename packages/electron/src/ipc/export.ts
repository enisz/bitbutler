import type {
  BbeMetadata,
  BbeTorrentEntry,
  BbeTorrentFile,
  ExportDoneEvent,
  ExportProgressEvent,
  ExportStartPayload,
  ImportStartPayload,
} from '@bitbutler/shared';
import AdmZip from 'adm-zip';
import archiver from 'archiver';
import { dialog, ipcMain } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import semver from 'semver';
import { qbRequest } from './qbittorrent.js';

interface QbTorrentInfo {
  hash: string;
  name: string;
  save_path: string;
  category: string;
  tags: string;
  upLimit: number;
  dlLimit: number;
  auto_tmm: boolean;
  ratio_limit: number;
  seeding_time_limit: number;
  inactive_seeding_time_limit: number;
  super_seeding: boolean;
  seq_dl: boolean;
  f_l_piece_prio: boolean;
  state: string;
  magnet_uri: string;
}

interface QbTorrentFile {
  index: number;
  name: string;
  priority: number;
}

let exportCancelled = false;
let importCancelled = false;

const INACTIVE_STATES = new Set(['pausedDL', 'pausedUP', 'stoppedDL', 'stoppedUP']);

export function isActiveState(state: string | undefined): boolean {
  if (!state) return false;
  return !INACTIVE_STATES.has(state);
}

export function applyPathMappings(
  savePath: string,
  mappings: Array<{ from: string; to: string }>,
): string {
  for (const { from, to } of mappings) {
    if (!from) continue;
    if (savePath.startsWith(from)) {
      return to + savePath.slice(from.length);
    }
  }
  return savePath;
}

export function registerExportIpcHandlers(): void {
  ipcMain.on('export:cancel', () => {
    exportCancelled = true;
  });

  ipcMain.on('import:cancel', () => {
    importCancelled = true;
  });

  ipcMain.handle('export:open-bbe-picker', async () => {
    const { filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'BitButler Export', extensions: ['bbe'] }],
    });
    return filePaths[0];
  });

  ipcMain.handle('export:read-bbe', async (_event, { path: bbePath }: { path: string }) => {
    const zip = new AdmZip(bbePath);
    const entry = zip.getEntry('metadata.json');
    if (!entry) throw new Error('Invalid .bbe file: metadata.json not found');
    const metadata = JSON.parse(entry.getData().toString('utf8')) as BbeMetadata;
    if (!Array.isArray(metadata?.torrents)) {
      throw new Error('Invalid .bbe file: metadata.json is malformed');
    }
    return metadata;
  });

  ipcMain.on('export:start', (event, payload: ExportStartPayload) => {
    void runExport(event, payload);
  });

  ipcMain.on('import:start', (event, payload: ImportStartPayload) => {
    void runImport(event, payload);
  });
}

async function runExport(event: Electron.IpcMainEvent, payload: ExportStartPayload): Promise<void> {
  exportCancelled = false;
  const { serverId, hashes, destDir, filename } = payload;

  const send = (channel: string, data: unknown): void => {
    if (!event.sender.isDestroyed()) event.sender.send(channel, data);
  };

  let tmpPath = '';
  try {
    const apiVersion = (await qbRequest({
      id: serverId,
      path: '/api/v2/app/webapiVersion',
    })) as string;
    const isFullMode = semver.gte(apiVersion.trim(), '2.8.3');

    tmpPath = path.join(os.tmpdir(), `bbe-${Date.now()}.zip`);
    const output = fs.createWriteStream(tmpPath);
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(output);

    const outputClosed = new Promise<void>((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
      archive.on('error', reject);
    });

    const entries: BbeTorrentEntry[] = [];
    let skipped = 0;

    for (let i = 0; i < hashes.length; i++) {
      if (exportCancelled) break;

      const hash = hashes[i];
      const entry = await buildExportEntry(serverId, hash, isFullMode, archive);
      entries.push(entry);
      if (entry.failed) skipped++;

      const progress: ExportProgressEvent = {
        current: i + 1,
        total: hashes.length,
        name: entry.name,
        skipped,
      };
      send('export:progress', progress);
    }

    const metadata: BbeMetadata = {
      version: 1,
      exported_at: new Date().toISOString(),
      source_server: serverId,
      export_mode: isFullMode ? 'full' : 'legacy',
      torrents: entries,
    };

    archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });
    await archive.finalize();
    await outputClosed;

    if (exportCancelled) {
      await fs.promises.unlink(tmpPath).catch(() => {});
      return;
    }

    const destPath = path.join(destDir, `${filename}.bbe`);
    await fs.promises.copyFile(tmpPath, destPath);
    await fs.promises.unlink(tmpPath).catch(() => {});

    const done: ExportDoneEvent = { path: destPath, total: hashes.length, skipped };
    send('export:done', done);
  } catch (err) {
    if (tmpPath) await fs.promises.unlink(tmpPath).catch(() => {});
    send('export:error', { message: (err as Error)?.message ?? String(err) });
  }
}

async function buildExportEntry(
  serverId: string,
  hash: string,
  isFullMode: boolean,
  archive: archiver.Archiver,
): Promise<BbeTorrentEntry> {
  try {
    const [infoRes, filesRes] = await Promise.all([
      qbRequest({
        id: serverId,
        path: '/api/v2/torrents/info',
        query: { hashes: hash },
      }) as Promise<QbTorrentInfo[]>,
      qbRequest({ id: serverId, path: '/api/v2/torrents/files', query: { hash } }) as Promise<
        QbTorrentFile[]
      >,
    ]);

    const info = infoRes[0];
    const files: BbeTorrentFile[] = filesRes.map((f) => ({
      index: f.index,
      name: f.name,
      priority: f.priority,
    }));

    if (isFullMode) {
      const torrentBuffer = (await qbRequest({
        id: serverId,
        path: '/api/v2/torrents/export',
        query: { hash },
        responseType: 'buffer',
      })) as Buffer;
      archive.append(torrentBuffer, { name: `torrents/${hash}.torrent` });
    }

    const entry: BbeTorrentEntry = {
      hash,
      name: info.name,
      failed: false,
      save_path: info.save_path,
      category: info.category || undefined,
      tags: info.tags ? info.tags.split(', ').filter(Boolean) : [],
      up_limit: info.upLimit,
      dl_limit: info.dlLimit,
      auto_tmm: info.auto_tmm,
      ratio_limit: info.ratio_limit,
      seeding_time_limit: info.seeding_time_limit,
      inactive_seeding_time_limit: info.inactive_seeding_time_limit,
      super_seeding: info.super_seeding,
      sequential_download: info.seq_dl,
      first_last_piece_prio: info.f_l_piece_prio,
      state: info.state,
      ...(isFullMode ? {} : { magnet_link: info.magnet_uri }),
      files,
    };

    return entry;
  } catch (err) {
    return {
      hash,
      name: hash,
      failed: true,
      error: (err as Error)?.message ?? String(err),
    };
  }
}

async function runImport(
  _event: Electron.IpcMainEvent,
  _payload: ImportStartPayload,
): Promise<void> {
  /* Task 6 */
}
