import type {
  BbeMetadata,
  BbePathMapping,
  BbeTorrentEntry,
  BbeTorrentFile,
  ExportDoneEvent,
  ExportProgressEvent,
  ExportStartPayload,
  ExportTorrentFileItem,
  ExportTorrentFilesResult,
  ImportProgressEvent,
  ImportRestoreField,
  ImportStartPayload,
  QbTorrentContent,
} from '@bitbutler/shared';
import AdmZip from 'adm-zip';
import archiver from 'archiver';
import { dialog, ipcMain } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { QbBridgeError } from '../qb/errors.js';
import * as labels from '../qb/labels.js';
import { refreshServerInfo, resolveFullMode } from '../qb/server-info.js';
import * as details from '../qb/torrent-details.js';
import { setSuperSeeding, start } from '../qb/torrents.js';

// Info-hash v1 (40) or v2 (64) in hex; anything else from a .bbe file is not trusted.
const INFO_HASH_RE = /^[0-9a-f]{40}([0-9a-f]{24})?$/i;

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
    labels.categories(serverId),
    labels.tags(serverId),
  ]);

  return { categories, tags };
}

export function filterAssignedCategories(
  categories: Record<string, { name: string; savePath: string }>,
  entries: BbeTorrentEntry[],
): Record<string, { name: string; savePath: string }> {
  const assigned = new Set(entries.map((e) => e.category).filter((c): c is string => !!c));
  return Object.fromEntries(Object.entries(categories).filter(([name]) => assigned.has(name)));
}

export function filterAssignedTags(tags: string[], entries: BbeTorrentEntry[]): string[] {
  const assigned = new Set(entries.flatMap((e) => e.tags ?? []));
  return tags.filter((tag) => assigned.has(tag));
}

export function partitionImportEntries(
  torrents: BbeTorrentEntry[],
  skipHashes: string[],
): { toProcess: BbeTorrentEntry[]; alreadyExisted: BbeTorrentEntry[] } {
  const skipSet = new Set(skipHashes.map((h) => h.toLowerCase()));
  const toProcess: BbeTorrentEntry[] = [];
  const alreadyExisted: BbeTorrentEntry[] = [];
  for (const entry of torrents) {
    if (skipSet.has(entry.hash.toLowerCase())) {
      alreadyExisted.push(entry);
    } else {
      toProcess.push(entry);
    }
  }
  return { toProcess, alreadyExisted };
}

export async function restoreCategoriesAndTags(
  serverId: string,
  metadata: Pick<BbeMetadata, 'categories' | 'tags'>,
  restoreCategories: boolean,
  restoreTags: boolean,
  categoryPathMappings: BbePathMapping[],
  overwriteCategories: boolean,
): Promise<void> {
  if (restoreTags && metadata.tags?.length) {
    await labels.createTags(serverId, metadata.tags).catch((err) => {
      console.warn('[BitButler][export] Failed to restore tags during import.', err);
    });
  }

  if (restoreCategories && metadata.categories) {
    const existing: Record<string, { name: string; savePath: string }> = await labels
      .categories(serverId)
      .catch(() => ({}));

    for (const [name, category] of Object.entries(metadata.categories)) {
      const mappedPath = applyPathMappings(category.savePath, categoryPathMappings);

      if (!(name in existing)) {
        await labels.createCategory(serverId, name, mappedPath).catch((err) => {
          console.warn(
            `[BitButler][export] Failed to create category '${name}' during import.`,
            err,
          );
        });
      } else if (overwriteCategories) {
        await labels.editCategory(serverId, name, mappedPath).catch((err) => {
          console.warn(`[BitButler][export] Failed to edit category '${name}' during import.`, err);
        });
      }
    }
  }
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
    return refreshServerInfo(serverId);
  });

  ipcMain.handle(
    'export:save-torrent-files',
    async (_event, payload: { serverId: string; items: ExportTorrentFileItem[] }) =>
      saveTorrentFiles(payload),
  );

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
  const { serverId, serverName, hashes, destDir, filename, categoryScope, tagScope } = payload;

  const send = (channel: string, data: unknown): void => {
    if (!event.sender.isDestroyed()) event.sender.send(channel, data);
  };

  let tmpPath = '';
  try {
    const isFullMode = await resolveFullMode(serverId);

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

    const { categories: allCategories, tags: allTags } = await collectCategoriesAndTags(serverId);
    const categories =
      categoryScope === 'assigned'
        ? filterAssignedCategories(allCategories, entries)
        : allCategories;
    const tags = tagScope === 'assigned' ? filterAssignedTags(allTags, entries) : allTags;

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

    const { size: fileSize } = await fs.promises.stat(destPath);

    const done: ExportDoneEvent = {
      path: destPath,
      total: hashes.length,
      skipped,
      categories: Object.keys(categories).length,
      tags: tags.length,
      fileSize,
    };
    send('export:done', done);
  } catch (err) {
    if (tmpPath) await fs.promises.unlink(tmpPath).catch(() => {});
    send('export:error', { message: (err as Error)?.message ?? String(err) });
  }
}

function sanitizeFilename(name: string): string {
  return (name || 'torrent').replace(/[\\/:*?"<>|]/g, '_').trim() || 'torrent';
}

function describeExportError(err: unknown): string {
  if (err instanceof QbBridgeError && err.status) return `${err.status} ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}

async function saveTorrentFiles(payload: {
  serverId: string;
  items: ExportTorrentFileItem[];
}): Promise<ExportTorrentFilesResult> {
  const { serverId, items } = payload;
  if (items.length === 0) return { cancelled: true, savedPaths: [], failed: [] };

  if (items.length === 1) {
    const { hash, name } = items[0];
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: `${sanitizeFilename(name)}.torrent`,
      filters: [{ name: 'Torrent files', extensions: ['torrent'] }],
    });
    if (canceled || !filePath) return { cancelled: true, savedPaths: [], failed: [] };

    try {
      const buffer = await details.exportTorrentFile(serverId, hash);
      await fs.promises.writeFile(filePath, buffer);
      return { cancelled: false, savedPaths: [filePath], failed: [] };
    } catch (err) {
      return {
        cancelled: false,
        savedPaths: [],
        failed: [{ hash, name, error: describeExportError(err) }],
      };
    }
  }

  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (canceled || !filePaths[0]) return { cancelled: true, savedPaths: [], failed: [] };
  const dir = filePaths[0];

  const usedNames = new Set<string>();
  const savedPaths: string[] = [];
  const failed: { hash: string; name: string; error: string }[] = [];

  for (const { hash, name } of items) {
    const base = sanitizeFilename(name);
    let filename = `${base}.torrent`;
    if (usedNames.has(filename)) filename = `${base}-${hash.slice(0, 8)}.torrent`;
    usedNames.add(filename);

    try {
      const buffer = await details.exportTorrentFile(serverId, hash);
      const fullPath = path.join(dir, filename);
      await fs.promises.writeFile(fullPath, buffer);
      savedPaths.push(fullPath);
    } catch (err) {
      failed.push({ hash, name, error: describeExportError(err) });
    }
  }

  return { cancelled: false, savedPaths, failed };
}

async function buildExportEntry(
  serverId: string,
  hash: string,
  isFullMode: boolean,
  archive: archiver.Archiver,
): Promise<BbeTorrentEntry> {
  try {
    const [info, filesRes] = await Promise.all([
      details.info(serverId, hash),
      details.files(serverId, hash),
    ]);
    if (!info) throw new Error(`Torrent ${hash} not found.`);

    const files: BbeTorrentFile[] = filesRes.map((f) => ({
      index: f.index,
      name: f.name,
      priority: f.priority,
    }));

    if (isFullMode) {
      const torrentBuffer = await details.exportTorrentFile(serverId, hash);
      archive.append(torrentBuffer, { name: `torrents/${hash}.torrent` });
    }

    const entry: BbeTorrentEntry = {
      hash,
      name: info.name,
      failed: false,
      save_path: info.save_path,
      category: info.category || undefined,
      tags: info.tags ? info.tags.split(', ').filter(Boolean) : [],
      up_limit: info.up_limit,
      dl_limit: info.dl_limit,
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
    console.warn(`[BitButler][export] Failed to export torrent ${hash}.`, err);
    return {
      hash,
      name: hash,
      failed: true,
      error: (err as Error)?.message ?? String(err),
    };
  }
}

export async function runImport(
  event: Electron.IpcMainEvent,
  payload: ImportStartPayload,
): Promise<void> {
  importCancelled = false;
  const {
    serverId,
    bbePath,
    restoreFields,
    startMode,
    pathMappings,
    restoreCategories,
    restoreTags,
    categoryPathMappings,
    overwriteCategories,
    skipHashes,
  } = payload;

  const send = (channel: string, data: unknown): void => {
    if (!event.sender.isDestroyed()) event.sender.send(channel, data);
  };

  try {
    const zip = new AdmZip(bbePath);
    const metaEntry = zip.getEntry('metadata.json');
    if (!metaEntry) throw new Error('Invalid .bbe: metadata.json not found');
    const metadata = JSON.parse(metaEntry.getData().toString('utf8')) as BbeMetadata;

    const { toProcess, alreadyExisted } = partitionImportEntries(
      metadata.torrents.filter((t) => !t.failed),
      skipHashes,
    );
    let failed = 0;

    if (!importCancelled) {
      await restoreCategoriesAndTags(
        serverId,
        metadata,
        restoreCategories,
        restoreTags,
        categoryPathMappings,
        overwriteCategories,
      );
    }

    const addedHashes: string[] = [];
    for (let i = 0; i < toProcess.length; i++) {
      if (importCancelled) break;

      const entry = toProcess[i];
      let success = true;
      try {
        if (!INFO_HASH_RE.test(entry.hash)) {
          console.warn(
            `[BitButler][export] Skipping '${entry.name}': invalid info hash ${JSON.stringify(entry.hash)} in the .bbe file.`,
          );
          throw new Error('Invalid info hash in the .bbe file.');
        }
        await addTorrent(serverId, entry, metadata.export_mode, zip, restoreFields, pathMappings);
        addedHashes.push(entry.hash);
      } catch {
        failed++;
        success = false;
      }

      send('import:progress', {
        current: i + 1,
        total: toProcess.length,
        name: entry.name,
        hash: entry.hash,
        success,
      } satisfies ImportProgressEvent);
    }

    const needsPostProcess =
      addedHashes.length > 0 &&
      (restoreFields.some((f) =>
        (
          [
            'save_path',
            'categories',
            'tags',
            'renames',
            'priorities',
            'speed_limits',
            'share_limits',
            'super_seeding',
          ] as ImportRestoreField[]
        ).includes(f),
      ) ||
        startMode !== 'paused');

    const confirmedHashes = new Set<string>();
    const addedSet = new Set(addedHashes.map((h) => h.toLowerCase()));
    if (needsPostProcess && addedHashes.length > 0 && !importCancelled) {
      for (let attempt = 0; attempt < 20; attempt++) {
        await sleep(500);
        if (importCancelled) break;
        const res = await details.infoByHashes(serverId, addedHashes);
        for (const t of res) {
          const h = (t.hash ?? '').toLowerCase();
          if (addedSet.has(h)) confirmedHashes.add(h);
        }
        if (confirmedHashes.size >= addedHashes.length) break;
      }
    }

    for (const entry of toProcess) {
      if (importCancelled) break;
      if (!confirmedHashes.has(entry.hash.toLowerCase())) continue;
      await applyTorrentSettings(serverId, entry, restoreFields, startMode, pathMappings).catch(
        () => {},
      );
    }

    send('import:done', { total: toProcess.length, failed, alreadyExisted: alreadyExisted.length });
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

  // addTorrent mirrors `paused` into `stopped`, so both qBittorrent generations add it stopped.
  const addOptions: Record<string, unknown> = { paused: 'true' };

  if (resolvedSavePath) addOptions['savepath'] = resolvedSavePath;
  if (has('categories') && entry.category) addOptions['category'] = entry.category;
  if (has('tags') && entry.tags?.length) addOptions['tags'] = entry.tags.join(',');
  if (has('auto_tmm')) addOptions['autoTMM'] = String(entry.auto_tmm ?? false);
  if (has('sequential_download'))
    addOptions['sequentialDownload'] = String(entry.sequential_download ?? false);
  if (has('first_last_piece_prio'))
    addOptions['firstLastPiecePrio'] = String(entry.first_last_piece_prio ?? false);

  if (exportMode === 'full') {
    const torrentEntry = zip.getEntry(`torrents/${entry.hash}.torrent`);
    if (!torrentEntry) throw new Error(`Missing torrent file for hash ${entry.hash}`);
    const torrentBuffer = torrentEntry.getData();
    await details.addTorrent(serverId, {
      torrents: [{ name: `${entry.hash}.torrent`, bytes: Array.from(torrentBuffer) }],
      options: addOptions,
    });
  } else {
    if (!entry.magnet_link) throw new Error(`No magnet link for hash ${entry.hash}`);
    await details.addTorrent(serverId, {
      torrents: [],
      urls: [entry.magnet_link],
      options: addOptions,
    });
  }
}

async function applyTorrentSettings(
  serverId: string,
  entry: BbeTorrentEntry,
  restoreFields: ImportStartPayload['restoreFields'],
  startMode: ImportStartPayload['startMode'],
  pathMappings: ImportStartPayload['pathMappings'],
): Promise<void> {
  const has = (field: ImportStartPayload['restoreFields'][number]): boolean =>
    restoreFields.includes(field);

  if (has('save_path') && entry.save_path) {
    await details
      .setLocation(serverId, [entry.hash], applyPathMappings(entry.save_path, pathMappings))
      .catch((err) => {
        console.warn(`[BitButler][export] Failed to restore save_path for ${entry.hash}.`, err);
      });
  }

  if (has('categories') && entry.category) {
    await labels.setCategory(serverId, [entry.hash], entry.category).catch((err) => {
      console.warn(`[BitButler][export] Failed to restore category for ${entry.hash}.`, err);
    });
  }

  if (has('tags')) {
    await labels.removeAllTags(serverId, [entry.hash]).catch((err) => {
      console.warn(`[BitButler][export] Failed to clear tags for ${entry.hash}.`, err);
    });
    if (entry.tags?.length) {
      await labels.addTags(serverId, [entry.hash], entry.tags).catch((err) => {
        console.warn(`[BitButler][export] Failed to restore tags for ${entry.hash}.`, err);
      });
    }
  }

  let baseFiles: QbTorrentContent[] = [];
  if (has('renames') || has('priorities')) {
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt > 0) await sleep(300);
      const res = await details.files(serverId, entry.hash);
      if (res?.length) {
        baseFiles = res;
        break;
      }
    }
  }

  if (has('renames') && entry.files?.length && baseFiles.length) {
    for (const saved of entry.files) {
      const base = baseFiles.find((f) => f.index === saved.index);
      if (base && base.name !== saved.name) {
        await details.renameFile(serverId, entry.hash, base.name, saved.name).catch((err) => {
          console.warn(`[BitButler][export] Failed to rename file for ${entry.hash}.`, err);
        });
      }
    }
  }

  if (has('priorities') && entry.files?.length) {
    const byPriority = new Map<number, number[]>();
    for (const f of entry.files) {
      const list = byPriority.get(f.priority) ?? [];
      list.push(f.index);
      byPriority.set(f.priority, list);
    }
    for (const [priority, indices] of byPriority) {
      await details.filePrio(serverId, entry.hash, indices, priority).catch((err) => {
        console.warn(
          `[BitButler][export] Failed to restore file priorities for ${entry.hash}.`,
          err,
        );
      });
    }
  }

  if (has('speed_limits')) {
    if (entry.up_limit !== undefined) {
      await details.setUploadLimit(serverId, entry.up_limit, [entry.hash]).catch((err) => {
        console.warn(`[BitButler][export] Failed to restore upload limit for ${entry.hash}.`, err);
      });
    }
    if (entry.dl_limit !== undefined) {
      await details.setDownloadLimit(serverId, entry.dl_limit, [entry.hash]).catch((err) => {
        console.warn(
          `[BitButler][export] Failed to restore download limit for ${entry.hash}.`,
          err,
        );
      });
    }
  }

  if (has('share_limits')) {
    await details
      .setShareLimits(
        serverId,
        [entry.hash],
        entry.ratio_limit ?? -1,
        entry.seeding_time_limit ?? -1,
        entry.inactive_seeding_time_limit ?? -1,
      )
      .catch((err) => {
        console.warn(`[BitButler][export] Failed to restore share limits for ${entry.hash}.`, err);
      });
  }

  if (has('super_seeding') && entry.super_seeding !== undefined) {
    await setSuperSeeding(serverId, [entry.hash], entry.super_seeding).catch((err) => {
      console.warn(`[BitButler][export] Failed to restore super-seeding for ${entry.hash}.`, err);
    });
  }

  const shouldResume =
    startMode === 'all' || (startMode === 'active' && isActiveState(entry.state));
  if (shouldResume) {
    await start(serverId, [entry.hash]).catch((err) => {
      console.warn(`[BitButler][export] Failed to resume ${entry.hash} after import.`, err);
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
