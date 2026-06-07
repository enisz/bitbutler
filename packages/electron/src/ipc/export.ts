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
import FormData from 'form-data';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

export async function collectCategoriesAndTags(serverId: string): Promise<{
  categories: Record<string, { name: string; savePath: string }>;
  tags: string[];
}> {
  const [categories, tags] = await Promise.all([
    qbRequest({ id: serverId, path: '/api/v2/torrents/categories' }) as Promise<
      Record<string, { name: string; savePath: string }>
    >,
    qbRequest({ id: serverId, path: '/api/v2/torrents/tags' }) as Promise<string[]>,
  ]);

  return { categories, tags };
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

  ipcMain.handle('export:get-server-info', async (_event, { serverId }: { serverId: string }) => {
    const [webapiVersion, qbVersion, isFullMode] = await Promise.all([
      qbRequest({ id: serverId, path: '/api/v2/app/webapiVersion' }) as Promise<string>,
      qbRequest({ id: serverId, path: '/api/v2/app/version' }) as Promise<string>,
      probeFullMode(serverId),
    ]);
    return { webapiVersion: webapiVersion.trim(), qbVersion: qbVersion.trim(), isFullMode };
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
  const { serverId, serverName, hashes, destDir, filename } = payload;

  const send = (channel: string, data: unknown): void => {
    if (!event.sender.isDestroyed()) event.sender.send(channel, data);
  };

  let tmpPath = '';
  try {
    const isFullMode = await probeFullMode(serverId);

    tmpPath = path.join(os.tmpdir(), `bbe-${Date.now()}.zip`);
    const output = fs.createWriteStream(tmpPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
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

    const { categories, tags } = await collectCategoriesAndTags(serverId);

    const metadata: BbeMetadata = {
      version: 1,
      exported_at: Math.floor(Date.now() / 1000),
      source_server: serverId,
      source_server_name: serverName,
      export_mode: isFullMode ? 'full' : 'legacy',
      torrents: entries,
      categories,
      tags,
    };

    archive.append(JSON.stringify(metadata), { name: 'metadata.json' });
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

async function runImport(event: Electron.IpcMainEvent, payload: ImportStartPayload): Promise<void> {
  importCancelled = false;
  const { serverId, bbePath, restoreFields, startMode, pathMappings } = payload;

  const send = (channel: string, data: unknown): void => {
    if (!event.sender.isDestroyed()) event.sender.send(channel, data);
  };

  try {
    const zip = new AdmZip(bbePath);
    const metaEntry = zip.getEntry('metadata.json');
    if (!metaEntry) throw new Error('Invalid .bbe: metadata.json not found');
    const metadata = JSON.parse(metaEntry.getData().toString('utf8')) as BbeMetadata;

    const torrents = metadata.torrents.filter((t) => !t.failed);
    let skipped = 0;

    // Phase 1: add all torrents as fast as possible
    const addedHashes: string[] = [];
    for (let i = 0; i < torrents.length; i++) {
      if (importCancelled) break;

      const entry = torrents[i];
      try {
        await addTorrent(serverId, entry, metadata.export_mode, zip, restoreFields, pathMappings);
        addedHashes.push(entry.hash);
      } catch {
        skipped++;
      }

      send('import:progress', {
        current: i + 1,
        total: torrents.length,
        name: entry.name,
        skipped,
      } satisfies ExportProgressEvent);
    }

    // Phase 2: wait for all added hashes to appear in qBittorrent
    const needsPostProcess =
      addedHashes.length > 0 &&
      (restoreFields.some((f) =>
        (
          ['renames', 'priorities', 'speed_limits', 'share_limits', 'super_seeding'] as const
        ).includes(f),
      ) ||
        startMode !== 'paused');

    const confirmedHashes = new Set<string>();
    if (needsPostProcess && !importCancelled) {
      for (let attempt = 0; attempt < 20; attempt++) {
        await sleep(500);
        if (importCancelled) break;
        const res = (await qbRequest({
          id: serverId,
          path: '/api/v2/torrents/info',
          query: { hashes: addedHashes.join('|') },
        })) as QbTorrentInfo[];
        for (const t of res) confirmedHashes.add(t.hash);
        if (confirmedHashes.size >= addedHashes.length) break;
      }
    }

    // Phase 3: apply settings to confirmed torrents
    for (const entry of torrents) {
      if (importCancelled) break;
      if (!confirmedHashes.has(entry.hash)) continue;
      await applyTorrentSettings(serverId, entry, restoreFields, startMode).catch(() => {});
    }

    send('import:done', { total: torrents.length, skipped });
  } catch (err) {
    send('import:error', { message: (err as Error)?.message ?? String(err) });
  }
}

async function addTorrent(
  serverId: string,
  entry: BbeTorrentEntry,
  exportMode: 'full' | 'legacy',
  zip: AdmZip,
  restoreFields: ImportStartPayload['restoreFields'],
  pathMappings: ImportStartPayload['pathMappings'],
): Promise<void> {
  const has = (field: ImportStartPayload['restoreFields'][number]): boolean =>
    restoreFields.includes(field);

  const resolvedSavePath =
    has('save_path') && entry.save_path
      ? applyPathMappings(entry.save_path, pathMappings)
      : undefined;

  const addOptions: Record<string, unknown> = {
    stopped: 'true',
    paused: 'true',
  };

  if (resolvedSavePath) addOptions['savepath'] = resolvedSavePath;
  if (has('category_tags') && entry.category) addOptions['category'] = entry.category;
  if (has('category_tags') && entry.tags?.length) addOptions['tags'] = entry.tags.join(',');
  if (has('auto_tmm')) addOptions['autoTMM'] = String(entry.auto_tmm ?? false);
  if (has('sequential_download'))
    addOptions['sequentialDownload'] = String(entry.sequential_download ?? false);
  if (has('first_last_piece_prio'))
    addOptions['firstLastPiecePrio'] = String(entry.first_last_piece_prio ?? false);

  if (exportMode === 'full') {
    const torrentEntry = zip.getEntry(`torrents/${entry.hash}.torrent`);
    if (!torrentEntry) throw new Error(`Missing torrent file for hash ${entry.hash}`);
    const torrentBuffer = torrentEntry.getData();
    const { headers, body } = buildAddFormData(torrentBuffer, entry.hash, addOptions);
    await qbRequest({ id: serverId, method: 'POST', path: '/api/v2/torrents/add', headers, body });
  } else {
    if (!entry.magnet_link) throw new Error(`No magnet link for hash ${entry.hash}`);
    await qbRequest({
      id: serverId,
      method: 'POST',
      path: '/api/v2/torrents/add',
      form: { urls: entry.magnet_link, ...flattenStringRecord(addOptions) },
    });
  }
}

async function applyTorrentSettings(
  serverId: string,
  entry: BbeTorrentEntry,
  restoreFields: ImportStartPayload['restoreFields'],
  startMode: ImportStartPayload['startMode'],
): Promise<void> {
  const has = (field: ImportStartPayload['restoreFields'][number]): boolean =>
    restoreFields.includes(field);

  // Fetch file tree (needed for renames and priorities)
  let baseFiles: QbTorrentFile[] = [];
  if (has('renames') || has('priorities')) {
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt > 0) await sleep(300);
      const res = (await qbRequest({
        id: serverId,
        path: '/api/v2/torrents/files',
        query: { hash: entry.hash },
      })) as QbTorrentFile[];
      if (res?.length) {
        baseFiles = res;
        break;
      }
    }
  }

  // Apply renames
  if (has('renames') && entry.files?.length && baseFiles.length) {
    for (const saved of entry.files) {
      const base = baseFiles.find((f) => f.index === saved.index);
      if (base && base.name !== saved.name) {
        await qbRequest({
          id: serverId,
          method: 'POST',
          path: '/api/v2/torrents/renameFile',
          form: { hash: entry.hash, oldPath: base.name, newPath: saved.name },
        }).catch(() => {});
      }
    }
  }

  // Apply file priorities
  if (has('priorities') && entry.files?.length) {
    const byPriority = new Map<number, number[]>();
    for (const f of entry.files) {
      const list = byPriority.get(f.priority) ?? [];
      list.push(f.index);
      byPriority.set(f.priority, list);
    }
    for (const [priority, indices] of byPriority) {
      await qbRequest({
        id: serverId,
        method: 'POST',
        path: '/api/v2/torrents/filePrio',
        form: { hash: entry.hash, id: indices.join('|'), priority: String(priority) },
      }).catch(() => {});
    }
  }

  // Apply speed limits
  if (has('speed_limits')) {
    if (entry.up_limit !== undefined) {
      await qbRequest({
        id: serverId,
        method: 'POST',
        path: '/api/v2/torrents/setUploadLimit',
        form: { hashes: entry.hash, limit: String(entry.up_limit) },
      }).catch(() => {});
    }
    if (entry.dl_limit !== undefined) {
      await qbRequest({
        id: serverId,
        method: 'POST',
        path: '/api/v2/torrents/setDownloadLimit',
        form: { hashes: entry.hash, limit: String(entry.dl_limit) },
      }).catch(() => {});
    }
  }

  // Apply share limits
  if (has('share_limits')) {
    await qbRequest({
      id: serverId,
      method: 'POST',
      path: '/api/v2/torrents/setShareLimits',
      form: {
        hashes: entry.hash,
        ratioLimit: String(entry.ratio_limit ?? -1),
        seedingTimeLimit: String(entry.seeding_time_limit ?? -1),
        inactiveSeedingTimeLimit: String(entry.inactive_seeding_time_limit ?? -1),
      },
    }).catch(() => {});
  }

  // Apply super seeding
  if (has('super_seeding') && entry.super_seeding !== undefined) {
    await qbRequest({
      id: serverId,
      method: 'POST',
      path: '/api/v2/torrents/setSuperSeeding',
      form: { hashes: entry.hash, value: String(entry.super_seeding) },
    }).catch(() => {});
  }

  // Resume if applicable
  const shouldResume =
    startMode === 'all' || (startMode === 'active' && isActiveState(entry.state));
  if (shouldResume) {
    await qbRequest({
      id: serverId,
      method: 'POST',
      path: '/api/v2/torrents/resume',
      form: { hashes: entry.hash },
    }).catch(() => {});
  }
}

async function probeFullMode(serverId: string): Promise<boolean> {
  try {
    await qbRequest({ id: serverId, path: '/api/v2/torrents/export', responseType: 'buffer' });
    return true;
  } catch (err) {
    try {
      const { status } = JSON.parse(err as string) as { status?: number };
      return status !== 404;
    } catch {
      return false;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function flattenStringRecord(obj: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) out[k] = String(v);
  }
  return out;
}

function buildAddFormData(
  torrentBuffer: Buffer,
  hash: string,
  options: Record<string, unknown>,
): { headers: Record<string, string>; body: Buffer } {
  const fd = new FormData();
  fd.append('torrents', torrentBuffer, { filename: `${hash}.torrent` });
  for (const [k, v] of Object.entries(options)) {
    if (v !== undefined && v !== null) fd.append(k, String(v));
  }
  const body = fd.getBuffer();
  const headers = {
    ...fd.getHeaders(),
    'Content-Length': String(body.length),
  };
  return { headers, body };
}
