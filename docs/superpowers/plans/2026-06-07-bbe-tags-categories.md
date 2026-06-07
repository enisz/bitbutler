# BBE Tags, Categories & TMM Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Back up qBittorrent tags and categories in BBE exports, restore them at import time with category path remapping and an optional overwrite mode, and surface the four "Save Management" TMM preferences in BitButler's qBittorrent settings UI so users understand the consequences of remapping category paths.

**Architecture:** Extends the existing BBE export/import pipeline (`packages/electron/src/ipc/export.ts`) with a metadata collection step on export and a new "Step 0" restoration phase on import that runs before torrents are added (so qBittorrent never auto-creates categories with empty paths). The shared IPC contract (`packages/shared/src/ipc.types.ts`) gains new optional `BbeMetadata` fields and new `ImportStartPayload` fields. The Angular import modal (`ImportTorrents`) gains archive count rows, split restore toggles, and a new category path mapping fieldset that reuses the existing save-path-mapping FormArray pattern. The qBittorrent settings Storage tab gains a "Save Management" fieldset with four `ng-select` dropdowns bound to existing `QbAppPreferences` boolean fields.

**Tech Stack:** Angular 20 (zoneless, signals, reactive forms, `ng-select`, `NgbPopover`, `NgbModal`), Electron main process (TypeScript, `qbRequest` axios proxy, `adm-zip`, `archiver`), Vitest for tests, `@ngx-translate` i18n (`us.json`/`hu.json`).

Reference spec: `docs/superpowers/specs/2026-06-07-bbe-tags-categories-design.md`

---

## Task 1: Add `categories`/`tags` fields to `BbeMetadata`

**Files:**

- Modify: `packages/shared/src/ipc.types.ts:121-128`

This is a purely additive type change (both new fields are optional), so no existing code breaks and no test file covers pure interface declarations. We verify it compiles by building the electron package, which consumes this type.

- [ ] **Step 1: Add the two optional fields to `BbeMetadata`**

In `packages/shared/src/ipc.types.ts`, replace:

```typescript
export interface BbeMetadata {
  version: number;
  exported_at: number;
  source_server: string;
  source_server_name?: string;
  export_mode: ExportMode;
  torrents: BbeTorrentEntry[];
}
```

with:

```typescript
export interface BbeMetadata {
  version: number;
  exported_at: number;
  source_server: string;
  source_server_name?: string;
  export_mode: ExportMode;
  torrents: BbeTorrentEntry[];
  categories?: Record<string, { name: string; savePath: string }>;
  tags?: string[];
}
```

- [ ] **Step 2: Verify the workspace still compiles**

Run: `npm run build:electron`
Expected: Build succeeds with no TypeScript errors (the new fields are optional, so `export.ts`'s existing `metadata` literal is still a valid `BbeMetadata`).

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/ipc.types.ts
git commit -m "#127: add categories/tags fields to BbeMetadata"
```

---

## Task 2: Collect categories and tags during export

**Files:**

- Modify: `packages/electron/src/ipc/export.ts:156-163` (and add a helper function near `applyPathMappings`)
- Test: `packages/electron/src/ipc/export.spec.ts`

The export pipeline already calls `qbRequest` directly (it's the Electron main process - it cannot use Angular's `QbService`). We add a small helper that fetches `/api/v2/torrents/categories` and `/api/v2/torrents/tags` and attaches the results to `metadata`.

- [ ] **Step 1: Write the failing test for the new collection helper**

Add this `describe` block to the end of `packages/electron/src/ipc/export.spec.ts` (after the `applyPathMappings` block, before the final closing - i.e. insert before line 137's lone `});`... actually append as a sibling top-level `describe`, right after the `applyPathMappings` block's closing `});` on line 136):

```typescript
describe('collectCategoriesAndTags', () => {
  const mockQbRequest = vi.hoisted(() => vi.fn());

  beforeEach(() => {
    vi.resetModules();
    vi.doMock('./qbittorrent.js', () => ({ qbRequest: mockQbRequest }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('./qbittorrent.js');
  });

  async function setup() {
    return import('./export.js');
  }

  it('returns categories and tags fetched from the server', async () => {
    mockQbRequest.mockImplementation(({ path }: { path: string }) => {
      if (path === '/api/v2/torrents/categories') {
        return Promise.resolve({ Movies: { name: 'Movies', savePath: '/data/movies' } });
      }
      if (path === '/api/v2/torrents/tags') {
        return Promise.resolve(['linux', 'documentary']);
      }
      throw new Error(`unexpected path ${path}`);
    });

    const { collectCategoriesAndTags } = await setup();
    const result = await collectCategoriesAndTags('server-1');

    expect(result.categories).toEqual({ Movies: { name: 'Movies', savePath: '/data/movies' } });
    expect(result.tags).toEqual(['linux', 'documentary']);
  });

  it('returns empty collections when the server has none', async () => {
    mockQbRequest.mockImplementation(({ path }: { path: string }) => {
      if (path === '/api/v2/torrents/categories') return Promise.resolve({});
      if (path === '/api/v2/torrents/tags') return Promise.resolve([]);
      throw new Error(`unexpected path ${path}`);
    });

    const { collectCategoriesAndTags } = await setup();
    const result = await collectCategoriesAndTags('server-1');

    expect(result.categories).toEqual({});
    expect(result.tags).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=@bitbutler/electron -- export.spec.ts -t collectCategoriesAndTags`
Expected: FAIL with `collectCategoriesAndTags is not a function` (or similar - the export doesn't exist yet)

- [ ] **Step 3: Implement `collectCategoriesAndTags`**

In `packages/electron/src/ipc/export.ts`, add this function directly after `applyPathMappings` (after its closing brace, around line 65):

```typescript
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --workspace=@bitbutler/electron -- export.spec.ts -t collectCategoriesAndTags`
Expected: PASS (2 tests)

- [ ] **Step 5: Wire the collected data into the export metadata**

In `packages/electron/src/ipc/export.ts`, replace the metadata block (currently lines 156-163):

```typescript
const metadata: BbeMetadata = {
  version: 1,
  exported_at: Math.floor(Date.now() / 1000),
  source_server: serverId,
  source_server_name: serverName,
  export_mode: isFullMode ? 'full' : 'legacy',
  torrents: entries,
};
```

with:

```typescript
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
```

- [ ] **Step 6: Run the full export test suite to verify nothing broke**

Run: `npm test --workspace=@bitbutler/electron -- export.spec.ts`
Expected: PASS (all tests, including the 2 new ones)

- [ ] **Step 7: Commit**

```bash
git add packages/electron/src/ipc/export.ts packages/electron/src/ipc/export.spec.ts
git commit -m "#127: collect categories and tags during export"
```

---

## Task 3: Split the `category_tags` restore field into `categories` and `tags`

**Files:**

- Modify: `packages/shared/src/ipc.types.ts:59-69`
- Modify: `packages/app/src/app/components/modals/import-torrents/import-torrents.ts:56-67,113-129`
- Modify: `packages/electron/src/ipc/export.ts:351-352`
- Modify: `public/i18n/us.json:711`
- Modify: `public/i18n/hu.json:711`

The combined `'category_tags'` restore key becomes two independent keys, `'categories'` and `'tags'`. Because `ImportTorrents` builds its restore-fields form group and its `restoreFields` payload generically (by iterating `restoreFieldKeys` / the form group's entries), renaming the key to two keys requires no special-case logic - the existing `@for` loop and `startImport()` mapping handle it automatically. This task keeps the rename atomic across the shared type, both consumers (`addTorrent` in `export.ts` and the import form), and the i18n strings, so the workspace compiles at every commit.

- [ ] **Step 1: Update the `ImportRestoreField` union**

In `packages/shared/src/ipc.types.ts`, replace:

```typescript
export type ImportRestoreField =
  | 'save_path'
  | 'category_tags'
  | 'speed_limits'
  | 'share_limits'
  | 'renames'
  | 'priorities'
  | 'auto_tmm'
  | 'sequential_download'
  | 'super_seeding'
  | 'first_last_piece_prio';
```

with:

```typescript
export type ImportRestoreField =
  | 'save_path'
  | 'categories'
  | 'tags'
  | 'speed_limits'
  | 'share_limits'
  | 'renames'
  | 'priorities'
  | 'auto_tmm'
  | 'sequential_download'
  | 'super_seeding'
  | 'first_last_piece_prio';
```

- [ ] **Step 2: Update `addTorrent`'s restore checks in `export.ts`**

In `packages/electron/src/ipc/export.ts`, replace lines 351-352:

```typescript
if (has('category_tags') && entry.category) addOptions['category'] = entry.category;
if (has('category_tags') && entry.tags?.length) addOptions['tags'] = entry.tags.join(',');
```

with:

```typescript
if (has('categories') && entry.category) addOptions['category'] = entry.category;
if (has('tags') && entry.tags?.length) addOptions['tags'] = entry.tags.join(',');
```

- [ ] **Step 3: Update `restoreFieldKeys` in `import-torrents.ts`**

In `packages/app/src/app/components/modals/import-torrents/import-torrents.ts`, replace lines 56-67:

```typescript
  readonly restoreFieldKeys: ImportRestoreField[] = [
    'save_path',
    'category_tags',
    'speed_limits',
    'share_limits',
    'renames',
    'priorities',
    'auto_tmm',
    'sequential_download',
    'super_seeding',
    'first_last_piece_prio',
  ];
```

with:

```typescript
  readonly restoreFieldKeys: ImportRestoreField[] = [
    'save_path',
    'categories',
    'tags',
    'speed_limits',
    'share_limits',
    'renames',
    'priorities',
    'auto_tmm',
    'sequential_download',
    'super_seeding',
    'first_last_piece_prio',
  ];
```

- [ ] **Step 4: Update the `restoreFields` form group**

In the same file, in `ngOnInit` (around lines 116-127), replace:

```typescript
      restoreFields: new FormGroup({
        save_path: new FormControl(true, { nonNullable: true }),
        category_tags: new FormControl(true, { nonNullable: true }),
        speed_limits: new FormControl(true, { nonNullable: true }),
```

with:

```typescript
      restoreFields: new FormGroup({
        save_path: new FormControl(true, { nonNullable: true }),
        categories: new FormControl(true, { nonNullable: true }),
        tags: new FormControl(true, { nonNullable: true }),
        speed_limits: new FormControl(true, { nonNullable: true }),
```

- [ ] **Step 5: Update i18n keys in `us.json`**

In `public/i18n/us.json`, replace line 711:

```json
          "category_tags": "Category and tags",
```

with:

```json
          "categories": "Categories",
          "tags": "Tags",
```

- [ ] **Step 6: Update i18n keys in `hu.json`**

In `public/i18n/hu.json`, replace line 711:

```json
          "category_tags": "Category and tags",
```

with:

```json
          "categories": "Categories",
          "tags": "Tags",
```

(English placeholders, matching the existing convention in this section - `restore` and `path-remap` are not yet translated to Hungarian.)

- [ ] **Step 7: Run the import-torrents and export test suites to verify nothing broke**

Run: `npm test --workspace=@bitbutler/app -- import-torrents.spec.ts`
Run: `npm test --workspace=@bitbutler/electron -- export.spec.ts`
Expected: Both PASS - the existing "should default all restore fields to true" test still passes because it checks generically over `Object.values(fields)`.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/ipc.types.ts packages/electron/src/ipc/export.ts packages/app/src/app/components/modals/import-torrents/import-torrents.ts public/i18n/us.json public/i18n/hu.json
git commit -m "#127: split category_tags restore field into categories and tags"
```

---

## Task 4: Restore categories and tags during import (Step 0)

**Files:**

- Modify: `packages/shared/src/ipc.types.ts:141-147`
- Modify: `packages/electron/src/ipc/export.ts:253-327` (add a new function + wire it into `runImport`)
- Modify: `packages/app/src/app/components/modals/import-torrents/import-torrents.ts:192-212`
- Test: `packages/electron/src/ipc/export.spec.ts`

This adds the four new `ImportStartPayload` fields and a `restoreCategoriesAndTags` step that runs before torrents are added. To keep the workspace compiling at every commit, `startImport()` is updated in this same task to populate the new payload fields - `restoreCategories`/`restoreTags` are derived directly from the (already-split) restore toggles, while `categoryPathMappings`/`overwriteCategories` are sent as `[]`/`false` for now. Task 7 replaces those two with real form-bound values once the category path mapping fieldset exists.

- [ ] **Step 1: Add the four new fields to `ImportStartPayload`**

In `packages/shared/src/ipc.types.ts`, replace:

```typescript
export interface ImportStartPayload {
  serverId: string;
  bbePath: string;
  restoreFields: ImportRestoreField[];
  startMode: ImportStartMode;
  pathMappings: BbePathMapping[];
}
```

with:

```typescript
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
}
```

- [ ] **Step 2: Write the failing test for `restoreCategoriesAndTags`**

Append this `describe` block to the end of `packages/electron/src/ipc/export.spec.ts`:

```typescript
describe('restoreCategoriesAndTags', () => {
  const mockQbRequest = vi.hoisted(() => vi.fn());

  beforeEach(() => {
    vi.resetModules();
    vi.doMock('./qbittorrent.js', () => ({ qbRequest: mockQbRequest }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('./qbittorrent.js');
  });

  async function setup() {
    return import('./export.js');
  }

  it('does nothing when both restoreCategories and restoreTags are false', async () => {
    const { restoreCategoriesAndTags } = await setup();
    await restoreCategoriesAndTags(
      'server-1',
      { categories: { Movies: { name: 'Movies', savePath: '/data/movies' } }, tags: ['linux'] },
      false,
      false,
      [],
      false,
    );
    expect(mockQbRequest).not.toHaveBeenCalled();
  });

  it('creates tags via createTags when restoreTags is true', async () => {
    mockQbRequest.mockResolvedValue(undefined);
    const { restoreCategoriesAndTags } = await setup();
    await restoreCategoriesAndTags(
      'server-1',
      { categories: {}, tags: ['linux', 'docs'] },
      false,
      true,
      [],
      false,
    );

    expect(mockQbRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'server-1',
        method: 'POST',
        path: '/api/v2/torrents/createTags',
        form: { tags: 'linux,docs' },
      }),
    );
  });

  it('creates a category that does not exist on the target server', async () => {
    mockQbRequest.mockImplementation(({ path }: { path: string }) => {
      if (path === '/api/v2/torrents/categories') return Promise.resolve({});
      return Promise.resolve(undefined);
    });
    const { restoreCategoriesAndTags } = await setup();
    await restoreCategoriesAndTags(
      'server-1',
      { categories: { Movies: { name: 'Movies', savePath: '/data/movies' } }, tags: [] },
      true,
      false,
      [],
      false,
    );

    expect(mockQbRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        path: '/api/v2/torrents/createCategory',
        form: { category: 'Movies', savePath: '/data/movies' },
      }),
    );
  });

  it('leaves an existing category untouched when overwriteCategories is false', async () => {
    mockQbRequest.mockImplementation(({ path }: { path: string }) => {
      if (path === '/api/v2/torrents/categories') {
        return Promise.resolve({ Movies: { name: 'Movies', savePath: '/old/movies' } });
      }
      return Promise.resolve(undefined);
    });
    const { restoreCategoriesAndTags } = await setup();
    await restoreCategoriesAndTags(
      'server-1',
      { categories: { Movies: { name: 'Movies', savePath: '/data/movies' } }, tags: [] },
      true,
      false,
      [],
      false,
    );

    expect(mockQbRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({ path: '/api/v2/torrents/editCategory' }),
    );
    expect(mockQbRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({ path: '/api/v2/torrents/createCategory' }),
    );
  });

  it('edits an existing category via editCategory when overwriteCategories is true', async () => {
    mockQbRequest.mockImplementation(({ path }: { path: string }) => {
      if (path === '/api/v2/torrents/categories') {
        return Promise.resolve({ Movies: { name: 'Movies', savePath: '/old/movies' } });
      }
      return Promise.resolve(undefined);
    });
    const { restoreCategoriesAndTags } = await setup();
    await restoreCategoriesAndTags(
      'server-1',
      { categories: { Movies: { name: 'Movies', savePath: '/data/movies' } }, tags: [] },
      true,
      false,
      [],
      true,
    );

    expect(mockQbRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        path: '/api/v2/torrents/editCategory',
        form: { category: 'Movies', savePath: '/data/movies' },
      }),
    );
  });

  it('applies categoryPathMappings before creating a category', async () => {
    mockQbRequest.mockImplementation(({ path }: { path: string }) => {
      if (path === '/api/v2/torrents/categories') return Promise.resolve({});
      return Promise.resolve(undefined);
    });
    const { restoreCategoriesAndTags } = await setup();
    await restoreCategoriesAndTags(
      'server-1',
      { categories: { Movies: { name: 'Movies', savePath: '/old/movies' } }, tags: [] },
      true,
      false,
      [{ from: '/old', to: '/data' }],
      false,
    );

    expect(mockQbRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/v2/torrents/createCategory',
        form: { category: 'Movies', savePath: '/data/movies' },
      }),
    );
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test --workspace=@bitbutler/electron -- export.spec.ts -t restoreCategoriesAndTags`
Expected: FAIL with `restoreCategoriesAndTags is not a function`

- [ ] **Step 4: Implement `restoreCategoriesAndTags`**

In `packages/electron/src/ipc/export.ts`, add this function directly after `collectCategoriesAndTags` (added in Task 2):

```typescript
async function restoreCategoriesAndTags(
  serverId: string,
  metadata: Pick<BbeMetadata, 'categories' | 'tags'>,
  restoreCategories: boolean,
  restoreTags: boolean,
  categoryPathMappings: BbePathMapping[],
  overwriteCategories: boolean,
): Promise<void> {
  if (restoreTags && metadata.tags?.length) {
    await qbRequest({
      id: serverId,
      method: 'POST',
      path: '/api/v2/torrents/createTags',
      form: { tags: metadata.tags.join(',') },
    }).catch(() => {});
  }

  if (restoreCategories && metadata.categories) {
    const existing = (await qbRequest({
      id: serverId,
      path: '/api/v2/torrents/categories',
    }).catch(() => ({}))) as Record<string, { name: string; savePath: string }>;

    for (const [name, category] of Object.entries(metadata.categories)) {
      const mappedPath = applyPathMappings(category.savePath, categoryPathMappings);

      if (!(name in existing)) {
        await qbRequest({
          id: serverId,
          method: 'POST',
          path: '/api/v2/torrents/createCategory',
          form: { category: name, savePath: mappedPath },
        }).catch(() => {});
      } else if (overwriteCategories) {
        await qbRequest({
          id: serverId,
          method: 'POST',
          path: '/api/v2/torrents/editCategory',
          form: { category: name, savePath: mappedPath },
        }).catch(() => {});
      }
    }
  }
}
```

Add `BbePathMapping` to the existing `import type { ... } from '@bitbutler/shared'` block at the top of the file (it currently imports `BbeMetadata`, `BbeTorrentEntry`, `BbeTorrentFile`, `ExportDoneEvent`, `ExportProgressEvent`, `ExportStartPayload`, `ImportStartPayload` - add `BbePathMapping` alphabetically after `BbeMetadata`).

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test --workspace=@bitbutler/electron -- export.spec.ts -t restoreCategoriesAndTags`
Expected: PASS (7 tests)

- [ ] **Step 6: Wire `restoreCategoriesAndTags` into `runImport` as Step 0**

In `packages/electron/src/ipc/export.ts`, in `runImport`:

First, destructure the new payload fields. Replace line 255:

```typescript
const { serverId, bbePath, restoreFields, startMode, pathMappings } = payload;
```

with:

```typescript
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
} = payload;
```

Then, call the restoration step before Phase 1. Replace:

```typescript
const torrents = metadata.torrents.filter((t) => !t.failed);
let skipped = 0;

// Phase 1: add all torrents as fast as possible
```

with:

```typescript
const torrents = metadata.torrents.filter((t) => !t.failed);
let skipped = 0;

// Step 0: restore categories and tags before any torrent references them
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

// Phase 1: add all torrents as fast as possible
```

- [ ] **Step 7: Update `startImport()` in `import-torrents.ts` to populate the new payload fields**

In `packages/app/src/app/components/modals/import-torrents/import-torrents.ts`, replace the `payload` construction (lines 202-208):

```typescript
const payload: ImportStartPayload = {
  serverId: this.serverStore.currentServer()?.id ?? '',
  bbePath: this.loadedBbePath || this.initialBbePath() || '',
  restoreFields,
  startMode: raw.startMode,
  pathMappings,
};
```

with:

```typescript
const payload: ImportStartPayload = {
  serverId: this.serverStore.currentServer()?.id ?? '',
  bbePath: this.loadedBbePath || this.initialBbePath() || '',
  restoreFields,
  startMode: raw.startMode,
  pathMappings,
  restoreCategories: raw.restoreFields.categories,
  restoreTags: raw.restoreFields.tags,
  categoryPathMappings: [],
  overwriteCategories: false,
};
```

- [ ] **Step 8: Run the full electron and app test suites to verify nothing broke**

Run: `npm test --workspace=@bitbutler/electron -- export.spec.ts`
Run: `npm test --workspace=@bitbutler/app -- import-torrents.spec.ts`
Expected: Both PASS

- [ ] **Step 9: Commit**

```bash
git add packages/shared/src/ipc.types.ts packages/electron/src/ipc/export.ts packages/electron/src/ipc/export.spec.ts packages/app/src/app/components/modals/import-torrents/import-torrents.ts
git commit -m "#127: restore categories and tags before adding torrents on import"
```

---

## Task 5: Add "Save Management" fieldset to qBittorrent Storage settings

**Files:**

- Modify: `packages/app/src/app/pages/qb-settings/storage/storage.ts`
- Modify: `packages/app/src/app/pages/qb-settings/storage/storage.html`
- Modify: `public/i18n/us.json:1326-1346`
- Modify: `public/i18n/hu.json:1326-1346`
- Test: `packages/app/src/app/pages/qb-settings/storage/storage.spec.ts`

All four TMM preferences (`auto_tmm_enabled`, `torrent_changed_tmm_enabled`, `category_changed_tmm_enabled`, `save_path_changed_tmm_enabled`) already exist as `boolean` on `QbAppPreferences` (`packages/app/src/app/models/qbittorrent.model.ts:106,119,248,274`) and are already fetched/saved by the existing `getAppPreferences`/`setAppPreferences` flow - no model changes needed. We add four `ng-select` dropdowns (matching the existing `torrent_content_layout` pattern) mapping `boolean` values to readable labels.

- [ ] **Step 1: Write the failing test for the new form controls and save payload**

In `packages/app/src/app/pages/qb-settings/storage/storage.spec.ts`, update `MOCK_PREFS` (lines 8-14) to include the four new boolean preferences:

```typescript
const MOCK_PREFS: any = {
  save_path: '/mnt/storage',
  temp_path_enabled: true,
  temp_path: '/mnt/tmp',
  incomplete_files_ext: true,
  torrent_content_layout: 'Subfolder',
  auto_tmm_enabled: false,
  torrent_changed_tmm_enabled: true,
  category_changed_tmm_enabled: false,
  save_path_changed_tmm_enabled: true,
};
```

Then add this test inside the existing `describe('Storage', ...)` block, after the `'should patch form from preferences on init'` test (after line 65's closing `});`):

```typescript
it('should patch the TMM form controls from preferences on init', () => {
  const v = component.form.getRawValue();
  expect(v.auto_tmm_enabled).toBe(false);
  expect(v.torrent_changed_tmm_enabled).toBe(true);
  expect(v.category_changed_tmm_enabled).toBe(false);
  expect(v.save_path_changed_tmm_enabled).toBe(true);
});

it('should include the TMM preferences when saving', async () => {
  component.form.controls.auto_tmm_enabled.setValue(true);
  await (component as any).save();
  expect(qbServiceMock.setAppPreferences).toHaveBeenCalledWith(
    'server-1',
    expect.objectContaining({
      auto_tmm_enabled: true,
      torrent_changed_tmm_enabled: true,
      category_changed_tmm_enabled: false,
      save_path_changed_tmm_enabled: true,
    }),
  );
});
```

This requires the mocked `QbService` provider to be reachable as `qbServiceMock` from the test body. Update the provider setup (lines 36-39) to capture it in a named variable declared alongside the others:

Replace:

```typescript
let component: Storage;
let fixture: ComponentFixture<Storage>;
```

with:

```typescript
let component: Storage;
let fixture: ComponentFixture<Storage>;
let qbServiceMock: { setAppPreferences: ReturnType<typeof vi.fn> };
```

Replace:

```typescript
        {
          provide: QbService,
          useValue: { setAppPreferences: vi.fn().mockResolvedValue(undefined) },
        },
```

with:

```typescript
        { provide: QbService, useValue: qbServiceMock },
```

And add the assignment before `await TestBed.configureTestingModule(...)` (right after the `stateServiceMock = { ... };` block, before the `await TestBed...` call):

```typescript
qbServiceMock = { setAppPreferences: vi.fn().mockResolvedValue(undefined) };
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=@bitbutler/app -- storage.spec.ts`
Expected: FAIL - `auto_tmm_enabled` is `undefined` on the raw form value (control doesn't exist yet)

- [ ] **Step 3: Add the four TMM form controls and dropdown option lists**

In `packages/app/src/app/pages/qb-settings/storage/storage.ts`:

Add a second option-list interface and the two option arrays directly after the `contentLayouts` array (after its closing `];` around line 63):

```typescript
  public readonly autoTmmModes: TmmOption[] = [
    {
      value: true,
      label: this.translateService.instant('pages.qb-settings.tab.storage.tmm-mode.automatic'),
    },
    {
      value: false,
      label: this.translateService.instant('pages.qb-settings.tab.storage.tmm-mode.manual'),
    },
  ];

  public readonly tmmChangeBehaviors: TmmOption[] = [
    {
      value: false,
      label: this.translateService.instant('pages.qb-settings.tab.storage.tmm-behavior.relocate'),
    },
    {
      value: true,
      label: this.translateService.instant('pages.qb-settings.tab.storage.tmm-behavior.manual'),
    },
  ];
```

Add the `TmmOption` interface next to `ContentLayoutOption` (after its closing brace, around line 22):

```typescript
interface TmmOption {
  value: boolean;
  label: string;
}
```

Add the four controls to the `form` definition. Replace:

```typescript
  public form = new FormGroup({
    save_path: new FormControl<string>('', { nonNullable: true }),
    temp_path_enabled: new FormControl<boolean>(false, { nonNullable: true }),
    temp_path: new FormControl<string>('', { nonNullable: true }),
    incomplete_files_ext: new FormControl<boolean>(false, { nonNullable: true }),
    torrent_content_layout: new FormControl<string>('Original', { nonNullable: true }),
  });
```

with:

```typescript
  public form = new FormGroup({
    save_path: new FormControl<string>('', { nonNullable: true }),
    temp_path_enabled: new FormControl<boolean>(false, { nonNullable: true }),
    temp_path: new FormControl<string>('', { nonNullable: true }),
    incomplete_files_ext: new FormControl<boolean>(false, { nonNullable: true }),
    torrent_content_layout: new FormControl<string>('Original', { nonNullable: true }),
    auto_tmm_enabled: new FormControl<boolean>(false, { nonNullable: true }),
    torrent_changed_tmm_enabled: new FormControl<boolean>(false, { nonNullable: true }),
    category_changed_tmm_enabled: new FormControl<boolean>(false, { nonNullable: true }),
    save_path_changed_tmm_enabled: new FormControl<boolean>(false, { nonNullable: true }),
  });
```

- [ ] **Step 4: Patch the new controls from preferences and include them when saving**

In `ngOnInit`, extend the `patchValue` call. Replace:

```typescript
this.form.patchValue(
  {
    save_path: prefs.save_path,
    temp_path_enabled: prefs.temp_path_enabled,
    temp_path: prefs.temp_path,
    incomplete_files_ext: prefs.incomplete_files_ext,
    torrent_content_layout: prefs.torrent_content_layout,
  },
  { emitEvent: false },
);
```

with:

```typescript
this.form.patchValue(
  {
    save_path: prefs.save_path,
    temp_path_enabled: prefs.temp_path_enabled,
    temp_path: prefs.temp_path,
    incomplete_files_ext: prefs.incomplete_files_ext,
    torrent_content_layout: prefs.torrent_content_layout,
    auto_tmm_enabled: prefs.auto_tmm_enabled,
    torrent_changed_tmm_enabled: prefs.torrent_changed_tmm_enabled,
    category_changed_tmm_enabled: prefs.category_changed_tmm_enabled,
    save_path_changed_tmm_enabled: prefs.save_path_changed_tmm_enabled,
  },
  { emitEvent: false },
);
```

In `save()`, replace:

```typescript
  private async save(): Promise<void> {
    const v = this.form.getRawValue();
    await this.qbService.setAppPreferences(this.serverStoreService.currentServerId()!, {
      save_path: v.save_path,
      temp_path_enabled: v.temp_path_enabled,
      temp_path: v.temp_path,
      incomplete_files_ext: v.incomplete_files_ext,
      torrent_content_layout: v.torrent_content_layout,
    });
  }
```

with:

```typescript
  private async save(): Promise<void> {
    const v = this.form.getRawValue();
    await this.qbService.setAppPreferences(this.serverStoreService.currentServerId()!, {
      save_path: v.save_path,
      temp_path_enabled: v.temp_path_enabled,
      temp_path: v.temp_path,
      incomplete_files_ext: v.incomplete_files_ext,
      torrent_content_layout: v.torrent_content_layout,
      auto_tmm_enabled: v.auto_tmm_enabled,
      torrent_changed_tmm_enabled: v.torrent_changed_tmm_enabled,
      category_changed_tmm_enabled: v.category_changed_tmm_enabled,
      save_path_changed_tmm_enabled: v.save_path_changed_tmm_enabled,
    });
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test --workspace=@bitbutler/app -- storage.spec.ts`
Expected: PASS (all tests, including the 2 new ones)

- [ ] **Step 6: Add i18n keys to `us.json`**

In `public/i18n/us.json`, replace the `storage` block (lines 1326-1346):

```json
        "storage": {
          "title": "Storage",
          "description": "Manage where torrents are saved, how temporary files are handled, and file naming options.",
          "label": {
            "default-paths": "Default Paths",
            "temp-files": "Temporary Files",
            "file-management": "File Management"
          },
          "field": {
            "save-path": "Default Save Path",
            "temp-path-enabled": "Keep incomplete torrents in a separate folder",
            "temp-path": "Incomplete Save Path",
            "incomplete-files-ext": "Append .!qB extension to incomplete files",
            "torrent-content-layout": "Torrent content layout"
          },
          "content-layout": {
            "original": "Original",
            "subfolder": "Create subfolder",
            "no-subfolder": "Don't create subfolder"
          }
        },
```

with:

```json
        "storage": {
          "title": "Storage",
          "description": "Manage where torrents are saved, how temporary files are handled, and file naming options.",
          "label": {
            "default-paths": "Default Paths",
            "temp-files": "Temporary Files",
            "file-management": "File Management",
            "save-management": "Save Management"
          },
          "field": {
            "save-path": "Default Save Path",
            "temp-path-enabled": "Keep incomplete torrents in a separate folder",
            "temp-path": "Incomplete Save Path",
            "incomplete-files-ext": "Append .!qB extension to incomplete files",
            "torrent-content-layout": "Torrent content layout",
            "auto-tmm-enabled": "Default torrent management mode",
            "torrent-changed-tmm-enabled": "When torrent category changes",
            "category-changed-tmm-enabled": "When category save path changes",
            "save-path-changed-tmm-enabled": "When default save path changes"
          },
          "content-layout": {
            "original": "Original",
            "subfolder": "Create subfolder",
            "no-subfolder": "Don't create subfolder"
          },
          "tmm-mode": {
            "automatic": "Automatic",
            "manual": "Manual"
          },
          "tmm-behavior": {
            "relocate": "Relocate torrents",
            "manual": "Switch to Manual mode"
          }
        },
```

- [ ] **Step 7: Add i18n keys to `hu.json`**

In `public/i18n/hu.json`, replace the `storage` block (lines 1326-1346):

```json
        "storage": {
          "title": "Tárhely",
          "description": "Kezelje a torrentek mentési helyét, az ideiglenes fájlok kezelését és a fájlelnevezési lehetőségeket.",
          "label": {
            "default-paths": "Alapértelmezett Útvonalak",
            "temp-files": "Ideiglenes Fájlok",
            "file-management": "Fájlkezelés"
          },
          "field": {
            "save-path": "Alapértelmezett Mentési Útvonal",
            "temp-path-enabled": "Befejezetlen torrentek külön mappában tartása",
            "temp-path": "Befejezetlen Fájlok Mentési Útvonala",
            "incomplete-files-ext": ".!qB kiterjesztés hozzáfűzése befejezetlen fájlokhoz",
            "torrent-content-layout": "Torrent tartalomszerkezet"
          },
          "content-layout": {
            "original": "Eredeti",
            "subfolder": "Almappa létrehozása",
            "no-subfolder": "Ne hozzon létre almappát"
          }
        },
```

with:

```json
        "storage": {
          "title": "Tárhely",
          "description": "Kezelje a torrentek mentési helyét, az ideiglenes fájlok kezelését és a fájlelnevezési lehetőségeket.",
          "label": {
            "default-paths": "Alapértelmezett Útvonalak",
            "temp-files": "Ideiglenes Fájlok",
            "file-management": "Fájlkezelés",
            "save-management": "Mentéskezelés"
          },
          "field": {
            "save-path": "Alapértelmezett Mentési Útvonal",
            "temp-path-enabled": "Befejezetlen torrentek külön mappában tartása",
            "temp-path": "Befejezetlen Fájlok Mentési Útvonala",
            "incomplete-files-ext": ".!qB kiterjesztés hozzáfűzése befejezetlen fájlokhoz",
            "torrent-content-layout": "Torrent tartalomszerkezet",
            "auto-tmm-enabled": "Alapértelmezett torrent kezelési mód",
            "torrent-changed-tmm-enabled": "Amikor a torrent kategóriája megváltozik",
            "category-changed-tmm-enabled": "Amikor a kategória mentési útvonala megváltozik",
            "save-path-changed-tmm-enabled": "Amikor az alapértelmezett mentési útvonal megváltozik"
          },
          "content-layout": {
            "original": "Eredeti",
            "subfolder": "Almappa létrehozása",
            "no-subfolder": "Ne hozzon létre almappát"
          },
          "tmm-mode": {
            "automatic": "Automatikus",
            "manual": "Kézi"
          },
          "tmm-behavior": {
            "relocate": "Torrentek áthelyezése",
            "manual": "Váltás kézi módra"
          }
        },
```

- [ ] **Step 8: Add the "Save Management" fieldset to the template**

In `packages/app/src/app/pages/qb-settings/storage/storage.html`, add a new fieldset after the closing `</fieldset>` of "File Management" (after line 90's `</fieldset>`, before the closing `</div>`/`</form>` on lines 91-92):

```html
<fieldset class="bb-fieldset">
  <legend>{{ 'pages.qb-settings.tab.storage.label.save-management' | translate }}</legend>
  <div class="container">
    <div class="row mb-3">
      <div class="col-6 d-flex align-items-center">
        {{ 'pages.qb-settings.tab.storage.field.auto-tmm-enabled' | translate }}
      </div>
      <div class="col-6">
        <ng-select
          [items]="autoTmmModes"
          [clearable]="false"
          [searchable]="false"
          bindLabel="label"
          bindValue="value"
          formControlName="auto_tmm_enabled"
          appendTo="ngb-modal-window"
        ></ng-select>
      </div>
    </div>
    <div class="row mb-3">
      <div class="col-6 d-flex align-items-center">
        {{ 'pages.qb-settings.tab.storage.field.torrent-changed-tmm-enabled' | translate }}
      </div>
      <div class="col-6">
        <ng-select
          [items]="tmmChangeBehaviors"
          [clearable]="false"
          [searchable]="false"
          bindLabel="label"
          bindValue="value"
          formControlName="torrent_changed_tmm_enabled"
          appendTo="ngb-modal-window"
        ></ng-select>
      </div>
    </div>
    <div class="row mb-3">
      <div class="col-6 d-flex align-items-center">
        {{ 'pages.qb-settings.tab.storage.field.category-changed-tmm-enabled' | translate }}
      </div>
      <div class="col-6">
        <ng-select
          [items]="tmmChangeBehaviors"
          [clearable]="false"
          [searchable]="false"
          bindLabel="label"
          bindValue="value"
          formControlName="category_changed_tmm_enabled"
          appendTo="ngb-modal-window"
        ></ng-select>
      </div>
    </div>
    <div class="row">
      <div class="col-6 d-flex align-items-center">
        {{ 'pages.qb-settings.tab.storage.field.save-path-changed-tmm-enabled' | translate }}
      </div>
      <div class="col-6">
        <ng-select
          [items]="tmmChangeBehaviors"
          [clearable]="false"
          [searchable]="false"
          bindLabel="label"
          bindValue="value"
          formControlName="save_path_changed_tmm_enabled"
          appendTo="ngb-modal-window"
        ></ng-select>
      </div>
    </div>
  </div>
</fieldset>
```

- [ ] **Step 9: Start the dev server and verify the fieldset renders correctly**

Run: `npm start`
Open the app, log into a server, open qBittorrent Settings → Storage tab, and verify:

- The "Save Management" fieldset appears below "File Management" with four dropdowns
- Each dropdown shows the correct current value from the server preferences
- Changing a dropdown marks the tab dirty and saving persists the change (verify via qBittorrent's own WebUI or by reopening the settings)

- [ ] **Step 10: Commit**

```bash
git add packages/app/src/app/pages/qb-settings/storage/storage.ts packages/app/src/app/pages/qb-settings/storage/storage.html packages/app/src/app/pages/qb-settings/storage/storage.spec.ts public/i18n/us.json public/i18n/hu.json
git commit -m "#127: add Save Management fieldset to qBittorrent storage settings"
```

---

## Task 6: Add `initialTab` input to the QbSettings modal

**Files:**

- Modify: `packages/app/src/app/pages/qb-settings/qb-settings.ts`
- Test: `packages/app/src/app/pages/qb-settings/qb-settings.spec.ts`

This lets the import modal open qBittorrent Settings stacked on top of itself, pre-selecting the Storage tab (mirroring the existing `tabToOpen` pattern used by `Settings`/`TorrentDetails`).

- [ ] **Step 1: Write the failing test**

In `packages/app/src/app/pages/qb-settings/qb-settings.spec.ts`, add this test inside the `describe('tabs', ...)` block, after the `'should contain bandwidth, storage, queue-limits and seeding-ratios tabs'` test:

```typescript
it('should select the tab passed via initialTab on init', async () => {
  fixture = TestBed.createComponent(QbSettings);
  component = fixture.componentInstance;
  fixture.componentRef.setInput('initialTab', 'storage');
  fixture.detectChanges();
  await fixture.whenStable();

  expect(component.activeTabId()).toBe('storage');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=@bitbutler/app -- qb-settings.spec.ts -t "should select the tab passed via initialTab"`
Expected: FAIL - `activeTabId()` is `'bandwidth'` (the default), not `'storage'`

- [ ] **Step 3: Add the `initialTab` input and apply it in `ngOnInit`**

In `packages/app/src/app/pages/qb-settings/qb-settings.ts`, add `input` to the `@angular/core` import. Replace:

```typescript
import { ChangeDetectionStrategy, Component, OnInit, Type, inject, signal } from '@angular/core';
```

with:

```typescript
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  Type,
  inject,
  input,
  signal,
} from '@angular/core';
```

Add the input declaration directly above `activeTabId` (around line 42):

```typescript
  public readonly initialTab = input<QbSettingsTabId>();

  public activeTabId = signal<QbSettingsTabId>('bandwidth');
```

In `ngOnInit`, apply it at the top of the method. Replace:

```typescript
  public async ngOnInit(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
```

with:

```typescript
  public async ngOnInit(): Promise<void> {
    const initialTab = this.initialTab();
    if (initialTab) this.activeTabId.set(initialTab);

    const serverId = this.serverStoreService.currentServerId();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --workspace=@bitbutler/app -- qb-settings.spec.ts`
Expected: PASS (all tests, including the new one)

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/pages/qb-settings/qb-settings.ts packages/app/src/app/pages/qb-settings/qb-settings.spec.ts
git commit -m "#127: add initialTab input to QbSettings modal"
```

---

## Task 7: Build the import modal's category restoration UI

**Files:**

- Modify: `packages/app/src/app/components/modals/import-torrents/import-torrents.ts`
- Modify: `packages/app/src/app/components/modals/import-torrents/import-torrents.html`
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`
- Test: `packages/app/src/app/components/modals/import-torrents/import-torrents.spec.ts`

This task adds: (1) archive count rows for tags/categories, (2) a `categoryPathMappings` FormArray + `overwriteCategories` toggle wired into the payload (replacing the `[]`/`false` placeholders from Task 4), and (3) the new "Category path mapping" fieldset with an informational TMM note that links to qBittorrent Settings → Storage (stacked modal, using the `initialTab` input from Task 6). The existing `pathMappings` FormArray helpers are generalized to take a `FormArray` argument so both fieldsets can reuse them (DRY).

- [ ] **Step 1: Write the failing tests**

In `packages/app/src/app/components/modals/import-torrents/import-torrents.spec.ts`, add these tests inside the existing `describe('ImportTorrents', ...)` block, after the `'should default all restore fields to true'` test:

```typescript
it('should expose tagsCount and categoriesCount from metadata', () => {
  component.exportService.importState.set({
    phase: 'ready',
    current: 0,
    total: 0,
    name: '',
    skipped: 0,
    metadata: {
      version: 1,
      exported_at: 0,
      source_server: 'srv',
      export_mode: 'full',
      torrents: [],
      tags: ['linux', 'docs'],
      categories: { Movies: { name: 'Movies', savePath: '/data/movies' } },
    },
  } as any);

  expect(component.tagsCount()).toBe(2);
  expect(component.categoriesCount()).toBe(1);
});

it('should show category path mapping only when the categories restore toggle is on', () => {
  component.importForm.get('restoreFields.categories')?.setValue(true);
  expect(component.showCategoryPathMapping()).toBe(true);

  component.importForm.get('restoreFields.categories')?.setValue(false);
  expect(component.showCategoryPathMapping()).toBe(false);
});

it('should add and remove category path mapping rows', () => {
  expect(component.categoryPathMappings.length).toBe(1);

  component.addMapping(component.categoryPathMappings);
  expect(component.categoryPathMappings.length).toBe(2);

  component.removeMapping(component.categoryPathMappings, 1);
  expect(component.categoryPathMappings.length).toBe(1);
});

it('should send restoreCategories, restoreTags, categoryPathMappings and overwriteCategories in the payload', () => {
  component.importForm.get('restoreFields.categories')?.setValue(true);
  component.importForm.get('restoreFields.tags')?.setValue(false);
  component.importForm.get('overwriteCategories')?.setValue(true);
  component.categoryPathMappings.at(0).setValue({ from: '/old', to: '/new' });

  component.startImport();

  expect(window.bitbutler.export.importStart).toHaveBeenCalledWith(
    expect.objectContaining({
      restoreCategories: true,
      restoreTags: false,
      overwriteCategories: true,
      categoryPathMappings: [{ from: '/old', to: '/new' }],
    }),
  );
});
```

These tests need `window.bitbutler.export.importStart` to be a spy and `exportService.importState` to be a writable signal. Update the test module providers (lines 16-31): the `ExportService` mock's `importState` is currently `signal({...})` (a plain `signal`, which is writable), so no change needed there. Add a `beforeEach` that stubs `window.bitbutler`:

Replace:

```typescript
  beforeEach(async () => {
    await TestBed.configureTestingModule({
```

with:

```typescript
  beforeEach(async () => {
    (window as any).bitbutler = {
      export: { importStart: vi.fn(), importCancel: vi.fn(), readBbe: vi.fn() },
    };

    await TestBed.configureTestingModule({
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=@bitbutler/app -- import-torrents.spec.ts`
Expected: FAIL - `tagsCount`, `categoriesCount`, `showCategoryPathMapping`, `categoryPathMappings` don't exist; `addMapping`/`removeMapping` don't accept arguments; `overwriteCategories` control doesn't exist

- [ ] **Step 3: Generalize `addMapping`/`removeMapping` to take a `FormArray`, and add the `categoryPathMappings` getter**

In `packages/app/src/app/components/modals/import-torrents/import-torrents.ts`, replace:

```typescript
  get pathMappings(): FormArray {
    return this.importForm.get('pathMappings') as FormArray;
  }
```

with:

```typescript
  get pathMappings(): FormArray {
    return this.importForm.get('pathMappings') as FormArray;
  }

  get categoryPathMappings(): FormArray {
    return this.importForm.get('categoryPathMappings') as FormArray;
  }
```

Replace:

```typescript
  addMapping(): void {
    this.pathMappings.push(this.createMappingRow());
  }

  removeMapping(i: number): void {
    if (this.pathMappings.length === 1) {
      this.pathMappings.at(0).reset({ from: '', to: '' });
    } else {
      this.pathMappings.removeAt(i);
    }
  }
```

with:

```typescript
  addMapping(array: FormArray): void {
    array.push(this.createMappingRow());
  }

  removeMapping(array: FormArray, i: number): void {
    if (array.length === 1) {
      array.at(0).reset({ from: '', to: '' });
    } else {
      array.removeAt(i);
    }
  }
```

- [ ] **Step 4: Add `tagsCount`/`categoriesCount`/`showCategoryPathMapping` and the new form controls**

Add these computed signals directly after `readonly metadata = computed(...)` (around line 102):

```typescript
  readonly tagsCount = computed(() => this.metadata()?.tags?.length ?? 0);
  readonly categoriesCount = computed(() => Object.keys(this.metadata()?.categories ?? {}).length);
```

Add a private signal and computed for the categories toggle directly after `private savePathEnabled!: ...` (around line 54):

```typescript
  private categoriesEnabled!: ReturnType<typeof toSignal<boolean>>;
```

Add the computed directly after `readonly showPathRemap = computed(...)` (around line 100):

```typescript
  readonly showCategoryPathMapping = computed(() => this.categoriesEnabled?.() === true);
```

In `ngOnInit`, add `categoryPathMappings` and `overwriteCategories` to the form group. Replace:

```typescript
      pathMappings: new FormArray([this.createMappingRow()]),
    });
```

with:

```typescript
      pathMappings: new FormArray([this.createMappingRow()]),
      categoryPathMappings: new FormArray([this.createMappingRow()]),
      overwriteCategories: new FormControl<boolean>(false, { nonNullable: true }),
    });
```

Set up the `categoriesEnabled` signal directly after the `savePathControl`/`savePathEnabled` setup. Replace:

```typescript
const savePathControl = this.importForm.get('restoreFields.save_path')!;
this.savePathEnabled = runInInjectionContext(this.injector, () =>
  toSignal(savePathControl.valueChanges, { initialValue: savePathControl.value as boolean }),
);

const bbePath = this.initialBbePath();
```

with:

```typescript
const savePathControl = this.importForm.get('restoreFields.save_path')!;
this.savePathEnabled = runInInjectionContext(this.injector, () =>
  toSignal(savePathControl.valueChanges, { initialValue: savePathControl.value as boolean }),
);

const categoriesControl = this.importForm.get('restoreFields.categories')!;
this.categoriesEnabled = runInInjectionContext(this.injector, () =>
  toSignal(categoriesControl.valueChanges, {
    initialValue: categoriesControl.value as boolean,
  }),
);

const bbePath = this.initialBbePath();
```

- [ ] **Step 5: Add `openQbSettings()` and wire the real `categoryPathMappings`/`overwriteCategories` values into the payload**

Add the imports needed for modal stacking. Replace:

```typescript
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { LocalTimestampPipe } from '../../../pipes/local-timestamp-pipe';
import { ExportService } from '../../../services/export.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { BbProgress } from '../../bb-progress/bb-progress';
```

with:

```typescript
import { NgbActiveModal, NgbModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { QbSettings } from '../../../pages/qb-settings/qb-settings';
import { LocalTimestampPipe } from '../../../pipes/local-timestamp-pipe';
import { ExportService } from '../../../services/export.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { setModalInput } from '../../../utils/modal-input';
import { BbPopover } from '../../bb-popover/bb-popover';
import { BbProgress } from '../../bb-progress/bb-progress';
```

Add `BbPopover` to the component's `imports` array and inject `NgbModal`. Replace:

```typescript
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    FaIconComponent,
    BbProgress,
    LocalTimestampPipe,
    NgbTooltip,
  ],
```

with:

```typescript
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    FaIconComponent,
    BbProgress,
    BbPopover,
    LocalTimestampPipe,
    NgbTooltip,
  ],
```

Replace:

```typescript
  private readonly activeModal = inject(NgbActiveModal);
  private readonly exportService = inject(ExportService);
```

with:

```typescript
  private readonly activeModal = inject(NgbActiveModal);
  private readonly modalService = inject(NgbModal);
  private readonly exportService = inject(ExportService);
```

Add the `openQbSettings` method directly after `removeMapping`:

```typescript
  openQbSettings(): void {
    const ref = this.modalService.open(QbSettings, { size: 'xl', centered: false, scrollable: true });
    setModalInput(ref, 'initialTab', 'storage');
    ref.result.catch(() => {});
  }
```

Finally, replace the placeholder values in `startImport()`. Replace:

```typescript
const pathMappings: BbePathMapping[] = (
  raw.pathMappings as Array<{ from: string; to: string }>
).filter((r) => r.from.trim());

const payload: ImportStartPayload = {
  serverId: this.serverStore.currentServer()?.id ?? '',
  bbePath: this.loadedBbePath || this.initialBbePath() || '',
  restoreFields,
  startMode: raw.startMode,
  pathMappings,
  restoreCategories: raw.restoreFields.categories,
  restoreTags: raw.restoreFields.tags,
  categoryPathMappings: [],
  overwriteCategories: false,
};
```

with:

```typescript
const pathMappings: BbePathMapping[] = (
  raw.pathMappings as Array<{ from: string; to: string }>
).filter((r) => r.from.trim());

const categoryPathMappings: BbePathMapping[] = (
  raw.categoryPathMappings as Array<{ from: string; to: string }>
).filter((r) => r.from.trim());

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
};
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test --workspace=@bitbutler/app -- import-torrents.spec.ts`
Expected: PASS (all tests, including the 4 new ones)

- [ ] **Step 7: Add i18n keys to `us.json`**

In `public/i18n/us.json`, add two new entries to the `archive` block. Replace:

```json
        "archive": {
          "exported-from": "Exported from",
          "importing-to": "Importing to",
          "server-url": "Server URL",
          "export-date": "Export date",
          "torrents": "Torrents",
          "export-type": "Export type",
          "full-mode": "Full export",
          "legacy-mode": "Legacy export"
        },
```

with:

```json
        "archive": {
          "exported-from": "Exported from",
          "importing-to": "Importing to",
          "server-url": "Server URL",
          "export-date": "Export date",
          "torrents": "Torrents",
          "tags": "Tags",
          "categories": "Categories",
          "export-type": "Export type",
          "full-mode": "Full export",
          "legacy-mode": "Legacy export"
        },
```

Add a `category-path-mapping` label and a section to the `label` block and after `path-remap`. Replace:

```json
        "label": {
          "archive": "Archive",
          "restore-options": "Restore options",
          "path-remap": "Save path remapping",
          "after-import": "After import",
          "progress": "Progress"
        },
```

with:

```json
        "label": {
          "archive": "Archive",
          "restore-options": "Restore options",
          "path-remap": "Save path remapping",
          "category-path-mapping": "Category path mapping",
          "after-import": "After import",
          "progress": "Progress"
        },
```

Add a `category-path-mapping` block directly after the `path-remap` block. Replace:

```json
        "path-remap": {
          "description": "Rewrite save paths when the source and destination servers use different directory structures. Each rule replaces a matching path prefix - the first match wins.",
          "from": "From prefix",
          "to": "To prefix"
        },
```

with:

```json
        "path-remap": {
          "description": "Rewrite save paths when the source and destination servers use different directory structures. Each rule replaces a matching path prefix - the first match wins.",
          "from": "From prefix",
          "to": "To prefix"
        },
        "category-path-mapping": {
          "description": "Rewrite category save paths when the source and destination servers use different directory structures. Each rule replaces a matching path prefix - the first match wins.",
          "note-prefix": "If <strong>When category save path changes</strong> is set to <em>Switch to Manual mode</em>, changing a category's save path will disable Auto TMM on every torrent currently assigned to it - not just the ones being imported. You can review this setting in",
          "note-link": "qBittorrent Settings → Storage",
          "overwrite": "Overwrite existing categories",
          "overwrite-description": "Updates the save path of existing categories using qBittorrent's edit endpoint. This preserves existing torrent assignments but may trigger Auto TMM behavior depending on your 'When category save path changes' setting. If disabled, existing categories are left untouched."
        },
```

- [ ] **Step 8: Add i18n keys to `hu.json`**

In `public/i18n/hu.json`, add the same two `archive` keys (English placeholders, matching the existing convention for this section). Replace:

```json
        "archive": {
          "exported-from": "Exportálva innen",
          "importing-to": "Importálás ide",
          "server-url": "Szerver URL",
          "export-date": "Exportálás dátuma",
          "torrents": "Torrentek",
          "export-type": "Export típusa",
          "full-mode": "Teljes export",
          "legacy-mode": "Örökölt export"
        },
```

with:

```json
        "archive": {
          "exported-from": "Exportálva innen",
          "importing-to": "Importálás ide",
          "server-url": "Szerver URL",
          "export-date": "Exportálás dátuma",
          "torrents": "Torrentek",
          "tags": "Tags",
          "categories": "Categories",
          "export-type": "Export típusa",
          "full-mode": "Teljes export",
          "legacy-mode": "Örökölt export"
        },
```

Add the `category-path-mapping` label. Replace:

```json
        "label": {
          "archive": "Archive",
          "restore-options": "Restore options",
          "path-remap": "Save path remapping",
          "after-import": "After import",
          "progress": "Progress"
        },
```

with:

```json
        "label": {
          "archive": "Archive",
          "restore-options": "Restore options",
          "path-remap": "Save path remapping",
          "category-path-mapping": "Category path mapping",
          "after-import": "After import",
          "progress": "Progress"
        },
```

Add the `category-path-mapping` block directly after `path-remap` (English placeholders, mirroring the existing `path-remap` block which is also untranslated):

```json
        "path-remap": {
          "description": "Rewrite save paths when the source and destination servers use different directory structures. Each rule replaces a matching path prefix - the first match wins.",
          "from": "From prefix",
          "to": "To prefix"
        },
        "category-path-mapping": {
          "description": "Rewrite category save paths when the source and destination servers use different directory structures. Each rule replaces a matching path prefix - the first match wins.",
          "note-prefix": "If <strong>When category save path changes</strong> is set to <em>Switch to Manual mode</em>, changing a category's save path will disable Auto TMM on every torrent currently assigned to it - not just the ones being imported. You can review this setting in",
          "note-link": "qBittorrent Settings → Storage",
          "overwrite": "Overwrite existing categories",
          "overwrite-description": "Updates the save path of existing categories using qBittorrent's edit endpoint. This preserves existing torrent assignments but may trigger Auto TMM behavior depending on your 'When category save path changes' setting. If disabled, existing categories are left untouched."
        },
```

(Replace the original `path-remap` block with this combined version - both blocks together.)

- [ ] **Step 9: Add the archive count rows to the template**

In `packages/app/src/app/components/modals/import-torrents/import-torrents.html`, add two conditional `<dt>`/`<dd>` pairs directly after the "Torrents" row (after line 46's `</dd>`, before the "Export type" `<dt>` on line 48):

```html
@if (metadata()?.tags !== undefined) {
<dt class="col-5 fw-normal text-body-secondary">
  {{ 'components.modals.import-torrents.archive.tags' | translate }}
</dt>
<dd class="col-7">{{ tagsCount() }}</dd>
} @if (metadata()?.categories !== undefined) {
<dt class="col-5 fw-normal text-body-secondary">
  {{ 'components.modals.import-torrents.archive.categories' | translate }}
</dt>
<dd class="col-7">{{ categoriesCount() }}</dd>
}
```

- [ ] **Step 10: Update the existing path mapping fieldset to use the generalized helper signatures**

In the same file, in the "Save path mapping" fieldset (lines 99-166), update the two button click handlers. Replace:

```html
<button type="button" class="btn btn-lg btn-link text-danger" (click)="removeMapping(i)"></button>
```

with:

```html
<button
  type="button"
  class="btn btn-lg btn-link text-danger"
  (click)="removeMapping(pathMappings, i)"
></button>
```

Replace:

```html
                  @if ($last) {
                    <button
                      type="button"
                      class="btn btn-lg btn-link text-success"
                      (click)="addMapping()"
                    >
                      <fa-icon [icon]="icons.faPlus"></fa-icon>
                    </button>
                  }
                </div>
              </div>
            }
          </fieldset>
        }
```

with:

```html
                  @if ($last) {
                    <button
                      type="button"
                      class="btn btn-lg btn-link text-success"
                      (click)="addMapping(pathMappings)"
                    >
                      <fa-icon [icon]="icons.faPlus"></fa-icon>
                    </button>
                  }
                </div>
              </div>
            }
          </fieldset>
        }
```

- [ ] **Step 11: Add the new "Category path mapping" fieldset**

In the same file, add the new fieldset directly after the closing `}` of the "Save path mapping" `@if (showPathRemap())` block (after line 166's `}`, before the "after-import" fieldset on line 168):

```html
@if (showCategoryPathMapping()) {
<fieldset class="bb-fieldset" formArrayName="categoryPathMappings">
  <legend>{{ 'components.modals.import-torrents.label.category-path-mapping' | translate }}</legend>
  <div class="alert alert-info small">
    <span
      [innerHTML]="
                  'components.modals.import-torrents.category-path-mapping.note-prefix'
                    | translate
                "
    ></span>
    <button type="button" class="btn btn-link btn-sm p-0 align-baseline" (click)="openQbSettings()">
      {{ 'components.modals.import-torrents.category-path-mapping.note-link' | translate }}</button
    >.
  </div>
  <div class="form-check form-switch mb-3">
    <input
      class="form-check-input"
      type="checkbox"
      role="switch"
      id="overwrite-categories"
      formControlName="overwriteCategories"
    />
    <label class="form-check-label" for="overwrite-categories">
      {{ 'components.modals.import-torrents.category-path-mapping.overwrite' | translate }}
    </label>
    <bb-popover
      [subject]="
                  'components.modals.import-torrents.category-path-mapping.overwrite' | translate
                "
      [description]="
                  'components.modals.import-torrents.category-path-mapping.overwrite-description'
                    | translate
                "
      placement="right"
    ></bb-popover>
  </div>
  <p class="small mb-3">
    {{ 'components.modals.import-torrents.category-path-mapping.description' | translate }}
  </p>
  @for (group of categoryPathMappings.controls; track $index; let i = $index) {
  <div class="row mb-2" [formGroupName]="i">
    <div class="col-5">
      <div class="form-floating">
        <input
          type="text"
          class="form-control"
          [id]="'cat-from-' + i"
          placeholder="from"
          formControlName="from"
        />
        <label [for]="'cat-from-' + i"
          >{{ 'components.modals.import-torrents.path-remap.from' | translate }}</label
        >
      </div>
    </div>
    <div class="col-5">
      <div class="form-floating">
        <input
          type="text"
          class="form-control"
          [id]="'cat-to-' + i"
          placeholder="to"
          formControlName="to"
        />
        <label [for]="'cat-to-' + i"
          >{{ 'components.modals.import-torrents.path-remap.to' | translate }}</label
        >
      </div>
    </div>
    <div class="col-2 d-flex align-items-center justify-content-center gap-1">
      @if ( !( categoryPathMappings.length === 1 && !group.get('from')?.value &&
      !group.get('to')?.value ) ) {
      <button
        type="button"
        class="btn btn-lg btn-link text-danger"
        (click)="removeMapping(categoryPathMappings, i)"
      >
        <fa-icon [icon]="icons.faMinus"></fa-icon>
      </button>
      } @if ($last) {
      <button
        type="button"
        class="btn btn-lg btn-link text-success"
        (click)="addMapping(categoryPathMappings)"
      >
        <fa-icon [icon]="icons.faPlus"></fa-icon>
      </button>
      }
    </div>
  </div>
  }
</fieldset>
}
```

- [ ] **Step 12: Start the dev server and verify the full import flow in the browser**

Run: `npm start`
Open the app, log into a server, and open the BBE import modal with an archive that contains categories and tags (export one first if needed via the export modal). Verify:

- The "Tags" and "Categories" rows appear in the Archive fieldset with correct counts (and are hidden for older archives without these fields - you can simulate this by editing a `.bbe`'s `metadata.json` to remove the keys)
- The "Categories" and "Tags" restore toggles are independent switches
- Toggling "Categories" off hides the "Category path mapping" fieldset; toggling it on shows it
- The informational note renders with bold/italic formatting and a clickable link
- Clicking the link opens qBittorrent Settings stacked on top, with the Storage tab pre-selected
- The "Overwrite existing categories" toggle and its `(i)` popover work
- Adding/removing category path mapping rows works the same as the save path mapping rows
- Running an import restores categories (with remapped paths) and tags as expected on the target server

- [ ] **Step 13: Commit**

```bash
git add packages/app/src/app/components/modals/import-torrents/import-torrents.ts packages/app/src/app/components/modals/import-torrents/import-torrents.html packages/app/src/app/components/modals/import-torrents/import-torrents.spec.ts public/i18n/us.json public/i18n/hu.json
git commit -m "#127: add category path mapping and overwrite UI to import modal"
```

---

## Self-Review Notes

**Spec coverage:**

- Part 1 (export changes) → Task 1, Task 2
- Part 2 (qB Settings Storage tab) → Task 5
- Part 3 (IPC contract changes) → Task 1, Task 3, Task 4
- Part 4 (import pipeline / Step 0) → Task 4
- Part 5 (import component UI: archive rows, split toggles, category path mapping fieldset, modal-stacking link) → Task 3 (toggle split), Task 6 (initialTab), Task 7 (everything else)
- "Out of scope" items (tag/category renaming, TMM prefs elsewhere, export modal changes) are correctly not addressed by any task

**Type consistency:** `restoreCategoriesAndTags(serverId, metadata, restoreCategories, restoreTags, categoryPathMappings, overwriteCategories)` signature is identical between its definition (Task 4, Step 4) and its call site in `runImport` (Task 4, Step 6) and every test invocation (Task 4, Step 2). `addMapping`/`removeMapping` take `(array: FormArray, ...)` consistently from their redefinition (Task 7, Step 3) through both fieldsets' templates (Task 7, Steps 10-11) and tests (Task 7, Step 1).
