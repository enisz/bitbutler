import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export type PackageName = 'electron' | 'app';

export interface ResolvedLocation {
  filename: string;
  line: number;
}

const mapCache = new Map<string, TraceMap | null>();

function toFsPath(compiledFilename: string): string {
  return compiledFilename.startsWith('file:') ? fileURLToPath(compiledFilename) : compiledFilename;
}

function loadMap(compiledFilePath: string): TraceMap | null {
  const cached = mapCache.get(compiledFilePath);
  if (cached !== undefined) return cached;

  let map: TraceMap | null;
  try {
    map = new TraceMap(fs.readFileSync(`${compiledFilePath}.map`, 'utf8'));
  } catch {
    map = null;
  }
  mapCache.set(compiledFilePath, map);
  return map;
}

// Both build pipelines emit a `sources` entry that is a single "../src/..." hop away from the
// compiled file - tsc's is disk-relative (dist/ and src/ are siblings under packages/electron),
// while Angular/esbuild's is "logical" (relative to some internal root, not the compiled file's
// actual disk location), so it can't be resolved with `path.resolve`. Anchoring on the "src/"
// segment instead and prefixing the known package name works for both, without needing the
// actual .ts source files to exist on disk.
function toRepoRelative(mapSource: string, packageName: PackageName): string | null {
  const match = /(?:^|\/)(src\/.*)$/.exec(mapSource.replace(/\\/g, '/'));
  return match ? `packages/${packageName}/${match[1]}` : null;
}

/**
 * Resolves a compiled/bundled stack-frame location back to its original TypeScript source,
 * using the ".map" file shipped next to the compiled file. `line`/`column` are 1-based, matching
 * a V8 stack frame. Returns null on any failure (no map, malformed map, no mapping at that
 * position, or no recognizable repo path) - callers should fall back to the compiled location.
 */
export function resolveOriginalLocation(
  compiledFilename: string,
  line: number,
  column: number,
  packageName: PackageName,
): ResolvedLocation | null {
  const compiledFilePath = toFsPath(compiledFilename);
  const map = loadMap(compiledFilePath);
  if (!map) return null;

  let position: ReturnType<typeof originalPositionFor>;
  try {
    position = originalPositionFor(map, { line, column: column - 1 });
  } catch {
    return null;
  }
  if (position.source === null) return null;

  const filename = toRepoRelative(position.source, packageName);
  if (!filename) return null;

  return { filename, line: position.line };
}
