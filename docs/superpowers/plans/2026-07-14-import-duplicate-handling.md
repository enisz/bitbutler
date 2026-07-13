# Import Duplicate Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop bulk import from silently overwriting already-existing torrents, show the user which archive torrents already exist on the target server before import starts, and let them opt in per-torrent to override.

**Architecture:** Duplicate detection happens entirely on the frontend (`ImportTorrents` cross-references the archive's hashes against the already-live `TorrentStoreService.torrentsMap()`), which computes a `skipHashes` list sent in `ImportStartPayload`. The backend (`runImport` in `packages/electron/src/ipc/export.ts`) trusts that list unconditionally - it partitions the archive's entries into "process" and "skip" up front and never calls qBittorrent for skipped ones. A new ag-grid-angular instance in the modal shows the skipped torrents' archived metadata (formatted the same way the main torrent grid formats it) with checkbox selection to override.

**Tech Stack:** Angular 20 (signals, standalone components), ag-grid-angular/ag-grid-community, Electron main-process TypeScript, Vitest.

## Global Constraints

- Commit format: `#229: <short description>` (this repo's convention; see `CLAUDE.md`).
- Use `-` (hyphen), never `—` (em dash), in all code, comments, commit messages, and translation strings.
- `npm run lint` must pass with zero warnings; `npm test` must pass for every touched workspace.
- Both `public/i18n/us.json` and `public/i18n/hu.json` are fully parallel today (no English-fallback) - every new key needs a real Hungarian translation, not a placeholder.
- Spec: `docs/superpowers/specs/2026-07-14-import-duplicate-handling-design.md` (issue [#229](https://github.com/enisz/bitbutler/issues/229), branch `229-import-duplicate-handling`).

---

## File Structure

| File                                                                  | Change                                                                                        |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `packages/shared/src/ipc.types.ts`                                    | Add `skipHashes` to `ImportStartPayload`; change `onImportDone` payload shape                 |
| `packages/electron/src/ipc/export.ts`                                 | Add `partitionImportEntries`; wire `runImport` to use it and report `failed`/`alreadyExisted` |
| `packages/electron/src/ipc/export.spec.ts`                            | New tests for `partitionImportEntries` and `runImport`'s skip behavior                        |
| `packages/app/src/app/services/export.service.ts`                     | Rename `ImportState.skipped` to `failed`, add `alreadyExisted`, fix event mapping             |
| `packages/app/src/app/services/export.service.spec.ts`                | New tests for the import event mapping                                                        |
| `packages/app/src/app/modals/import-torrents/import-torrents.ts`      | Duplicate-detection signals, grid col defs/options, `skipHashes` in `startImport()`           |
| `packages/app/src/app/modals/import-torrents/import-torrents.spec.ts` | New tests for duplicate detection, grid col defs, `skipHashes` payload                        |
| `packages/app/src/app/modals/import-torrents/import-torrents.html`    | New duplicates fieldset + grid; done-summary now shows `alreadyExisted`/`failed` separately   |
| `public/i18n/us.json`, `public/i18n/hu.json`                          | New keys for the duplicates fieldset/grid/summary                                             |

No new files are created - everything extends existing modules, matching how this codebase already structures import/export.

---

### Task 1: Shared type changes + `partitionImportEntries`

**Files:**

- Modify: `packages/shared/src/ipc.types.ts`
- Modify: `packages/electron/src/ipc/export.ts`
- Test: `packages/electron/src/ipc/export.spec.ts`

**Interfaces:**

- Produces: `partitionImportEntries(torrents: BbeTorrentEntry[], skipHashes: string[]): { toProcess: BbeTorrentEntry[]; alreadyExisted: BbeTorrentEntry[] }` (exported from `export.ts`, hash comparison is case-insensitive).
- Produces: `ImportStartPayload.skipHashes: string[]` (shared type, consumed by Task 2 and Task 4).

- [ ] **Step 1: Write the failing tests**

Add to `packages/electron/src/ipc/export.spec.ts` (new `describe` block, placed after the existing `filterAssignedTags` block):

```ts
describe('partitionImportEntries', () => {
  async function setup() {
    return import('./export.js');
  }

  it('keeps entries whose hash is not in skipHashes in toProcess', async () => {
    const { partitionImportEntries } = await setup();
    const torrents = [
      { hash: 'aaa', name: 'A', failed: false },
      { hash: 'bbb', name: 'B', failed: false },
    ];
    const result = partitionImportEntries(torrents as any, ['bbb']);
    expect(result.toProcess).toEqual([{ hash: 'aaa', name: 'A', failed: false }]);
    expect(result.alreadyExisted).toEqual([{ hash: 'bbb', name: 'B', failed: false }]);
  });

  it('matches hashes case-insensitively', async () => {
    const { partitionImportEntries } = await setup();
    const torrents = [{ hash: 'ABCDEF', name: 'A', failed: false }];
    const result = partitionImportEntries(torrents as any, ['abcdef']);
    expect(result.toProcess).toEqual([]);
    expect(result.alreadyExisted).toEqual(torrents);
  });

  it('returns everything in toProcess when skipHashes is empty', async () => {
    const { partitionImportEntries } = await setup();
    const torrents = [{ hash: 'aaa', name: 'A', failed: false }];
    const result = partitionImportEntries(torrents as any, []);
    expect(result.toProcess).toEqual(torrents);
    expect(result.alreadyExisted).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=@bitbutler/electron -- export.spec.ts`
Expected: FAIL - `partitionImportEntries is not a function` (it doesn't exist yet).

- [ ] **Step 3: Implement `partitionImportEntries` and the shared type change**

In `packages/shared/src/ipc.types.ts`, add `skipHashes` to `ImportStartPayload` (around line 159):

```ts
export interface ImportStartPayload {
  serverId: string;
  bbePath: string;
  restoreFields: ImportRestoreField[];
  startMode: ImportStartMode;
  pathMappings: BbePathMapping[];
  restoreCategories: boolean;
  restoreTags: boolean;
  categoryPathMappings: BbePathMapping[];
  overwriteCategories: boolean;
  skipHashes: string[];
}
```

And change `onImportDone`'s inline payload type (around line 267):

```ts
    onImportDone(cb: (e: { total: number; failed: number; alreadyExisted: number }) => void): () => void;
```

In `packages/electron/src/ipc/export.ts`, add the new function right after `filterAssignedTags` (before `restoreCategoriesAndTags`):

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --workspace=@bitbutler/electron -- export.spec.ts`
Expected: PASS (all `partitionImportEntries` tests, plus every pre-existing test in the file still passing).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/ipc.types.ts packages/electron/src/ipc/export.ts packages/electron/src/ipc/export.spec.ts
git commit -m "$(cat <<'EOF'
#229: added skipHashes to import payload and a partitionImportEntries helper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Wire `runImport` to skip duplicates and report `failed`/`alreadyExisted`

**Files:**

- Modify: `packages/electron/src/ipc/export.ts`
- Test: `packages/electron/src/ipc/export.spec.ts`

**Interfaces:**

- Consumes: `partitionImportEntries` (Task 1), `ImportStartPayload.skipHashes` (Task 1).
- Produces: `runImport(event: Electron.IpcMainEvent, payload: ImportStartPayload): Promise<void>` becomes exported (was module-private) so it can be unit tested directly, matching this file's existing pattern of exporting pure/orchestration helpers (`collectCategoriesAndTags`, `restoreCategoriesAndTags`) for direct testing.
- Produces (wire events, consumed by Task 3): `import:progress` payload stays `{ current, total, name, skipped }` (unchanged shape; `total` now reflects only entries being processed) and `import:done` payload becomes `{ total, failed, alreadyExisted }`.

- [ ] **Step 1: Write the failing tests**

Add to `packages/electron/src/ipc/export.spec.ts`, after the `partitionImportEntries` block from Task 1:

```ts
describe('runImport', () => {
  const mockQbRequestImport = vi.hoisted(() => vi.fn());
  const mockZipGetEntry = vi.hoisted(() => vi.fn());

  function fakeEvent() {
    return { sender: { isDestroyed: () => false, send: vi.fn() } };
  }

  function metadataEntry(torrents: unknown[]) {
    const metadata = {
      version: 1,
      exported_at: 0,
      source_server: 'srv',
      export_mode: 'legacy',
      torrents,
    };
    return { getData: () => ({ toString: () => JSON.stringify(metadata) }) };
  }

  function basePayload(overrides: Record<string, unknown> = {}) {
    return {
      serverId: 'server-1',
      bbePath: '/tmp/archive.bbe',
      restoreFields: [],
      startMode: 'paused',
      pathMappings: [],
      restoreCategories: false,
      restoreTags: false,
      categoryPathMappings: [],
      overwriteCategories: false,
      skipHashes: [],
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.resetModules();
    mockZipGetEntry.mockReset();
    vi.doMock('electron', () => ({
      ipcMain: { handle: vi.fn(), on: vi.fn() },
      dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
    }));
    vi.doMock('./qbittorrent.js', () => ({ qbRequest: mockQbRequestImport }));
    vi.doMock('./server.js', () => ({ getExportAvailable: vi.fn() }));
    vi.doMock('adm-zip', () => ({
      default: vi.fn().mockImplementation(() => ({ getEntry: mockZipGetEntry })),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('electron');
    vi.doUnmock('./qbittorrent.js');
    vi.doUnmock('./server.js');
    vi.doUnmock('adm-zip');
  });

  async function setup() {
    return import('./export.js');
  }

  it('skips entries whose hash is in skipHashes without calling qBittorrent for them', async () => {
    const torrents = [
      { hash: 'aaa', name: 'Already Here', failed: false, magnet_link: 'magnet:?xt=aaa' },
      { hash: 'bbb', name: 'Already Here Too', failed: false, magnet_link: 'magnet:?xt=bbb' },
    ];
    mockZipGetEntry.mockImplementation((name: string) =>
      name === 'metadata.json' ? metadataEntry(torrents) : undefined,
    );

    const { runImport } = await setup();
    const event = fakeEvent();
    await runImport(event as any, basePayload({ skipHashes: ['aaa', 'bbb'] }) as any);

    expect(mockQbRequestImport).not.toHaveBeenCalled();
    expect(event.sender.send).toHaveBeenCalledWith('import:done', {
      total: 0,
      failed: 0,
      alreadyExisted: 2,
    });
  });

  it('processes non-skipped entries normally while leaving skipped ones untouched', async () => {
    const torrents = [
      { hash: 'aaa', name: 'Already Here', failed: false, magnet_link: 'magnet:?xt=aaa' },
      { hash: 'bbb', name: 'New Torrent', failed: false, magnet_link: 'magnet:?xt=bbb' },
    ];
    mockZipGetEntry.mockImplementation((name: string) =>
      name === 'metadata.json' ? metadataEntry(torrents) : undefined,
    );
    mockQbRequestImport.mockResolvedValue('Ok.');

    const { runImport } = await setup();
    const event = fakeEvent();
    await runImport(event as any, basePayload({ skipHashes: ['aaa'] }) as any);

    expect(mockQbRequestImport).toHaveBeenCalledTimes(1);
    expect(mockQbRequestImport).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/v2/torrents/add',
        form: expect.objectContaining({ urls: 'magnet:?xt=bbb' }),
      }),
    );
    expect(event.sender.send).toHaveBeenCalledWith('import:progress', {
      current: 1,
      total: 1,
      name: 'New Torrent',
      skipped: 0,
    });
    expect(event.sender.send).toHaveBeenCalledWith('import:done', {
      total: 1,
      failed: 0,
      alreadyExisted: 1,
    });
  });
});
```

Both tests use `restoreFields: []` and `startMode: 'paused'` so `needsPostProcess` is `false` - this keeps each test to exactly one qBittorrent call (the add itself), since the confirmation-poll and `applyTorrentSettings` loops are skipped entirely. That's deliberate: this task is only testing the skip/process partitioning and event shapes, not the settings-restore pipeline (which is untouched and already implicitly covered by this file's other tests of its constituent helpers).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=@bitbutler/electron -- export.spec.ts`
Expected: FAIL - `runImport` is not exported yet, and even once exported, `import:done` still reports the old `{ total, skipped }` shape instead of `{ total, failed, alreadyExisted }`.

- [ ] **Step 3: Implement the `runImport` changes**

In `packages/electron/src/ipc/export.ts`, replace the `runImport` function (currently starting `async function runImport(...)`) with:

```ts
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
      try {
        await addTorrent(serverId, entry, metadata.export_mode, zip, restoreFields, pathMappings);
        addedHashes.push(entry.hash);
      } catch {
        failed++;
      }

      send('import:progress', {
        current: i + 1,
        total: toProcess.length,
        name: entry.name,
        skipped: failed,
      } satisfies ExportProgressEvent);
    }

    const needsPostProcess =
      addedHashes.length > 0 &&
      (restoreFields.some((f) =>
        (
          [
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

    for (const entry of toProcess) {
      if (importCancelled) break;
      if (!confirmedHashes.has(entry.hash)) continue;
      await applyTorrentSettings(serverId, entry, restoreFields, startMode).catch(() => {});
    }

    send('import:done', { total: toProcess.length, failed, alreadyExisted: alreadyExisted.length });
  } catch (err) {
    send('import:error', { message: (err as Error)?.message ?? String(err) });
  }
}
```

This is the same function as before with three changes: `skipHashes` destructured from `payload`; `torrents` replaced by `partitionImportEntries`'s `toProcess`/`alreadyExisted`; the local failure counter renamed `skipped` → `failed`; and the final `send('import:done', ...)` reporting `failed`/`alreadyExisted` instead of `skipped`. `addTorrent` and `applyTorrentSettings` are untouched.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --workspace=@bitbutler/electron -- export.spec.ts`
Expected: PASS - both new `runImport` tests and every pre-existing test in the file.

- [ ] **Step 5: Commit**

```bash
git add packages/electron/src/ipc/export.ts packages/electron/src/ipc/export.spec.ts
git commit -m "$(cat <<'EOF'
#229: skip already-existing torrents in runImport instead of overwriting them

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Frontend event mapping (`ExportService`)

**Files:**

- Modify: `packages/app/src/app/services/export.service.ts`
- Test: `packages/app/src/app/services/export.service.spec.ts`

**Interfaces:**

- Consumes: `ImportStartPayload.skipHashes` (Task 1, used by Task 4), `onImportDone`'s new `{ total, failed, alreadyExisted }` shape (Task 1/2).
- Produces: `ImportState` gains `failed: number` and `alreadyExisted: number` (replacing `skipped: number`), consumed by Task 5's template.

- [ ] **Step 1: Write the failing tests**

Add to `packages/app/src/app/services/export.service.spec.ts`:

```ts
describe('import progress/done event mapping', () => {
  let onImportProgressCb: (e: {
    current: number;
    total: number;
    name: string;
    skipped: number;
  }) => void;
  let onImportDoneCb: (e: { total: number; failed: number; alreadyExisted: number }) => void;

  beforeEach(() => {
    (window as any).bitbutler.export.onImportProgress = (cb: typeof onImportProgressCb) => {
      onImportProgressCb = cb;
      return () => {};
    };
    (window as any).bitbutler.export.onImportDone = (cb: typeof onImportDoneCb) => {
      onImportDoneCb = cb;
      return () => {};
    };

    TestBed.configureTestingModule({});
    service = TestBed.inject(ExportService);
  });

  it('maps import progress events onto current/total/name without a stray skipped field', () => {
    onImportProgressCb({ current: 2, total: 5, name: 'Foo', skipped: 1 });
    const state = service.importState();
    expect(state.phase).toBe('running');
    expect(state.current).toBe(2);
    expect(state.total).toBe(5);
    expect(state.name).toBe('Foo');
  });

  it('maps the import done event to failed and alreadyExisted', () => {
    onImportDoneCb({ total: 3, failed: 1, alreadyExisted: 2 });
    const state = service.importState();
    expect(state.phase).toBe('done');
    expect(state.current).toBe(3);
    expect(state.failed).toBe(1);
    expect(state.alreadyExisted).toBe(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=@bitbutler/app -- export.service.spec.ts`
Expected: FAIL - `state.failed`/`state.alreadyExisted` are `undefined` (the service still uses `skipped`).

- [ ] **Step 3: Implement the `ExportService` changes**

In `packages/app/src/app/services/export.service.ts`:

```ts
export interface ImportState {
  phase: ImportPhase;
  metadata?: BbeMetadata;
  current: number;
  total: number;
  name: string;
  failed: number;
  alreadyExisted: number;
  error?: string;
}
```

```ts
const IMPORT_IDLE: ImportState = {
  phase: 'idle',
  current: 0,
  total: 0,
  name: '',
  failed: 0,
  alreadyExisted: 0,
};
```

Replace the `onImportProgress`/`onImportDone` subscriptions in the constructor:

```ts
      api.onImportProgress((e: ExportProgressEvent) =>
        this._import.update((s) => ({
          ...s,
          phase: 'running',
          current: e.current,
          total: e.total,
          name: e.name,
        })),
      ),
      api.onImportDone((e: { total: number; failed: number; alreadyExisted: number }) =>
        this._import.update((s) => ({
          ...s,
          phase: 'done',
          current: e.total,
          failed: e.failed,
          alreadyExisted: e.alreadyExisted,
        })),
      ),
```

(`onImportProgress` now spreads specific fields instead of `...e`, since `e` still carries a `skipped` field per `ExportProgressEvent` that no longer has a home on `ImportState`.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --workspace=@bitbutler/app -- export.service.spec.ts`
Expected: PASS - new tests plus every pre-existing test in the file (`resetImport`, idle-phase checks, etc.).

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/services/export.service.ts packages/app/src/app/services/export.service.spec.ts
git commit -m "$(cat <<'EOF'
#229: report already-existed and failed as separate import counts

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `ImportTorrents` component - duplicate detection and grid column defs

**Files:**

- Modify: `packages/app/src/app/modals/import-torrents/import-torrents.ts`
- Modify: `packages/app/src/app/modals/import-torrents/import-torrents.spec.ts`

**Interfaces:**

- Consumes: `TorrentStoreService.torrentsMap(): Signal<Map<string, Torrent>>` (existing), `ThemeService.effectiveMode: Signal<'light' | 'dark'>` (existing), `UiFormatService.fileSizePerSecond/ratioLimit/timeLimit` (existing, all `(params: ValueFormatterParams) => string`), `GRID_SHARED_OPTIONS`/`GRID_DARK_THEME`/`GRID_LIGHT_THEME` (existing, `packages/app/src/app/app.const.ts`), `TextColumnFilter`/`SizeColumnFilter`/`RatioLimitColumnFilter`/`TimeLimitColumnFilter`/`BooleanColumnFilter`/`SetColumnFilter`/`buildValueCounts` (existing, `packages/app/src/app/components/column-filters/*`), `ImportStartPayload.skipHashes` (Task 1).
- Produces (consumed by Task 5's template): `duplicateEntries: Signal<BbeTorrentEntry[]>`, `hasDuplicates: Signal<boolean>`, `duplicatesColDefs: ColDef<BbeTorrentEntry>[]`, `duplicatesGridOptions: GridOptions<BbeTorrentEntry>`, `theme: Signal<'light' | 'dark'>`, `bbDark`/`bbLight` (grid themes), `onDuplicatesSelectionChanged(e: SelectionChangedEvent<BbeTorrentEntry>): void`.

- [ ] **Step 1: Update test providers and write the failing tests**

In `packages/app/src/app/modals/import-torrents/import-torrents.spec.ts`, add imports:

```ts
import { BbeTorrentEntry } from '@bitbutler/shared';
import { ThemeService } from '../../services/theme.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
```

Update the `providers` array in the existing `beforeEach` to add:

```ts
        { provide: ThemeService, useValue: { effectiveMode: signal('light') } },
        { provide: TorrentStoreService, useValue: { torrentsMap: signal(new Map()) } },
```

Update the pre-existing `mockExportService.importState` initial value and the "should expose tagsCount and categoriesCount from metadata" test's `.set(...)` call to match the `ImportState` shape from Task 3 (`failed`/`alreadyExisted` instead of `skipped`):

```ts
      importState: signal({ phase: 'idle', current: 0, total: 0, name: '', failed: 0, alreadyExisted: 0 }),
```

and in the `tagsCount`/`categoriesCount` test:

```ts
    mockExportService.importState.set({
      phase: 'ready',
      current: 0,
      total: 0,
      name: '',
      failed: 0,
      alreadyExisted: 0,
      metadata: {
```

Then add two new `describe` blocks at the end of the file, before the closing `});` of the outer `describe('ImportTorrents', ...)`:

```ts
describe('duplicate detection', () => {
  function setMetadata(torrents: BbeTorrentEntry[]) {
    mockExportService.importState.set({
      phase: 'ready',
      current: 0,
      total: 0,
      name: '',
      failed: 0,
      alreadyExisted: 0,
      metadata: {
        version: 1,
        exported_at: 0,
        source_server: 'srv',
        export_mode: 'full',
        torrents,
      },
    } as any);
  }

  function torrentStoreMock() {
    return TestBed.inject(TorrentStoreService) as unknown as {
      torrentsMap: ReturnType<typeof signal<Map<string, unknown>>>;
    };
  }

  it('is empty when no archive torrent hashes are on the target server', () => {
    setMetadata([{ hash: 'aaa', name: 'A', failed: false }]);
    expect(component.duplicateEntries()).toEqual([]);
    expect(component.hasDuplicates()).toBe(false);
  });

  it('finds entries whose hash already exists on the target server, case-insensitively', () => {
    torrentStoreMock().torrentsMap.set(new Map([['AAA', {}]]));
    setMetadata([
      { hash: 'aaa', name: 'A', failed: false },
      { hash: 'bbb', name: 'B', failed: false },
    ]);

    expect(component.duplicateEntries().map((t) => t.hash)).toEqual(['aaa']);
    expect(component.hasDuplicates()).toBe(true);
  });

  it('excludes failed entries from duplicate detection', () => {
    torrentStoreMock().torrentsMap.set(new Map([['aaa', {}]]));
    setMetadata([{ hash: 'aaa', name: 'A', failed: true } as any]);

    expect(component.duplicateEntries()).toEqual([]);
  });

  it('startImport sends skipHashes for every duplicate that was not overridden', () => {
    torrentStoreMock().torrentsMap.set(
      new Map([
        ['aaa', {}],
        ['bbb', {}],
      ]),
    );
    setMetadata([
      { hash: 'aaa', name: 'A', failed: false },
      { hash: 'bbb', name: 'B', failed: false },
      { hash: 'ccc', name: 'C', failed: false },
    ]);

    component.startImport();

    const call = (window.bitbutler.export.importStart as any).mock.calls[0][0];
    expect(call.skipHashes.sort()).toEqual(['aaa', 'bbb']);
  });

  it('startImport excludes an overridden duplicate from skipHashes', () => {
    torrentStoreMock().torrentsMap.set(
      new Map([
        ['aaa', {}],
        ['bbb', {}],
      ]),
    );
    setMetadata([
      { hash: 'aaa', name: 'A', failed: false },
      { hash: 'bbb', name: 'B', failed: false },
    ]);

    component.onDuplicatesSelectionChanged({
      api: { getSelectedRows: () => [{ hash: 'aaa', name: 'A', failed: false }] },
    } as any);

    component.startImport();

    const call = (window.bitbutler.export.importStart as any).mock.calls[0][0];
    expect(call.skipHashes).toEqual(['bbb']);
  });
});

describe('duplicates grid column definitions', () => {
  it('every column has a colId', () => {
    expect(component.duplicatesColDefs.every((c) => !!c.colId)).toBe(true);
  });

  it('colIds cover all expected fields', () => {
    const colIds = component.duplicatesColDefs.map((c) => c.colId);
    expect(colIds).toEqual(
      expect.arrayContaining([
        'name',
        'save_path',
        'category',
        'tags',
        'dl_limit',
        'up_limit',
        'ratio_limit',
        'seeding_time_limit',
        'inactive_seeding_time_limit',
        'auto_tmm',
        'sequential_download',
        'super_seeding',
        'first_last_piece_prio',
        'state',
      ]),
    );
  });

  it('assigns agCheckboxCellRenderer and BooleanColumnFilter to the boolean columns', () => {
    const boolCols = ['auto_tmm', 'sequential_download', 'super_seeding', 'first_last_piece_prio'];
    for (const colId of boolCols) {
      const col = component.duplicatesColDefs.find((c) => c.colId === colId);
      expect(col?.cellRenderer).toBe('agCheckboxCellRenderer');
    }
  });

  it('the dl_limit and up_limit columns use a valueFormatter', () => {
    expect(
      component.duplicatesColDefs.find((c) => c.colId === 'dl_limit')?.valueFormatter,
    ).toBeDefined();
    expect(
      component.duplicatesColDefs.find((c) => c.colId === 'up_limit')?.valueFormatter,
    ).toBeDefined();
  });

  it('the tags column formats an array as a comma-joined string', () => {
    const col = component.duplicatesColDefs.find((c) => c.colId === 'tags')!;
    const fmt = col.valueFormatter as (p: any) => string;
    expect(fmt({ value: ['linux', 'docs'] })).toBe('linux, docs');
    expect(fmt({ value: undefined })).toBe('');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=@bitbutler/app -- import-torrents.spec.ts`
Expected: FAIL - `component.duplicateEntries`, `component.hasDuplicates`, `component.duplicatesColDefs`, and `component.onDuplicatesSelectionChanged` don't exist yet; the `TorrentStoreService`/`ThemeService` providers are also unused until the component injects them (harmless, but the new tests fail with "not a function"/"cannot read properties of undefined").

- [ ] **Step 3: Implement the component changes**

In `packages/app/src/app/modals/import-torrents/import-torrents.ts`, update the `@bitbutler/shared` import to include `BbeTorrentEntry`:

```ts
import {
  BbePathMapping,
  BbeTorrentEntry,
  ImportRestoreField,
  ImportStartMode,
  ImportStartPayload,
} from '@bitbutler/shared';
```

Change the existing `@ngx-translate/core` import line to also bring in `TranslateService`:

```ts
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
```

Add these new imports alongside the existing ones:

```ts
import {
  ColDef,
  GetRowIdParams,
  GridOptions,
  SelectionChangedEvent,
  ValueFormatterParams,
  ValueGetterParams,
} from 'ag-grid-community';
import { GRID_DARK_THEME, GRID_LIGHT_THEME, GRID_SHARED_OPTIONS } from '../../app.const';
import { BooleanColumnFilter } from '../../components/column-filters/boolean-column-filter/boolean-column-filter';
import { RatioLimitColumnFilter } from '../../components/column-filters/ratio-limit-column-filter/ratio-limit-column-filter';
import {
  SetColumnFilter,
  SetColumnFilterParams,
  buildValueCounts,
} from '../../components/column-filters/set-column-filter/set-column-filter';
import { SizeColumnFilter } from '../../components/column-filters/size-column-filter/size-column-filter';
import { TextColumnFilter } from '../../components/column-filters/text-column-filter/text-column-filter';
import { TimeLimitColumnFilter } from '../../components/column-filters/time-limit-column-filter/time-limit-column-filter';
import { ThemeService } from '../../services/theme.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { UiFormatService } from '../../services/ui-format.service';
```

Add these injected services near the top of the class, alongside the existing ones:

```ts
  private readonly themeService = inject(ThemeService);
  private readonly torrentStore = inject(TorrentStoreService);
  private readonly uiFormatService = inject(UiFormatService);
  private readonly translateService = inject(TranslateService);
```

Add the duplicate-detection state and grid setup as new class members (placed after the existing `metadata`/`tagsCount`/`categoriesCount` computed signals, before `get pathMappings()`):

```ts
  readonly theme = this.themeService.effectiveMode;
  readonly bbDark = GRID_DARK_THEME;
  readonly bbLight = GRID_LIGHT_THEME;

  private readonly overriddenHashes = signal<Set<string>>(new Set());

  readonly duplicateEntries = computed(() => {
    const currentHashes = new Set(
      Array.from(this.torrentStore.torrentsMap().keys()).map((h) => h.toLowerCase()),
    );
    return (this.metadata()?.torrents ?? []).filter(
      (t) => !t.failed && currentHashes.has(t.hash.toLowerCase()),
    );
  });

  readonly hasDuplicates = computed(() => this.duplicateEntries().length > 0);

  readonly duplicatesGridOptions: GridOptions<BbeTorrentEntry> = {
    ...GRID_SHARED_OPTIONS,
    rowSelection: {
      mode: 'multiRow',
      checkboxes: true,
      headerCheckbox: true,
      enableClickSelection: false,
    },
    getRowId: (params: GetRowIdParams<BbeTorrentEntry>) => params.data.hash,
    onSelectionChanged: (e: SelectionChangedEvent<BbeTorrentEntry>) =>
      this.onDuplicatesSelectionChanged(e),
  };

  readonly duplicatesColDefs: ColDef<BbeTorrentEntry>[] = this.getDuplicatesColDefs();

  onDuplicatesSelectionChanged(e: SelectionChangedEvent<BbeTorrentEntry>): void {
    this.overriddenHashes.set(new Set(e.api.getSelectedRows().map((r) => r.hash.toLowerCase())));
  }

  private stateLabel(state: string | undefined): string {
    return state ? this.translateService.instant('torrent.state.' + state) : '';
  }

  private getDuplicatesColDefs(): ColDef<BbeTorrentEntry>[] {
    const stateItems = computed(() =>
      buildValueCounts(this.duplicateEntries(), (t) => this.stateLabel(t.state)),
    );

    return [
      {
        colId: 'name',
        field: 'name',
        tooltipField: 'name',
        width: 220,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.name',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.name',
        ),
        sortable: true,
        resizable: true,
        filter: TextColumnFilter,
      },
      {
        colId: 'save_path',
        field: 'save_path',
        tooltipField: 'save_path',
        width: 260,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.save_path',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.save_path',
        ),
        sortable: true,
        resizable: true,
        filter: TextColumnFilter,
      },
      {
        colId: 'category',
        field: 'category',
        tooltipField: 'category',
        width: 150,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.category',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.category',
        ),
        sortable: true,
        resizable: true,
        filter: TextColumnFilter,
      },
      {
        colId: 'tags',
        field: 'tags',
        width: 180,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.tags',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.tags',
        ),
        valueFormatter: (params: ValueFormatterParams<BbeTorrentEntry, string[]>) =>
          (params.value ?? []).join(', '),
        filterValueGetter: (params: ValueGetterParams<BbeTorrentEntry>) =>
          (params.data?.tags ?? []).join(', '),
        tooltipValueGetter: (params) => (params.data?.tags ?? []).join(', '),
        sortable: true,
        resizable: true,
        filter: TextColumnFilter,
      },
      {
        colId: 'dl_limit',
        field: 'dl_limit',
        width: 130,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.dl_limit',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.dl_limit',
        ),
        valueFormatter: this.uiFormatService.fileSizePerSecond,
        cellClass: 'tabular-nums',
        sortable: true,
        resizable: true,
        filter: SizeColumnFilter,
      },
      {
        colId: 'up_limit',
        field: 'up_limit',
        width: 130,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.up_limit',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.up_limit',
        ),
        valueFormatter: this.uiFormatService.fileSizePerSecond,
        cellClass: 'tabular-nums',
        sortable: true,
        resizable: true,
        filter: SizeColumnFilter,
      },
      {
        colId: 'ratio_limit',
        field: 'ratio_limit',
        width: 135,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.ratio_limit',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.ratio_limit',
        ),
        valueFormatter: this.uiFormatService.ratioLimit,
        cellClass: 'tabular-nums',
        sortable: true,
        resizable: true,
        filter: RatioLimitColumnFilter,
      },
      {
        colId: 'seeding_time_limit',
        field: 'seeding_time_limit',
        width: 165,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.seeding_time_limit',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.seeding_time_limit',
        ),
        valueFormatter: this.uiFormatService.timeLimit,
        cellClass: 'tabular-nums',
        sortable: true,
        resizable: true,
        filter: TimeLimitColumnFilter,
      },
      {
        colId: 'inactive_seeding_time_limit',
        field: 'inactive_seeding_time_limit',
        width: 195,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.inactive_seeding_time_limit',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.inactive_seeding_time_limit',
        ),
        valueFormatter: this.uiFormatService.timeLimit,
        cellClass: 'tabular-nums',
        sortable: true,
        resizable: true,
        filter: TimeLimitColumnFilter,
      },
      {
        colId: 'auto_tmm',
        field: 'auto_tmm',
        width: 130,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.auto_tmm',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.auto_tmm',
        ),
        cellRenderer: 'agCheckboxCellRenderer',
        editable: false,
        sortable: true,
        resizable: true,
        filter: BooleanColumnFilter,
      },
      {
        colId: 'sequential_download',
        field: 'sequential_download',
        width: 170,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.sequential_download',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.sequential_download',
        ),
        cellRenderer: 'agCheckboxCellRenderer',
        editable: false,
        sortable: true,
        resizable: true,
        filter: BooleanColumnFilter,
      },
      {
        colId: 'super_seeding',
        field: 'super_seeding',
        width: 140,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.super_seeding',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.super_seeding',
        ),
        cellRenderer: 'agCheckboxCellRenderer',
        editable: false,
        sortable: true,
        resizable: true,
        filter: BooleanColumnFilter,
      },
      {
        colId: 'first_last_piece_prio',
        field: 'first_last_piece_prio',
        width: 175,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.first_last_piece_prio',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.first_last_piece_prio',
        ),
        cellRenderer: 'agCheckboxCellRenderer',
        editable: false,
        sortable: true,
        resizable: true,
        filter: BooleanColumnFilter,
      },
      {
        colId: 'state',
        field: 'state',
        width: 130,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.state',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.duplicates.col-def.state',
        ),
        valueFormatter: (params: ValueFormatterParams<BbeTorrentEntry, string>) =>
          this.stateLabel(params.value),
        filterValueGetter: (params: ValueGetterParams<BbeTorrentEntry>) =>
          this.stateLabel(params.data?.state),
        sortable: true,
        resizable: true,
        filter: SetColumnFilter,
        filterParams: { getItems: () => stateItems() } satisfies Partial<SetColumnFilterParams>,
      },
    ];
  }
```

Finally, update `startImport()` to include `skipHashes`:

```ts
const skipHashes = this.duplicateEntries()
  .map((t) => t.hash.toLowerCase())
  .filter((h) => !this.overriddenHashes().has(h));

const payload: ImportStartPayload = {
  serverId: this.serverStore.currentServer()?.id ?? '',
  bbePath: this.loadedBbePath || this.initialBbePath() || '',
  restoreFields,
  startMode: raw.startMode,
  pathMappings,
  restoreCategories: raw.restoreFields.categories,
  restoreTags: raw.restoreFields.tags,
  categoryPathMappings,
  overwriteCategories: raw.overwriteCategories,
  skipHashes,
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --workspace=@bitbutler/app -- import-torrents.spec.ts`
Expected: PASS - all new tests plus every pre-existing test in the file.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/modals/import-torrents/import-torrents.ts packages/app/src/app/modals/import-torrents/import-torrents.spec.ts
git commit -m "$(cat <<'EOF'
#229: added duplicate detection and a review grid's column defs to ImportTorrents

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Template - duplicates fieldset/grid, done summary, i18n

**Files:**

- Modify: `packages/app/src/app/modals/import-torrents/import-torrents.ts` (add `AgGridAngular` to the `@Component` `imports` array only)
- Modify: `packages/app/src/app/modals/import-torrents/import-torrents.html`
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`
- Test: `packages/app/src/app/modals/import-torrents/import-torrents.spec.ts`

**Interfaces:**

- Consumes: `duplicateEntries`, `hasDuplicates`, `duplicatesColDefs`, `duplicatesGridOptions`, `theme`, `bbDark`, `bbLight` (Task 4); `state().failed`/`state().alreadyExisted` (Task 3).

- [ ] **Step 1: Write the failing tests**

Add to `packages/app/src/app/modals/import-torrents/import-torrents.spec.ts`, a new `describe` block:

```ts
describe('duplicates fieldset visibility', () => {
  it('does not render the duplicates fieldset when there are no duplicates', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.duplicates-fieldset')).toBeNull();
  });

  it('renders the duplicates fieldset when duplicates exist', () => {
    (
      TestBed.inject(TorrentStoreService) as unknown as {
        torrentsMap: ReturnType<typeof signal<Map<string, unknown>>>;
      }
    ).torrentsMap.set(new Map([['aaa', {}]]));

    mockExportService.importState.set({
      phase: 'ready',
      current: 0,
      total: 0,
      name: '',
      failed: 0,
      alreadyExisted: 0,
      metadata: {
        version: 1,
        exported_at: 0,
        source_server: 'srv',
        export_mode: 'full',
        torrents: [{ hash: 'aaa', name: 'A', failed: false }],
      },
    } as any);

    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.duplicates-fieldset')).not.toBeNull();
  });
});

describe('done summary', () => {
  function setDone(failed: number, alreadyExisted: number) {
    // `component.phase` captured a direct reference to this exact signal at
    // construction time (`readonly phase = this.exportService.importPhase;`),
    // so it must be mutated in place with `.set(...)` - reassigning
    // `mockExportService.importPhase` to a new signal would not be visible
    // to the already-constructed component.
    mockExportService.importPhase.set('done');
    mockExportService.importState.set({
      phase: 'done',
      current: 0,
      total: 0,
      name: '',
      failed,
      alreadyExisted,
    } as any);
  }

  it('shows the alreadyExisted count when greater than zero', () => {
    setDone(0, 2);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('2');
  });

  it('shows the failed count when greater than zero', () => {
    setDone(3, 0);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('3');
  });
});
```

Note: `mockExportService.importPhase` is a plain `signal('idle')` created once in the outer `beforeEach` (see the top of this spec file) - reassigning it to a new `signal('done')` inside `setDone` works because the mock object's property is just swapped for a fresh signal, same as how `mockExportService.importState` is mutated via `.set(...)` elsewhere in this file.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=@bitbutler/app -- import-torrents.spec.ts`
Expected: FAIL - `.duplicates-fieldset` doesn't exist in the template yet, and the done-summary text doesn't yet reference `alreadyExisted`/`failed`.

- [ ] **Step 3: Implement the template and i18n changes**

In `packages/app/src/app/modals/import-torrents/import-torrents.ts`, add `AgGridAngular` to the `@Component` decorator's `imports` array:

```ts
import { AgGridAngular } from 'ag-grid-angular';
```

```ts
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    FaIconComponent,
    BbProgress,
    BbPopover,
    LocalTimestampPipe,
    NgbTooltip,
    BbBtnContent,
    AgGridAngular,
  ],
```

In `packages/app/src/app/modals/import-torrents/import-torrents.html`, insert a new fieldset immediately after the closing `</fieldset>` of the "Archive" fieldset (right before `@if (isReady()) {` that opens the Restore Options fieldset):

```html
@if (isReady() && hasDuplicates()) {
<fieldset class="bb-fieldset duplicates-fieldset">
  <legend>{{ 'components.modals.import-torrents.label.duplicates' | translate }}</legend>
  <p class="small mb-3">
    {{ 'components.modals.import-torrents.duplicates.description' | translate }}
  </p>
  <ag-grid-angular
    class="w-100 d-block mb-2"
    style="height: 300px"
    [loading]="false"
    [rowData]="duplicateEntries()"
    [columnDefs]="duplicatesColDefs"
    [gridOptions]="duplicatesGridOptions"
    [theme]="theme() === 'dark' ? bbDark : bbLight"
  />
</fieldset>
}
```

Replace the done-summary block (currently using `state().skipped`):

```html
@if (isDone()) {
<span class="text-success">
  {{ 'components.modals.import-torrents.progress.done' | translate }} @if (state().alreadyExisted >
  0) { - {{ state().alreadyExisted }} {{
  'components.modals.import-torrents.progress.already-existed' | translate }} } @if (state().failed
  > 0) { - {{ state().failed }} {{ 'components.modals.import-torrents.progress.failed' | translate
  }} }
</span>
}
```

In `public/i18n/us.json`, inside `components.modals.import-torrents`, add `"duplicates"` under `"label"`:

```json
        "label": {
          "archive": "Archive",
          "duplicates": "Already on server",
          "restore-options": "Restore options",
          "path-remap": "Save path remapping",
          "category-path-mapping": "Category path mapping",
          "after-import": "After import",
          "progress": "Progress"
        },
```

Add a new `"duplicates"` section (placed after `"archive"`, before `"restore"`):

```json
        "duplicates": {
          "description": "These torrents already exist on the target server and will be skipped by default. Check any you want to override and reapply their archived settings instead.",
          "col-def": {
            "name": "Name",
            "save_path": "Save path",
            "category": "Category",
            "tags": "Tags",
            "dl_limit": "Download limit",
            "up_limit": "Upload limit",
            "ratio_limit": "Ratio limit",
            "seeding_time_limit": "Seeding time limit",
            "inactive_seeding_time_limit": "Inactive seeding time limit",
            "auto_tmm": "Auto-TMM",
            "sequential_download": "Sequential download",
            "super_seeding": "Super seeding",
            "first_last_piece_prio": "First/last piece priority",
            "state": "State"
          }
        },
```

Replace `"progress"`'s `"skipped"` key with the two new ones:

```json
        "progress": {
          "importing": "Importing torrents...",
          "done": "Import complete",
          "already-existed": "already existed",
          "failed": "failed"
        },
```

In `public/i18n/hu.json`, make the matching changes (same key structure, real Hungarian translations, reusing this file's already-established terms for shared concepts):

```json
        "label": {
          "archive": "Archívum",
          "duplicates": "Már a szerveren található",
          "restore-options": "Visszaállítási beállítások",
          "path-remap": "Mentési útvonal hozzárendelés",
          "category-path-mapping": "Kategória útvonal hozzárendelés",
          "after-import": "Importálás után",
          "progress": "Haladás"
        },
```

```json
        "duplicates": {
          "description": "Ezek a torrentek már megtalálhatók a cél szerveren, és alapértelmezés szerint kimaradnak az importálásból. Jelöld be azokat, amelyeket felül szeretnél írni az archivált beállításokkal.",
          "col-def": {
            "name": "Név",
            "save_path": "Mentési útvonal",
            "category": "Kategória",
            "tags": "Címkék",
            "dl_limit": "Letöltési korlát",
            "up_limit": "Feltöltési korlát",
            "ratio_limit": "Arány korlát",
            "seeding_time_limit": "Seedelési idő korlát",
            "inactive_seeding_time_limit": "Inaktív seedelési idő korlát",
            "auto_tmm": "Auto-TMM",
            "sequential_download": "Sorrendi letöltés",
            "super_seeding": "Super seeding",
            "first_last_piece_prio": "Első/utolsó szelet prioritása",
            "state": "Állapot"
          }
        },
```

```json
        "progress": {
          "importing": "Torrentek importálása...",
          "done": "Import kész",
          "already-existed": "már létezett",
          "failed": "sikertelen"
        },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --workspace=@bitbutler/app -- import-torrents.spec.ts`
Expected: PASS - all tests in the file, including the new fieldset-visibility and done-summary tests.

Then run the full check for both touched workspaces:

Run: `npm run lint && npm test`
Expected: PASS with zero lint warnings across the whole repo.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/modals/import-torrents/import-torrents.ts packages/app/src/app/modals/import-torrents/import-torrents.html packages/app/src/app/modals/import-torrents/import-torrents.spec.ts public/i18n/us.json public/i18n/hu.json
git commit -m "$(cat <<'EOF'
#229: added the duplicates review grid and split the done summary into already-existed/failed

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Manual Verification (after Task 5)

1. `npm start` to launch the app against a real qBittorrent instance.
2. Export a `.bbe` archive containing at least two torrents.
3. Import that same archive back onto the same server.
4. Confirm the new "Already on server" fieldset appears, listing both torrents with their save path/category/tags/limits/state populated and correctly formatted (human-readable sizes, ratio/time limits, checkboxes for booleans).
5. Leave both unchecked, click Import, confirm the done summary shows "2 already existed" and that neither torrent's settings or running state changed on the server.
6. Re-import the same archive, this time checking one row before importing; confirm that torrent's archived settings get reapplied (per whatever Restore Options/Start Mode are selected) while the other remains untouched.
7. Import an archive with no overlap with the current torrent list; confirm the new fieldset does not appear at all.

## Before opening the PR

Per this repo's convention (`CLAUDE.md`), remove the `docs/superpowers` spec and plan files in their own commit before opening the PR:

```bash
git rm -r docs/superpowers
git commit -m "$(cat <<'EOF'
#229: removed spec and plan

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
