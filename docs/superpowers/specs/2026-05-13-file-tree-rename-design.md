# File Tree Rename Fix — Design Spec

**Date:** 2026-05-13
**Branch:** 80-file-tree-component-refactor
**Issue:** Multi-session rename bug in `add-torrent` modal; cancel has no unsaved-changes guard.

---

## Problem

### Bug: multi-session rename chain breaks in `add-torrent`

`bb-file-tree` tracks renames via `renameQueue` — an array of incremental `{oldPath, newPath}` pairs accumulated during a single edit session. On `saveEdit()` the queue is emitted and cleared.

`add-torrent.ts` stores the latest save event in `savedFileState`, replacing it on each save:

```typescript
public onTreeSaved(event: FileTreeSaveEvent): void {
  this.savedFileState = event;  // overwrites previous session's renames
}
```

When the user edits and saves twice before submitting:

- Session 1: renames `original → xxx`; `savedFileState = {renames: [{old: original, new: xxx}]}`
- Session 2: `node.fullPath` is still `xxx` from session 1. Rename produces `{old: xxx, new: yyy}`. `savedFileState` is overwritten: `{renames: [{old: xxx, new: yyy}]}`
- Submit: tries to rename `xxx → yyy` in qBittorrent, but qBittorrent has `original` → **error**

### Why `content.ts` is unaffected

In `content.ts`, saves are applied immediately to qBittorrent. After each save, the polling loop refreshes `content()`, which flows into `[files]` and triggers `ngOnChanges`. The tree rebuilds with fresh server-side paths as the new genesis. Every edit session starts from the current qBittorrent state, so the wrong-oldPath problem never occurs.

---

## Root Cause

`renameQueue` expresses renames as incremental operations relative to the state at the _start of the current session_. In `add-torrent`, where `[files]` never changes, this means session 2's `oldPath` references session 1's end-state rather than the original torrent path that qBittorrent actually has.

---

## Solution

### Key insight

`node.file` is a reference to the original `TorrentFileEntry` from `@Input() files`. Its `.path` property is **never mutated** by any rename logic — only `node.name` and `node.fullPath` change. Meanwhile, `flatten()` reconstructs full paths by walking `node.name` from root to leaf.

Therefore:

- `node.file.path` = **genesis path** (what qBittorrent has, or had at last session start in `content.ts`)
- `flatten()` path = **current path** (what the user has set in the tree)

Comparing them in `saveEdit()` always yields the complete effective rename set, regardless of how many edit sessions have occurred.

### Why this works in both contexts

**`add-torrent`:** `[files]` never changes. `node.file.path` always holds the original torrent path. Two edit sessions → session 2's save still emits `{old: original, new: yyy}`. `savedFileState` can simply be replaced, no accumulation needed.

**`content.ts`:** After each save, polling refreshes `[files]` → `ngOnChanges` rebuilds the tree → new `node.file.path` values reflect the post-rename qBittorrent state → next session's genesis is correct.

---

## Changes

### 1. `FileTreeSaveEvent` — remove `type` from renames

All renames are expressed as file renames. The `type: 'file' | 'folder'` distinction is dropped.

```typescript
export type FileTreeSaveEvent = {
  files: TorrentFileEntry[];
  renames: { oldPath: string; newPath: string }[];
};
```

### 2. `bb-file-tree.ts`

**Remove `renameQueue`** and all usages in `enterEditMode`, `cancelEdit`, `saveEdit`, `onFileNameChange`, `onFolderNameChange`.

**Keep `deriveRenamePayload` and `updateChildPaths`** — these maintain correct `node.fullPath` values within a session so nested folder renames chain properly when computing the final `flatten()` output.

**Add `collectRenames()` private helper:**

```typescript
private collectRenames(
  nodes: BbFileTreeNode[],
  parentPath: string,
): { oldPath: string; newPath: string }[] {
  const result: { oldPath: string; newPath: string }[] = [];
  for (const node of nodes) {
    const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
    if (node.kind === 'file' && node.file) {
      const genesisPath = normalizePath(node.file.path);
      if (genesisPath !== currentPath) {
        result.push({ oldPath: genesisPath, newPath: currentPath });
      }
    }
    if (node.children) result.push(...this.collectRenames(node.children, currentPath));
  }
  return result;
}
```

**Update `saveEdit()`:**

```typescript
public saveEdit(): void {
  const files = this.flatten(this.data, '');
  const renames = this.collectRenames(this.data, '');
  this.saved.emit({ files, renames });
  this.originalFiles = [];
  this.editMode.set(false);
  this.editModeChange.emit(false);
}
```

**Add `sessionDirty` flag** — `false` on `enterEditMode()`, `true` on any change (`onFileNameChange`, `onFolderNameChange`, `toggleFileSelection`, `toggleFolderSelection`, `setFolderPriority`).

**Update `cancelEdit()` — add confirm guard:**

Inject `ConfirmService`. Before canceling, if `sessionDirty`, show a confirm dialog. If the user declines, return without canceling.

Add translation keys under `components.bb-file-tree.confirm.cancel`:

- `title`: `"Discard changes"`
- `message`: `"You have unsaved changes. Are you sure you want to discard them?"`

### 3. `add-torrent.ts`

**`onTreeSaved`:** no change — replacing `savedFileState` is correct now that `bb-file-tree` always emits genesis→current renames.

**`tryRenameContentAfterAdd`:** remove the folder rename branch. Only call `renameTorrentFile`:

```typescript
for (const item of this.savedFileState?.renames ?? []) {
  await this.qbService.renameTorrentFile(serverId, hash, item.oldPath, item.newPath);
}
```

### 4. `content.ts`

**`onSaved`:** remove the folder rename branch. Only call `renameTorrentFile`:

```typescript
for (const item of event.renames) {
  await this.qbService.renameTorrentFile(serverId, this.hash, item.oldPath, item.newPath);
}
```

---

## Files to change

| File                                                                        | Change                                                                                                    |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `packages/app/src/app/components/bb-file-tree/bb-file-tree.ts`              | Remove `renameQueue`; add `collectRenames`; update `saveEdit`; add `sessionDirty` + cancel confirm        |
| `packages/app/src/app/components/bb-file-tree/bb-file-tree.html`            | Wire cancel confirm (no template changes needed — `cancelEdit` is already async-capable via button click) |
| `packages/app/src/app/components/add-torrent/add-torrent.ts`                | Remove folder rename branch in `tryRenameContentAfterAdd`                                                 |
| `packages/app/src/app/components/modals/torrent-details/content/content.ts` | Remove folder rename branch in `onSaved`                                                                  |
| `public/i18n/us.json`                                                       | Add cancel confirm translation keys                                                                       |
| `public/i18n/hu.json`                                                       | Add cancel confirm translation keys (Hungarian)                                                           |

---

## What is not changing

- `onTreeSaved` in `add-torrent.ts` — no accumulation logic needed
- `originalFiles` tracking — still needed for priority restore on cancel
- `updateChildPaths` / `deriveRenamePayload` — still needed for correct intra-session path management
- `content.ts` polling / `ngOnChanges` rebuild — this is what makes the genesis reset work correctly in that context; no changes needed
- The faRotateLeft button already in the template — left as-is (wired up to nothing for now; can be addressed in a future issue)
