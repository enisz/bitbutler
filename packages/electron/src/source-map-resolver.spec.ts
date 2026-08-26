import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Real mappings decoded from a `tsc --sourceMap` build of a 2-function fixture file - the
// `sources` label is swapped per test below (that doesn't require regenerating the VLQ
// mappings, since they only reference it by index, not by content) to mirror both tsc's
// dist-relative style ("../src/sample.ts") and Angular/esbuild's logical style, which is also a
// single "../src/..." hop regardless of how deep the file actually sits under `packages/app/src`.
const MAPPINGS =
  ';;AAAA,sBAEC;AAED,sBAEC;AAND,SAAgB,KAAK,CAAC,IAAY;IAChC,OAAO,UAAU,IAAI,GAAG,CAAC;AAC3B,CAAC;AAED,SAAgB,KAAK,CAAC,IAAI;IAChC,OAAO,KAAK,CAAC,IAAI,CAAC,CAAC,WAAW,EAAE,CAAC;AACnC,CAAC';

function mapWithSource(source: string): string {
  return JSON.stringify({
    version: 3,
    file: 'sample.js',
    sourceRoot: '',
    sources: [source],
    names: [],
    mappings: MAPPINGS,
  });
}

vi.mock('node:fs', () => ({
  default: {
    readFileSync: vi.fn(),
  },
}));

describe('resolveOriginalLocation', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('resolves a compiled electron-package location to its repo-root-relative source and line', async () => {
    const fs = await import('node:fs');
    vi.mocked(fs.default.readFileSync).mockReturnValue(mapWithSource('../src/sample.ts'));
    const { resolveOriginalLocation } = await import('./source-map-resolver.js');

    // generatedLine 6, generatedColumn 11 (0-based) -> originalLine 2 in sample.ts, per the
    // real mapping decoded from this exact map (the `return \`Hello, ${name}!\`;` line).
    const result = resolveOriginalLocation(
      'C:\\fake\\packages\\electron\\dist\\sample.js',
      6,
      12,
      'electron',
    );

    expect(result).toEqual({ filename: 'packages/electron/src/sample.ts', line: 2 });
  });

  it('resolves a compiled app-package location using the "app" package hint', async () => {
    const fs = await import('node:fs');
    vi.mocked(fs.default.readFileSync).mockReturnValue(
      mapWithSource('../src/app/services/sample.service.ts'),
    );
    const { resolveOriginalLocation } = await import('./source-map-resolver.js');

    const result = resolveOriginalLocation(
      'C:\\fake\\dist\\bitbutler\\browser\\chunk-abc123.js',
      6,
      12,
      'app',
    );

    expect(result).toEqual({
      filename: 'packages/app/src/app/services/sample.service.ts',
      line: 2,
    });
  });

  it('reads the ".map" file sitting next to the compiled file', async () => {
    const fs = await import('node:fs');
    vi.mocked(fs.default.readFileSync).mockReturnValue(mapWithSource('../src/sample.ts'));
    const { resolveOriginalLocation } = await import('./source-map-resolver.js');

    resolveOriginalLocation('C:\\fake\\packages\\electron\\dist\\sample.js', 6, 12, 'electron');

    expect(fs.default.readFileSync).toHaveBeenCalledWith(
      'C:\\fake\\packages\\electron\\dist\\sample.js.map',
      'utf8',
    );
  });

  it('resolves a file:// URL compiled location (renderer stack frames)', async () => {
    const fs = await import('node:fs');
    vi.mocked(fs.default.readFileSync).mockReturnValue(mapWithSource('../src/sample.ts'));
    const { resolveOriginalLocation } = await import('./source-map-resolver.js');

    const result = resolveOriginalLocation(
      'file:///C:/fake/packages/electron/dist/sample.js',
      6,
      12,
      'electron',
    );

    expect(result).toEqual({ filename: 'packages/electron/src/sample.ts', line: 2 });
  });

  it('returns null when no ".map" file exists next to the compiled file', async () => {
    const fs = await import('node:fs');
    vi.mocked(fs.default.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });
    const { resolveOriginalLocation } = await import('./source-map-resolver.js');

    const result = resolveOriginalLocation(
      'C:\\fake\\packages\\electron\\dist\\sample.js',
      6,
      12,
      'electron',
    );

    expect(result).toBeNull();
  });

  it('returns null when the map file is malformed JSON', async () => {
    const fs = await import('node:fs');
    vi.mocked(fs.default.readFileSync).mockReturnValue('not json');
    const { resolveOriginalLocation } = await import('./source-map-resolver.js');

    const result = resolveOriginalLocation(
      'C:\\fake\\packages\\electron\\dist\\sample.js',
      6,
      12,
      'electron',
    );

    expect(result).toBeNull();
  });

  it('returns null when the generated position has no mapping', async () => {
    const fs = await import('node:fs');
    vi.mocked(fs.default.readFileSync).mockReturnValue(mapWithSource('../src/sample.ts'));
    const { resolveOriginalLocation } = await import('./source-map-resolver.js');

    const result = resolveOriginalLocation(
      'C:\\fake\\packages\\electron\\dist\\sample.js',
      9999,
      1,
      'electron',
    );

    expect(result).toBeNull();
  });

  it('returns null when the mapped source has no recognizable "src/" segment', async () => {
    const fs = await import('node:fs');
    vi.mocked(fs.default.readFileSync).mockReturnValue(mapWithSource('../vendor/sample.js'));
    const { resolveOriginalLocation } = await import('./source-map-resolver.js');

    const result = resolveOriginalLocation(
      'C:\\fake\\packages\\electron\\dist\\sample.js',
      6,
      12,
      'electron',
    );

    expect(result).toBeNull();
  });

  it('returns null instead of throwing when column is out of range', async () => {
    const fs = await import('node:fs');
    vi.mocked(fs.default.readFileSync).mockReturnValue(mapWithSource('../src/sample.ts'));
    const { resolveOriginalLocation } = await import('./source-map-resolver.js');

    const result = resolveOriginalLocation(
      'C:\\fake\\packages\\electron\\dist\\sample.js',
      6,
      0,
      'electron',
    );

    expect(result).toBeNull();
  });

  it('caches a parsed map and only reads the file once for repeated lookups', async () => {
    const fs = await import('node:fs');
    vi.mocked(fs.default.readFileSync).mockReturnValue(mapWithSource('../src/sample.ts'));
    const { resolveOriginalLocation } = await import('./source-map-resolver.js');

    resolveOriginalLocation('C:\\fake\\packages\\electron\\dist\\sample.js', 6, 12, 'electron');
    resolveOriginalLocation('C:\\fake\\packages\\electron\\dist\\sample.js', 3, 1, 'electron');

    expect(fs.default.readFileSync).toHaveBeenCalledTimes(1);
  });
});
