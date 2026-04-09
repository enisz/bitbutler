import parseTorrent from 'parse-torrent';
import path from 'path';

function norm(p) {
  return String(p ?? '').replace(/\\/g, '/');
}

export async function parseTorrentBufferToDraft(buffer, meta) {
  try {
    const parsed = await Promise.resolve(parseTorrent(buffer));

    const files = Array.isArray(parsed?.files)
      ? parsed.files.map((f) => ({
          path: norm(f.path),
          length: Number(f.length ?? 0),
        }))
      : [];

    const totalSize =
      typeof parsed?.length === 'number'
        ? parsed.length
        : files.reduce((s, f) => s + (f.length || 0), 0);

    const trackers = [];

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

    console.log('\n[BitButler][torrent-parse] Normalized summary:');
    console.log({
      name,
      singleFileLength: typeof parsed?.length === 'number' ? parsed.length : undefined,
      multiFileCount: files.length,
      totalSize,
      trackersCount: uniqTrackers.length,
      infoHashV1,
      infoHashV2,
      private: isPrivate,
    });

    return {
      source: meta.source,
      receivedAt: Date.now(),
      originalPath: meta.originalPath,
      originalName: meta.originalName,
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
    console.log('[BitButler][torrent-parse] ERROR:', e);

    return {
      source: meta.source,
      receivedAt: Date.now(),
      originalPath: meta.originalPath,
      originalName: meta.originalName,
      error: {
        message: String(e?.message ?? e),
        code: 'PARSE_FAILED',
      },
    };
  }
}

export async function draftFromPathBuffer(buffer, filePath, source) {
  return parseTorrentBufferToDraft(buffer, {
    source,
    originalPath: filePath,
    originalName: path.basename(filePath),
  });
}
