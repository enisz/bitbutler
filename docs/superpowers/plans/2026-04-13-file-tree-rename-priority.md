# File Tree Rename & Priority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire rename events and priority changes through `bb-file-tree` into both `content.ts` (edit/save/cancel flow with live API calls) and `add-torrent.ts` (queued post-add application).

**Architecture:** `BbFileTree` gains two new granular outputs (`fileRenamed`, `folderRenamed`) that emit `{ oldPath, newPath }` pairs with chaining-correct paths. `content.ts` stages all changes behind Edit/Save/Cancel buttons and flushes them to the qBittorrent API on Save. `add-torrent.ts` queues renames and priority changes and applies them inside `tryRenameContentAfterAdd` after the torrent is confirmed visible.

**Tech Stack:** Angular 20 (zoneless, signals), qBittorrent Web API v2, TypeScript, SCSS, ngx-translate

---

## Files

| File                                                             | Change                                                                            |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/app/models/torrent-draft.model.ts`                          | Add `index?: number` to `TorrentFileEntry`                                        |
| `src/app/services/qb.service.ts`                                 | Add `setFilePriority()` method                                                    |
| `src/app/components/bb-file-tree/bb-file-tree.ts`                | Add rename outputs + handlers, `updateChildPaths` helper                          |
| `src/app/components/bb-file-tree/bb-file-tree.html`              | Wire `(change)` on name inputs to new handlers                                    |
| `src/app/components/modals/torrent-details/content/content.ts`   | Edit/save/cancel state, rename queue, save logic, preserve `index` in load        |
| `src/app/components/modals/torrent-details/content/content.html` | Edit/Save/Cancel buttons, wire new outputs                                        |
| `src/app/components/add-torrent/add-torrent.ts`                  | `customizedFiles`, `renameQueue`, new handlers, extend `tryRenameContentAfterAdd` |
| `src/app/components/add-torrent/add-torrent.html`                | Wire new outputs on `<app-bb-file-tree>`                                          |
| `public/i18n/us.json`                                            | Add button and error i18n keys for `content` tab                                  |
| `public/i18n/hu.json`                                            | Same keys in Hungarian                                                            |

---

## Task 1: Add `index` to `TorrentFileEntry` and `setFilePriority` to `QbService`

**Files:**

- Modify: `src/app/models/torrent-draft.model.ts`
- Modify: `src/app/services/qb.service.ts`

- [ ] **Step 1: Add `index` to the model**

In `src/app/models/torrent-draft.model.ts`, change:

```typescript
export type TorrentFileEntry = {
  path: string;
  length: number;
  priority?: number;
  progress?: number;
};
```

To:

```typescript
export type TorrentFileEntry = {
  path: string;
  length: number;
  priority?: number;
  progress?: number;
  index?: number; // qBittorrent file index; present when loaded from the API
};
```

- [ ] **Step 2: Add `setFilePriority` to `qb.service.ts`**

In `src/app/services/qb.service.ts`, add after the `renameTorrentFolder` method (after line 449):

```typescript
async setFilePriority(
  serverId: string,
  hash: string,
  ids: number[],
  priority: number,
): Promise<void> {
  const h = (hash ?? '').trim();
  const clean = (ids ?? []).filter((id) => typeof id === 'number');
  if (!h) return Promise.reject(new Error('hash is required'));
  if (clean.length === 0) return Promise.reject(new Error('ids are required'));

  const res = await this.request<void>(serverId, {
    path: '/api/v2/torrents/filePrio',
    method: 'POST',
    form: { hash: h, id: clean.join('|'), priority: String(priority) },
  });

  if (res.ok) return res.body;
  throw new HttpError(res.status, res.statusText, `Failed to set file priority`);
}
```

- [ ] **Step 3: Lint check**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/models/torrent-draft.model.ts src/app/services/qb.service.ts
git commit -m "#22: add index to TorrentFileEntry and setFilePriority to QbService"
```

---

## Task 2: Add rename outputs and handlers to `BbFileTree`

**Files:**

- Modify: `src/app/components/bb-file-tree/bb-file-tree.ts`
- Modify: `src/app/components/bb-file-tree/bb-file-tree.html`

- [ ] **Step 1: Add the two new outputs**

In `src/app/components/bb-file-tree/bb-file-tree.ts`, change line 41:

```typescript
@Output() filesChanged = new EventEmitter<TorrentFileEntry[]>();
```

To:

```typescript
@Output() filesChanged = new EventEmitter<TorrentFileEntry[]>();
@Output() fileRenamed = new EventEmitter<{ oldPath: string; newPath: string }>();
@Output() folderRenamed = new EventEmitter<{ oldPath: string; newPath: string }>();
```

- [ ] **Step 2: Add `onFileNameChange`, `onFolderNameChange`, and `updateChildPaths`**

In `src/app/components/bb-file-tree/bb-file-tree.ts`, add these three methods after `toggleFileSelection` (after line 120):

```typescript
onFileNameChange(node: BbFileTreeNode): void {
  const oldPath = node.fullPath;
  const slashIdx = oldPath.lastIndexOf('/');
  const parentPath = slashIdx >= 0 ? oldPath.slice(0, slashIdx) : '';
  const newPath = parentPath ? `${parentPath}/${node.name}` : node.name;
  this.fileRenamed.emit({ oldPath, newPath });
  node.fullPath = newPath;
  this.emitChanges();
}

onFolderNameChange(node: BbFileTreeNode): void {
  const oldPath = node.fullPath;
  const slashIdx = oldPath.lastIndexOf('/');
  const parentPath = slashIdx >= 0 ? oldPath.slice(0, slashIdx) : '';
  const newPath = parentPath ? `${parentPath}/${node.name}` : node.name;
  this.folderRenamed.emit({ oldPath, newPath });
  node.fullPath = newPath;
  this.updateChildPaths(node.children ?? [], oldPath, newPath);
  this.emitChanges();
}

private updateChildPaths(
  nodes: BbFileTreeNode[],
  oldPrefix: string,
  newPrefix: string,
): void {
  for (const child of nodes) {
    child.fullPath = newPrefix + child.fullPath.slice(oldPrefix.length);
    if (child.children) this.updateChildPaths(child.children, oldPrefix, newPrefix);
  }
}
```

- [ ] **Step 3: Wire the new handlers in the template**

In `src/app/components/bb-file-tree/bb-file-tree.html`:

Change the folder name input (line 50):

```html
(change)="emitChanges()"
```

To:

```html
(change)="onFolderNameChange(node)"
```

Change the file name input (line 96):

```html
(change)="emitChanges()"
```

To:

```html
(change)="onFileNameChange(node)"
```

- [ ] **Step 4: Lint check**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/bb-file-tree/bb-file-tree.ts src/app/components/bb-file-tree/bb-file-tree.html
git commit -m "#22: add fileRenamed and folderRenamed outputs to BbFileTree"
```

---

## Task 3: Add i18n keys for the content tab buttons

**Files:**

- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

- [ ] **Step 1: Add keys to `us.json`**

In `public/i18n/us.json`, find the `content` section under `torrent-details` (around line 198) and change:

```json
"content": {
  "loading": "Loading Torrent Contents...",
  "error": {
    "failed-to-load": "Failed to load torrent contents!"
  }
},
```

To:

```json
"content": {
  "loading": "Loading Torrent Contents...",
  "button": {
    "edit": "Edit",
    "save": "Save",
    "cancel": "Cancel"
  },
  "error": {
    "failed-to-load": "Failed to load torrent contents!",
    "failed-to-save": "Failed to save changes!"
  }
},
```

- [ ] **Step 2: Add keys to `hu.json`**

In `public/i18n/hu.json`, find the same `content` section (around line 198) and apply the same structure:

```json
"content": {
  "loading": "Torrent tartalmának a betöltése...",
  "button": {
    "edit": "Szerkesztés",
    "save": "Mentés",
    "cancel": "Mégse"
  },
  "error": {
    "failed-to-load": "Nem sikerült a torrent tartalmát betölteni!",
    "failed-to-save": "Nem sikerült a változtatásokat menteni!"
  }
},
```

- [ ] **Step 3: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "#22: add i18n keys for content tab edit/save/cancel buttons"
```

---

## Task 4: Update `content.ts` — edit/save/cancel + API calls

**Files:**

- Modify: `src/app/components/modals/torrent-details/content/content.ts`

- [ ] **Step 1: Add new state fields**

In `src/app/components/modals/torrent-details/content/content.ts`, after the existing `public loading = signal<boolean>(true);` line, add:

```typescript
public isSaving = signal<boolean>(false);
public originalContent: TorrentFileEntry[] = [];
public renameQueue: { type: 'file' | 'folder'; oldPath: string; newPath: string }[] = [];
```

- [ ] **Step 2: Add `enterEditMode`, `cancelEdit`, `saveEdit`, event handlers**

Replace the existing `public filesChanged(files: TorrentFileEntry[]): void` method with the full set of handlers:

```typescript
public enterEditMode(): void {
  this.originalContent = structuredClone(this.content);
  this.renameQueue = [];
  this.editMode.set(true);
}

public cancelEdit(): void {
  this.content = this.originalContent;
  this.renameQueue = [];
  this.editMode.set(false);
}

public async saveEdit(): Promise<void> {
  const serverId = this.serverStoreService.currentServerId();
  if (!serverId) return;

  this.isSaving.set(true);
  try {
    for (const item of this.renameQueue) {
      if (item.type === 'folder') {
        await this.qbService.renameTorrentFolder(serverId, this.hash, item.oldPath, item.newPath);
      } else {
        await this.qbService.renameTorrentFile(serverId, this.hash, item.oldPath, item.newPath);
      }
    }

    for (const file of this.content) {
      if (file.index === undefined) continue;
      const original = this.originalContent.find((f) => f.index === file.index);
      if (original && original.priority !== file.priority) {
        await this.qbService.setFilePriority(
          serverId,
          this.hash,
          [file.index],
          file.priority ?? 0,
        );
      }
    }

    this.renameQueue = [];
    this.originalContent = [];
    this.editMode.set(false);
  } catch (e) {
    console.error(Content.name, 'saveEdit', 'Failed to save changes', e);
    this.toastService.danger(
      this.translateService.instant(
        'components.modals.torrent-details.content.error.failed-to-save',
      ),
    );
  } finally {
    this.isSaving.set(false);
  }
}

public onFileRenamed(event: { oldPath: string; newPath: string }): void {
  this.renameQueue.push({ type: 'file', ...event });
}

public onFolderRenamed(event: { oldPath: string; newPath: string }): void {
  this.renameQueue.push({ type: 'folder', ...event });
}

public onFilesChanged(files: TorrentFileEntry[]): void {
  this.content = files;
}
```

- [ ] **Step 3: Preserve `index` in `load()` mapping**

In the same file, find the `load()` method's `return` statement and change:

```typescript
return (await this.qbService.torrentContents(serverId, hash)).map((content: QbTorrentContent) => ({
  length: content.size,
  path: content.name,
  priority: content.priority,
  progress: content.progress,
}));
```

To:

```typescript
return (await this.qbService.torrentContents(serverId, hash)).map((content: QbTorrentContent) => ({
  length: content.size,
  path: content.name,
  priority: content.priority,
  progress: content.progress,
  index: content.index,
}));
```

- [ ] **Step 4: Lint check**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/modals/torrent-details/content/content.ts
git commit -m "#22: add edit/save/cancel flow and API calls to content tab"
```

---

## Task 5: Update `content.html` — buttons and new output bindings

**Files:**

- Modify: `src/app/components/modals/torrent-details/content/content.html`

- [ ] **Step 1: Replace the template**

Replace the entire contents of `src/app/components/modals/torrent-details/content/content.html` with:

```html
@if (loading()) {
<div class="w-100 text-center">
  <app-bb-spinner></app-bb-spinner>
  <small class="d-block mt-2"
    >{{ 'components.modals.torrent-details.content.loading' | translate }}</small
  >
</div>
} @else {
<div class="d-flex justify-content-end gap-2 mb-3">
  @if (!editMode()) {
  <button type="button" class="btn btn-sm btn-secondary" (click)="enterEditMode()">
    {{ 'components.modals.torrent-details.content.button.edit' | translate }}
  </button>
  } @else {
  <button
    type="button"
    class="btn btn-sm btn-secondary"
    [disabled]="isSaving()"
    (click)="cancelEdit()"
  >
    {{ 'components.modals.torrent-details.content.button.cancel' | translate }}
  </button>
  <button type="button" class="btn btn-sm btn-primary" [disabled]="isSaving()" (click)="saveEdit()">
    {{ 'components.modals.torrent-details.content.button.save' | translate }}
  </button>
  }
</div>

<app-bb-file-tree
  [files]="content"
  [expandAll]="false"
  [showMeta]="true"
  [mode]="editMode() ? 'edit' : 'view'"
  (filesChanged)="onFilesChanged($event)"
  (fileRenamed)="onFileRenamed($event)"
  (folderRenamed)="onFolderRenamed($event)"
>
</app-bb-file-tree>
}
```

- [ ] **Step 2: Lint check**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/modals/torrent-details/content/content.html
git commit -m "#22: add edit/save/cancel buttons and wire rename outputs in content tab"
```

---

## Task 6: Update `add-torrent.ts` — queue renames and apply post-add

**Files:**

- Modify: `src/app/components/add-torrent/add-torrent.ts`

- [ ] **Step 1: Add `customizedFiles` signal and `renameQueue` field**

In `src/app/components/add-torrent/add-torrent.ts`, after the `public showTree = signal(false);` line, add:

```typescript
public customizedFiles = signal<TorrentFileEntry[] | null>(null);
private renameQueue: { type: 'file' | 'folder'; oldPath: string; newPath: string }[] = [];
```

- [ ] **Step 2: Add the three new event handlers**

Add these methods after `handleCancel`:

```typescript
public onFilesChanged(files: TorrentFileEntry[]): void {
  this.customizedFiles.set(files);
}

public onFileRenamed(event: { oldPath: string; newPath: string }): void {
  this.renameQueue.push({ type: 'file', ...event });
}

public onFolderRenamed(event: { oldPath: string; newPath: string }): void {
  this.renameQueue.push({ type: 'folder', ...event });
}
```

- [ ] **Step 3: Reset new state in `loadDraft()`**

In `loadDraft()`, after the `this.manualDraft.set(null);` line, add:

```typescript
this.customizedFiles.set(null);
this.renameQueue = [];
```

- [ ] **Step 4: Extend `tryRenameContentAfterAdd` to apply queued renames and priorities**

Inside `tryRenameContentAfterAdd`, in the `try` block, after the existing `await this.qbService.renameTorrentFolder(...)` / `renameTorrentFile(...)` calls (the root rename logic that ends around the `return;` after single-file rename), add the following at the end of the `try` block (before the `catch`):

```typescript
// Apply individual file/folder renames queued from the tree
for (const item of this.renameQueue) {
  if (item.type === 'folder') {
    await this.qbService.renameTorrentFolder(serverId, hash, item.oldPath, item.newPath);
  } else {
    await this.qbService.renameTorrentFile(serverId, hash, item.oldPath, item.newPath);
  }
}

// Apply priority = 0 for files the user unchecked
const customized = this.customizedFiles();
if (customized) {
  const skipped = customized
    .map((f, i) => ({ index: i, priority: f.priority ?? 1 }))
    .filter((f) => f.priority === 0);
  for (const f of skipped) {
    await this.qbService.setFilePriority(serverId, hash, [f.index], 0);
  }
}
```

Note: the `tryRenameContentAfterAdd` method has multiple early `return` statements inside it (for single-file and folder rename paths). Move the new queued-rename and priority blocks to **after** both of those paths by restructuring as follows — replace the entire `try` block body in `tryRenameContentAfterAdd` with:

```typescript
try {
  const contents = await pollForTorrent();

  if (!contents || contents.length === 0) return;

  const isSingleFile = contents.length === 1 && !this.hasFolderPrefix(contents[0]?.name ?? '');

  if (isSingleFile) {
    const oldName = (contents[0]?.name ?? '').trim();
    if (oldName) {
      const newName = this.buildSingleFileName(oldName, desiredRaw);
      if (newName && newName !== oldName) {
        await this.qbService.renameTorrentFile(serverId, hash, oldName, newName);
      }
    }
  } else {
    const firstPath = (contents[0]?.name ?? '').trim();
    const root = this.getRootFolder(firstPath);
    if (root) {
      const newRoot = this.sanitizeFolderName(desiredRaw);
      if (newRoot && newRoot !== root) {
        await this.qbService.renameTorrentFolder(serverId, hash, root, newRoot);
      }
    }
  }

  // Apply individual file/folder renames queued from the tree
  for (const item of this.renameQueue) {
    if (item.type === 'folder') {
      await this.qbService.renameTorrentFolder(serverId, hash, item.oldPath, item.newPath);
    } else {
      await this.qbService.renameTorrentFile(serverId, hash, item.oldPath, item.newPath);
    }
  }

  // Apply priority = 0 for files the user unchecked (matched by array position)
  const customized = this.customizedFiles();
  if (customized) {
    const skipped = customized
      .map((f, i) => ({ index: i, priority: f.priority ?? 1 }))
      .filter((f) => f.priority === 0);
    for (const f of skipped) {
      await this.qbService.setFilePriority(serverId, hash, [f.index], 0);
    }
  }
} catch (error) {
  console.error(
    AddTorrent.name,
    'tryRenameContentAfterAdd',
    `Failed to rename torrent content for hash ${hash}:`,
    error,
  );
}
```

- [ ] **Step 5: Add `TorrentFileEntry` to the import in `add-torrent.ts`**

The file already imports `TorrentDraft` from `'../../models/torrent-draft.model'`. Verify `TorrentFileEntry` is also imported — if not, add it:

```typescript
import { TorrentDraft, TorrentFileEntry } from '../../models/torrent-draft.model';
```

- [ ] **Step 6: Lint check**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/components/add-torrent/add-torrent.ts
git commit -m "#22: wire file tree events into add-torrent post-add flow"
```

---

## Task 7: Wire new outputs in `add-torrent.html`

**Files:**

- Modify: `src/app/components/add-torrent/add-torrent.html`

- [ ] **Step 1: Update the `<app-bb-file-tree>` element**

In `src/app/components/add-torrent/add-torrent.html`, find (around line 320):

```html
<app-bb-file-tree
  [files]="effectiveDraft()!.torrent!.files"
  [expandAll]="true"
  [showMeta]="true"
  mode="edit"
>
</app-bb-file-tree>
```

Replace with:

```html
<app-bb-file-tree
  [files]="effectiveDraft()!.torrent!.files"
  [expandAll]="true"
  [showMeta]="true"
  mode="edit"
  (filesChanged)="onFilesChanged($event)"
  (fileRenamed)="onFileRenamed($event)"
  (folderRenamed)="onFolderRenamed($event)"
>
</app-bb-file-tree>
```

- [ ] **Step 2: Lint check**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/add-torrent/add-torrent.html
git commit -m "#22: wire fileRenamed and folderRenamed outputs in add-torrent template"
```

---

## Task 8: Final smoke test

- [ ] **Step 1: Start the app**

```bash
npm start
```

- [ ] **Step 2: Test `add-torrent` flow**

1. Open the add-torrent modal with a multi-file torrent
2. Uncheck one file — verify the file turns faded/skipped in the tree
3. Rename a folder — verify the name updates in the tree
4. Rename a file inside the folder — verify the name updates
5. Submit — the torrent should add, then apply priority and renames post-add (check qBittorrent UI)

- [ ] **Step 3: Test `content` tab flow**

1. Open torrent details for an existing torrent, go to the Content tab
2. Verify the **Edit** button is visible and tree is in view mode
3. Click **Edit** — verify inputs appear, Edit button is replaced by Save/Cancel
4. Rename a folder, rename a file, uncheck a file
5. Click **Cancel** — verify all changes are reverted to original state
6. Click **Edit** again, make changes, click **Save** — verify API calls succeed and edit mode exits
7. If a save fails (e.g., disconnect), verify the danger toast appears and edit mode stays open
