# File Tree Rename & Priority Design

**Date:** 2026-04-13  
**Issue:** #22  
**Scope:** `bb-file-tree` component, `content.ts` (torrent details), `add-torrent.ts`, `qb.service.ts`, `TorrentFileEntry` model

---

## Problem

The `bb-file-tree` component operates in two parent contexts:

- **`add-torrent`** — user configures files before the torrent is added; changes are applied via API after adding
- **`content.ts`** — user edits an already-added torrent; changes must be staged and committed via an edit/save/cancel flow

The existing `filesChanged` output emits a full `TorrentFileEntry[]` snapshot but cannot communicate _what specifically changed_. Rename events need both `oldPath` and `newPath` — the `filesChanged` snapshot alone cannot provide `oldPath` once a rename has occurred. Additionally the `index` field from the qBittorrent API is currently dropped during mapping, making it impossible to match files for priority changes.

---

## Fix: `flatten()` output path bug

`flatten()` currently uses `node.fullPath` (assigned once at build time) as the emitted `path`, so renamed nodes always emit the original stale path. The fix (already applied) threads a `parentPath` parameter through `flatten()` and reconstructs each file's path from the current `node.name` values:

```typescript
private flatten(nodes: BbFileTreeNode[], parentPath: string): TorrentFileEntry[] {
  for (const node of nodes) {
    const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
    if (node.kind === 'file' && node.file) result.push({ ...node.file, path: currentPath });
    if (node.children) result = result.concat(this.flatten(node.children, currentPath));
  }
}
```

---

## Component interface changes — `BbFileTree`

### New outputs

```typescript
@Output() fileRenamed   = new EventEmitter<{ oldPath: string; newPath: string }>();
@Output() folderRenamed = new EventEmitter<{ oldPath: string; newPath: string }>();
```

### Rename handlers

Replace `(change)="emitChanges()"` on the name inputs with dedicated handlers:

- **folder input** → `(change)="onFolderNameChange(node)"`
- **file input** → `(change)="onFileNameChange(node)"`

**`onFileNameChange(node)`:**

1. `oldPath = node.fullPath`
2. Derive `parentPath` from `oldPath` (everything before the last `/`, or `''` if no slash)
3. `newPath = parentPath ? parentPath + '/' + node.name : node.name`
4. Emit `fileRenamed: { oldPath, newPath }`
5. `node.fullPath = newPath`
6. Call `emitChanges()`

**`onFolderNameChange(node)`:**

1. `oldPath = node.fullPath`
2. Derive `parentPath` same as above
3. `newPath = parentPath ? parentPath + '/' + node.name : node.name`
4. Emit `folderRenamed: { oldPath, newPath }`
5. Update `node.fullPath = newPath`
6. Recursively update all descendants: replace `oldPath + '/'` prefix with `newPath + '/'` in each child's `fullPath`
7. Call `emitChanges()`

Rename events chain correctly: a folder rename updates all descendant `fullPath` values immediately, so a subsequent file rename inside that folder emits the already-updated path as `oldPath`.

---

## Model change — `TorrentFileEntry`

Add an optional `index` field:

```typescript
export type TorrentFileEntry = {
  path: string;
  length: number;
  priority?: number;
  progress?: number;
  index?: number; // qBittorrent file index; present when loaded from API
};
```

---

## Service addition — `qb.service.ts`

Add `setFilePriority` using the existing `renameTorrentFile` method as a template:

```typescript
async setFilePriority(
  serverId: string,
  hash: string,
  ids: number[],
  priority: number,
): Promise<void>
// POST /api/v2/torrents/filePrio
// form: { hash, id: ids.join('|'), priority }
```

---

## `content.ts` — edit / save / cancel

### State additions

```typescript
originalContent: TorrentFileEntry[] = [];
renameQueue: { type: 'file' | 'folder'; oldPath: string; newPath: string }[] = [];
```

### Button behaviour

| Button     | Action                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| **Edit**   | `editMode.set(true)`, snapshot `originalContent = structuredClone(this.content)`, clear `renameQueue` |
| **Cancel** | `this.content = this.originalContent`, clear `renameQueue`, `editMode.set(false)`                     |
| **Save**   | Execute queue, apply priority diffs, `editMode.set(false)`, clear state                               |

### `load()` mapping

Preserve `index` from `QbTorrentContent`:

```typescript
({
  path: content.name,
  length: content.size,
  priority: content.priority,
  progress: content.progress,
  index: content.index,
});
```

### Template bindings

```html
(fileRenamed)="onFileRenamed($event)" (folderRenamed)="onFolderRenamed($event)"
(filesChanged)="onFilesChanged($event)"
```

`onFileRenamed` / `onFolderRenamed` push to `renameQueue`.  
`onFilesChanged` stores the updated array in `this.content` (keeps the live tree state while editing).

### Save logic

```
for each item in renameQueue:
  if type === 'folder' → qbService.renameTorrentFolder(serverId, hash, oldPath, newPath)
  if type === 'file'   → qbService.renameTorrentFile(serverId, hash, oldPath, newPath)

priority changes:
  for each file in this.content (has index):
    original = originalContent.find(f => f.index === file.index)
    if original.priority !== file.priority:
      qbService.setFilePriority(serverId, hash, [file.index], file.priority)
```

Errors during save are shown as a danger toast; the edit mode stays open so the user can retry or cancel.

---

## `add-torrent.ts` — post-add application

### State additions

```typescript
customizedFiles = signal<TorrentFileEntry[] | null>(null);
renameQueue: {
  type: 'file' | 'folder';
  oldPath: string;
  newPath: string;
}
[] = [];
```

Both are reset in `loadDraft()` when the draft changes.

### Template bindings

```html
(filesChanged)="onFilesChanged($event)" (fileRenamed)="onFileRenamed($event)"
(folderRenamed)="onFolderRenamed($event)"
```

`onFilesChanged` → `customizedFiles.set(files)`  
`onFileRenamed` / `onFolderRenamed` → push to `renameQueue`

### Extended `tryRenameContentAfterAdd`

After polling and confirming the torrent exists, in order:

1. **Root rename** (existing behaviour) — rename root folder/file to match the "rename" form field, if it differs from the detected root
2. **Queued renames** — execute `renameQueue` entries in insertion order (same API calls as `content.ts`)
3. **Priority changes** — for each file in `customizedFiles()` where `priority === 0`, call `setFilePriority` using array position as the file index (torrent file ordering matches qBittorrent's `index` assignment)

---

## Out of scope

- Conflict resolution if the form-field root rename and a queued folder rename target the same folder — both will fire in sequence; the second may fail gracefully (qBittorrent returns an error which is logged but does not block the add flow)
- Re-polling after save in `content.ts` — the component already loads once; a full reload is left to the user closing and reopening the modal
