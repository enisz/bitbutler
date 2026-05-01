import type { TorrentDraft, TorrentDraftSource } from '@bitbutler/shared';
import parseTorrent from 'parse-torrent';
import path from 'path';

interface ParseMeta {
  source: TorrentDraftSource;
  originalPath: string | null;
  originalName: string | null;
}

function norm(p: unknown): string {
  return String(p ?? '').replace(/\\/g, '/');
}

export async function parseTorrentBufferToDraft(
  buffer: Buffer,
  meta: ParseMeta,
): Promise<TorrentDraft> {
  try {
    const parsed = await Promise.resolve(parseTorrent(buffer));

    const files = Array.isArray(parsed?.files)
      ? parsed.files.map((f, i) => ({
          path: norm(f.path),
          length: Number(f.length ?? 0),
          index: i,
        }))
      : [];

    const totalSize =
      typeof parsed?.length === 'number'
        ? parsed.length
        : files.reduce((s, f) => s + (f.length || 0), 0);

    const trackers: string[] = [];

    if (typeof parsed?.announce === 'string') trackers.push(parsed.announce);

    if (Array.isArray(parsed?.announce)) {
      for (const u of parsed.announce) {
        if (typeof u === 'string') trackers.push(u);
      }
    }

    if (Array.isArray(parsed?.announceList)) {
      for (const tier of parsed.announceList) {
        if (!Array.isArray(tier)) continue;
        for (const u of tier) {
          if (typeof u === 'string') trackers.push(u);
        }
      }
    }

    const uniqTrackers = Array.from(new Set(trackers)).filter(Boolean);

    const name =
      (typeof parsed?.name === 'string' && parsed.name) || meta.originalName || 'Unknown torrent';

    const infoHashV1 = typeof parsed?.infoHash === 'string' ? parsed.infoHash : undefined;
    const infoHashV2 = typeof parsed?.infoHashV2 === 'string' ? parsed.infoHashV2 : undefined;
    const isPrivate = typeof parsed?.private === 'boolean' ? parsed.private : undefined;

    return {
      source: meta.source,
      receivedAt: Date.now(),
      originalPath: meta.originalPath ?? undefined,
      originalName: meta.originalName ?? undefined,
      torrent: {
        name,
        totalSize,
        files,
        trackers: uniqTrackers,
        infoHashV1,
        infoHashV2,
        isPrivate,
      },
    };
  } catch (e) {
    console.error('[BitButler][torrent-parse] ERROR:', e);
    return {
      source: meta.source,
      receivedAt: Date.now(),
      originalPath: meta.originalPath ?? undefined,
      originalName: meta.originalName ?? undefined,
      error: {
        message: String((e as Error)?.message ?? e),
        code: 'PARSE_FAILED',
      },
    };
  }
}

export async function draftFromPathBuffer(
  buffer: Buffer,
  filePath: string,
  source: TorrentDraftSource,
): Promise<TorrentDraft> {
  return parseTorrentBufferToDraft(buffer, {
    source,
    originalPath: filePath,
    originalName: path.basename(filePath),
  });
}
