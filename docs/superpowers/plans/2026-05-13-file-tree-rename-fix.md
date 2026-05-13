# File Tree Rename Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix multi-session rename corruption in the `bb-file-tree` component so that renames emitted in `FileTreeSaveEvent` are always relative to the genesis file paths, making the component work correctly in both `add-torrent` and `content.ts` contexts.

**Architecture:** Remove the incremental `renameQueue` and instead compute the complete effective rename set in `saveEdit()` by comparing each leaf node's `node.file.path` (genesis, never mutated) against the path reconstructed by `flatten()` (current, from `node.name`). Add a `sessionDirty` flag to guard `cancelEdit()` with a confirm dialog.

**Tech Stack:** Angular 20 (zoneless, signal-based), `@ng-bootstrap/ng-bootstrap` modal/confirm, `@ngx-translate/core`, Vitest via `ng test`.

---

## File Map

| File                                                                             | Change                                                                                                                              |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `packages/app/src/app/components/bb-file-tree/bb-file-tree.ts`                   | Remove `renameQueue`; add `collectRenames`; update `saveEdit`; add `sessionDirty`; inject `ConfirmService`; make `cancelEdit` async |
| `packages/app/src/app/components/bb-file-tree/bb-file-tree.spec.ts`              | Add tests for multi-session rename, `sessionDirty`, and cancel confirm guard; update existing `cancelEdit` tests to `await`         |
| `packages/app/src/app/components/add-torrent/add-torrent.ts`                     | Remove folder rename branch in `tryRenameContentAfterAdd`                                                                           |
| `packages/app/src/app/components/modals/torrent-details/content/content.ts`      | Remove folder rename branch in `onSaved`                                                                                            |
| `packages/app/src/app/components/modals/torrent-details/content/content.spec.ts` | Remove mock for `renameTorrentFolder`                                                                                               |
| `public/i18n/us.json`                                                            | Add `components.bb-file-tree.confirm.cancel.{title,message}`                                                                        |
| `public/i18n/hu.json`                                                            | Add `components.bb-file-tree.confirm.cancel.{title,message}`                                                                        |

---

## Task 1: Update `FileTreeSaveEvent` — remove `type` from renames

**Files:**

- Modify: `packages/app/src/app/components/bb-file-tree/bb-file-tree.ts:33-36`
- Modify: `packages/app/src/app/components/add-torrent/add-torrent.ts:463-470`
- Modify: `packages/app/src/app/components/modals/torrent-details/content/content.ts:88-96`

- [ ] **Step 1: Update the `FileTreeSaveEvent` type**

In `bb-file-tree.ts`, replace lines 33–36:

```typescript
export type FileTreeSaveEvent = {
  files: TorrentFileEntry[];
  renames: { oldPath: string; newPath: string }[];
};
```

- [ ] **Step 2: Fix `add-torrent.ts` — remove folder rename branch**

In `tryRenameContentAfterAdd`, replace the entire `for` loop over renames (currently lines 465–470):

```typescript
for (const item of this.savedFileState?.renames ?? []) {
  await this.qbService.renameTorrentFile(serverId, hash, item.oldPath, item.newPath);
}
```

- [ ] **Step 3: Fix `content.ts` — remove folder rename branch**

In `onSaved`, replace the entire `for` loop over renames (currently lines 88–96):

```typescript
for (const item of event.renames) {
  await this.qbService.renameTorrentFile(serverId, this.hash, item.oldPath, item.newPath);
}
```

- [ ] **Step 4: Fix `content.spec.ts` — remove `renameTorrentFolder` from mock**

In `content.spec.ts`, remove `renameTorrentFolder: vi.fn()` from the `QbService` mock. The mock becomes:

```typescript
{
  provide: QbService,
  useValue: {
    torrentContents: vi.fn().mockResolvedValue([]),
    renameTorrentFile: vi.fn(),
    setFilePriority: vi.fn(),
  },
},
```

- [ ] **Step 5: Run tests — expect pass**

```bash
cd /home/enisz/dev/bitbutler/packages/app && npx ng test --watch=false
```

Expected: `Test Files  105 passed`, `Tests  1005 passed` (or close — existing tests don't assert on `type` in rename events).

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/components/bb-file-tree/bb-file-tree.ts \
        packages/app/src/app/components/add-torrent/add-torrent.ts \
        packages/app/src/app/components/modals/torrent-details/content/content.ts \
        packages/app/src/app/components/modals/torrent-details/content/content.spec.ts
git commit -m "$(cat <<'EOF'
#80: remove type distinction from FileTreeSaveEvent renames

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Write failing tests for multi-session rename fix

**Files:**

- Modify: `packages/app/src/app/components/bb-file-tree/bb-file-tree.spec.ts`

- [ ] **Step 1: Add a new `describe` block for `saveEdit renames` with four failing tests**

Add the following block after the existing `enterEditMode / cancelEdit / saveEdit` describe block in `bb-file-tree.spec.ts`:

```typescript
describe('saveEdit renames', () => {
  beforeEach(() => {
    component.files = [makeFile('dir/a.txt'), makeFile('dir/b.txt')];
    component.ngOnChanges();
  });

  it('should emit empty renames when no files were renamed', () => {
    component.enterEditMode();
    const spy = vi.fn();
    component.saved.subscribe(spy);
    component.saveEdit();
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ renames: [] }));
  });

  it('should emit genesis-to-current rename when a file is renamed', () => {
    component.enterEditMode();
    const fileNode = component.data[0].children![0]; // dir/a.txt
    fileNode.name = 'z.txt';
    component.onFileNameChange(fileNode);

    const spy = vi.fn();
    component.saved.subscribe(spy);
    component.saveEdit();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        renames: [{ oldPath: 'dir/a.txt', newPath: 'dir/z.txt' }],
      }),
    );
  });

  it('should emit correct rename after two edit sessions (multi-session bug)', () => {
    component.files = [makeFile('a.txt')];
    component.ngOnChanges();

    // Session 1: a.txt → xxx.txt
    component.enterEditMode();
    const node = component.data[0];
    node.name = 'xxx.txt';
    component.onFileNameChange(node);
    component.saveEdit();

    // Session 2: xxx.txt → yyy.txt
    component.enterEditMode();
    node.name = 'yyy.txt';
    component.onFileNameChange(node);

    const spy = vi.fn();
    component.saved.subscribe(spy);
    component.saveEdit();

    // Must emit genesis (a.txt) → current (yyy.txt), not stale (xxx.txt) → current
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        renames: [{ oldPath: 'a.txt', newPath: 'yyy.txt' }],
      }),
    );
  });

  it('should emit one rename per file when a folder is renamed', () => {
    component.enterEditMode();
    const folderNode = component.data[0]; // dir
    folderNode.name = 'newdir';
    component.onFolderNameChange(folderNode);

    const spy = vi.fn();
    component.saved.subscribe(spy);
    component.saveEdit();

    const event = spy.mock.calls[0][0] as FileTreeSaveEvent;
    expect(event.renames).toHaveLength(2);
    expect(event.renames).toEqual(
      expect.arrayContaining([
        { oldPath: 'dir/a.txt', newPath: 'newdir/a.txt' },
        { oldPath: 'dir/b.txt', newPath: 'newdir/b.txt' },
      ]),
    );
  });
});
```

Also add `FileTreeSaveEvent` to the import at the top of the spec file:

```typescript
import { BbFileTree, BbFileTreeNode, FileTreeSaveEvent } from './bb-file-tree';
```

- [ ] **Step 2: Run tests — expect the four new tests to fail**

```bash
cd /home/enisz/dev/bitbutler/packages/app && npx ng test --watch=false
```

Expected: the four new `saveEdit renames` tests fail. The multi-session test fails because `renameQueue` still emits `xxx.txt → yyy.txt` instead of `a.txt → yyy.txt`. The folder test fails because `renameQueue` emits a folder rename, not per-file entries.

---

## Task 3: Implement `collectRenames`, update `saveEdit`, remove `renameQueue`

**Files:**

- Modify: `packages/app/src/app/components/bb-file-tree/bb-file-tree.ts`

- [ ] **Step 1: Remove the `renameQueue` field**

Delete this line (currently around line 72):

```typescript
private renameQueue: { type: 'file' | 'folder'; oldPath: string; newPath: string }[] = [];
```

- [ ] **Step 2: Add `collectRenames` private method**

Add this method after `flatten` (currently around line 322):

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

- [ ] **Step 3: Update `saveEdit` to use `collectRenames`**

Replace the existing `saveEdit` method body:

```typescript
public saveEdit(): void {
  const files = this.flatten(this.data, '');
  const renames = this.collectRenames(this.data, '');
  this.saved.emit({ files, renames });
  this.originalFiles = [];
  this.folderPriorityMemory.clear();
  this.editMode.set(false);
  this.editModeChange.emit(false);
}
```

- [ ] **Step 4: Remove queue pushes from `onFileNameChange` and `onFolderNameChange`**

Replace `onFileNameChange`:

```typescript
onFileNameChange(node: BbFileTreeNode): void {
  const { oldPath, newPath } = this.deriveRenamePayload(node);
  if (oldPath === newPath) return;
  node.fullPath = newPath;
}
```

Replace `onFolderNameChange`:

```typescript
onFolderNameChange(node: BbFileTreeNode): void {
  const { oldPath, newPath } = this.deriveRenamePayload(node);
  if (oldPath === newPath) return;
  node.fullPath = newPath;
  this.updateChildPaths(node.children ?? [], oldPath, newPath);
}
```

- [ ] **Step 5: Remove `renameQueue` references from `enterEditMode` and `cancelEdit`**

In `enterEditMode`, remove:

```typescript
this.renameQueue = [];
```

In `cancelEdit`, remove:

```typescript
this.renameQueue = [];
```

- [ ] **Step 6: Run tests — expect all tests to pass**

```bash
cd /home/enisz/dev/bitbutler/packages/app && npx ng test --watch=false
```

Expected: `105 passed`, `1009 passed` (1005 original + 4 new).

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/components/bb-file-tree/bb-file-tree.ts \
        packages/app/src/app/components/bb-file-tree/bb-file-tree.spec.ts
git commit -m "$(cat <<'EOF'
#80: fix multi-session rename by computing renames from genesis paths

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add `sessionDirty` flag and write tests for it

**Files:**

- Modify: `packages/app/src/app/components/bb-file-tree/bb-file-tree.ts`
- Modify: `packages/app/src/app/components/bb-file-tree/bb-file-tree.spec.ts`

- [ ] **Step 1: Write failing tests for `sessionDirty`**

Add the following `describe` block to `bb-file-tree.spec.ts`, after the `saveEdit renames` block:

```typescript
describe('sessionDirty', () => {
  beforeEach(() => {
    component.files = [makeFile('dir/a.txt'), makeFile('dir/b.txt')];
    component.ngOnChanges();
    component.enterEditMode();
  });

  it('should be false after enterEditMode', () => {
    expect((component as any).sessionDirty).toBe(false);
  });

  it('should be true after onFileNameChange', () => {
    const fileNode = component.data[0].children![0];
    fileNode.name = 'z.txt';
    component.onFileNameChange(fileNode);
    expect((component as any).sessionDirty).toBe(true);
  });

  it('should be true after onFolderNameChange', () => {
    const folderNode = component.data[0];
    folderNode.name = 'other';
    component.onFolderNameChange(folderNode);
    expect((component as any).sessionDirty).toBe(true);
  });

  it('should be true after toggleFileSelection', () => {
    const fileNode = component.data[0].children![0];
    const event = { target: { checked: false } } as unknown as Event;
    component.toggleFileSelection(fileNode.file!, event);
    expect((component as any).sessionDirty).toBe(true);
  });

  it('should be true after toggleFolderSelection', () => {
    const folderNode = component.data[0];
    const event = { target: { checked: false } } as unknown as Event;
    component.toggleFolderSelection(folderNode, event);
    expect((component as any).sessionDirty).toBe(true);
  });

  it('should be true after setFolderPriority', () => {
    component.setFolderPriority(component.data[0], 6);
    expect((component as any).sessionDirty).toBe(true);
  });

  it('should reset to false on the next enterEditMode', () => {
    const fileNode = component.data[0].children![0];
    fileNode.name = 'z.txt';
    component.onFileNameChange(fileNode);
    expect((component as any).sessionDirty).toBe(true);

    component.saveEdit();
    component.enterEditMode();
    expect((component as any).sessionDirty).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect the new block to fail**

```bash
cd /home/enisz/dev/bitbutler/packages/app && npx ng test --watch=false
```

Expected: new `sessionDirty` tests fail (`sessionDirty` is not defined on the component).

- [ ] **Step 3: Add `sessionDirty` field and wire it up**

In `bb-file-tree.ts`, add the field next to `autoEditTriggered`:

```typescript
private sessionDirty = false;
```

In `enterEditMode()`, reset it:

```typescript
public enterEditMode(): void {
  this.sessionDirty = false;
  this.originalFiles = structuredClone(this.files);
  this.folderPriorityMemory.clear();
  this.editMode.set(true);
  this.editModeChange.emit(true);
}
```

Add `this.sessionDirty = true;` as the last line of each change handler:

```typescript
onFileNameChange(node: BbFileTreeNode): void {
  const { oldPath, newPath } = this.deriveRenamePayload(node);
  if (oldPath === newPath) return;
  node.fullPath = newPath;
  this.sessionDirty = true;
}

onFolderNameChange(node: BbFileTreeNode): void {
  const { oldPath, newPath } = this.deriveRenamePayload(node);
  if (oldPath === newPath) return;
  node.fullPath = newPath;
  this.updateChildPaths(node.children ?? [], oldPath, newPath);
  this.sessionDirty = true;
}

toggleFolderSelection(node: BbFileTreeNode, event: Event): void {
  const checked = (event.target as HTMLInputElement).checked;
  if (checked) {
    const restored = this.folderPriorityMemory.get(node.fullPath) ?? 1;
    this.updateRecursive(node, (f) => (f.priority = restored));
  } else {
    this.folderPriorityMemory.set(node.fullPath, this.getDominantFolderPriority(node));
    this.updateRecursive(node, (f) => (f.priority = 0));
  }
  this.sessionDirty = true;
  this.calculateStats();
}

setFolderPriority(node: BbFileTreeNode, priority: number): void {
  this.updateRecursive(node, (f) => {
    if (f.priority !== 0) f.priority = priority;
  });
  this.sessionDirty = true;
  this.calculateStats();
}

toggleFileSelection(f: TorrentFileEntry, event: Event): void {
  const checked = (event.target as HTMLInputElement).checked;
  f.priority = checked ? 1 : 0;
  this.sessionDirty = true;
  this.calculateStats();
}
```

- [ ] **Step 4: Run tests — expect all to pass**

```bash
cd /home/enisz/dev/bitbutler/packages/app && npx ng test --watch=false
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/bb-file-tree/bb-file-tree.ts \
        packages/app/src/app/components/bb-file-tree/bb-file-tree.spec.ts
git commit -m "$(cat <<'EOF'
#80: track sessionDirty flag across edit-mode change handlers

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add i18n keys for the cancel confirm dialog

**Files:**

- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

- [ ] **Step 1: Add English keys to `us.json`**

In `public/i18n/us.json`, inside `components.bb-file-tree`, add a `confirm` key after `priority-option`:

```json
"confirm": {
  "cancel": {
    "title": "Discard changes",
    "message": "You have unsaved changes. Are you sure you want to discard them?"
  }
}
```

The `bb-file-tree` object should look like:

```json
"bb-file-tree": {
  "stats": {
    "folders": "folders",
    "of": "of",
    "files": "files"
  },
  "priority-option": {
    "skipped": "Skipped",
    "normal": "Normal",
    "high": "High",
    "max": "Max"
  },
  "confirm": {
    "cancel": {
      "title": "Discard changes",
      "message": "You have unsaved changes. Are you sure you want to discard them?"
    }
  }
}
```

- [ ] **Step 2: Add Hungarian keys to `hu.json`**

In `public/i18n/hu.json`, add the same structure:

```json
"confirm": {
  "cancel": {
    "title": "Változtatások elvetése",
    "message": "Nem mentett változtatásaid vannak. Biztosan elveted őket?"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "$(cat <<'EOF'
#80: add i18n keys for file-tree cancel confirm dialog

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add cancel confirm guard to `cancelEdit()`

**Files:**

- Modify: `packages/app/src/app/components/bb-file-tree/bb-file-tree.ts`
- Modify: `packages/app/src/app/components/bb-file-tree/bb-file-tree.spec.ts`

- [ ] **Step 1: Write failing tests for the cancel confirm guard**

First add `ConfirmService` to the import at the very top of `bb-file-tree.spec.ts` (with the other imports):

```typescript
import { ConfirmService } from '../../services/confirm.service';
```

Then update the `TestBed` setup to add a `ConfirmService` mock. Declare the mock variable at the top of `describe('BbFileTree')` and wire it into `providers`:

```typescript
// At the top of describe('BbFileTree'):
let mockConfirmService: { confirm: ReturnType<typeof vi.fn> };

beforeEach(async () => {
  mockConfirmService = { confirm: vi.fn().mockResolvedValue(true) };

  await TestBed.configureTestingModule({
    imports: [BbFileTree],
    providers: [{ provide: ConfirmService, useValue: mockConfirmService }],
  }).compileComponents();

  fixture = TestBed.createComponent(BbFileTree);
  component = fixture.componentInstance;
  component.files = [];
  fixture.detectChanges();
});
```

Then update the two existing `cancelEdit` tests that need to be awaited (they will start failing because `cancelEdit` is not yet async):

```typescript
it('should set editMode to false on cancelEdit', async () => {
  component.enterEditMode();
  await component.cancelEdit();
  expect(component.editMode()).toBe(false);
});

it('should emit editModeChange(false) on cancelEdit', async () => {
  component.enterEditMode();
  const spy = vi.fn();
  component.editModeChange.subscribe(spy);
  await component.cancelEdit();
  expect(spy).toHaveBeenCalledWith(false);
});
```

Then add a new describe block for the confirm guard:

```typescript
describe('cancelEdit confirm guard', () => {
  beforeEach(() => {
    component.files = [makeFile('a.txt')];
    component.ngOnChanges();
    component.enterEditMode();
  });

  it('should skip confirm and cancel immediately when session is not dirty', async () => {
    await component.cancelEdit();
    expect(mockConfirmService.confirm).not.toHaveBeenCalled();
    expect(component.editMode()).toBe(false);
  });

  it('should show confirm when session is dirty', async () => {
    const node = component.data[0];
    node.name = 'z.txt';
    component.onFileNameChange(node);

    mockConfirmService.confirm.mockResolvedValue(true);
    await component.cancelEdit();

    expect(mockConfirmService.confirm).toHaveBeenCalledWith(
      'components.bb-file-tree.confirm.cancel.title',
      'components.bb-file-tree.confirm.cancel.message',
    );
    expect(component.editMode()).toBe(false);
  });

  it('should not cancel when user declines the confirm', async () => {
    const node = component.data[0];
    node.name = 'z.txt';
    component.onFileNameChange(node);

    mockConfirmService.confirm.mockResolvedValue(false);
    await component.cancelEdit();

    expect(component.editMode()).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — expect new tests to fail**

```bash
cd /home/enisz/dev/bitbutler/packages/app && npx ng test --watch=false
```

Expected: the two updated `cancelEdit` tests and the three new `cancelEdit confirm guard` tests fail because `cancelEdit` is still synchronous and `ConfirmService` is not injected.

- [ ] **Step 3: Inject `ConfirmService` and make `cancelEdit` async**

In `bb-file-tree.ts`, add `ConfirmService` to imports and inject it:

```typescript
import { ConfirmService } from '../../services/confirm.service';
```

Add to the class fields (alongside other `inject` calls):

```typescript
private readonly confirmService = inject(ConfirmService);
```

Replace `cancelEdit` with the async version:

```typescript
public async cancelEdit(): Promise<void> {
  if (this.sessionDirty) {
    const confirmed = await this.confirmService.confirm(
      'components.bb-file-tree.confirm.cancel.title',
      'components.bb-file-tree.confirm.cancel.message',
    );
    if (!confirmed) return;
  }
  for (let i = 0; i < this.originalFiles.length && i < this.files.length; i++) {
    this.files[i].priority = this.originalFiles[i].priority;
  }
  const expandedPaths = new Set<string>();
  this.treeControl.expansionModel.selected.forEach((n) => expandedPaths.add(n.fullPath));
  const result = buildTree(this.files);
  this.data = result.nodes;
  this.totalFiles.set(this.files.length);
  this.calculateStats();
  if (this.expandAll) this.expandAllNodes();
  else this.restoreExpansionState(this.data, expandedPaths);
  this.originalFiles = [];
  this.folderPriorityMemory.clear();
  this.sessionDirty = false;
  this.editMode.set(false);
  this.editModeChange.emit(false);
}
```

- [ ] **Step 4: Run tests — expect all to pass**

```bash
cd /home/enisz/dev/bitbutler/packages/app && npx ng test --watch=false
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/bb-file-tree/bb-file-tree.ts \
        packages/app/src/app/components/bb-file-tree/bb-file-tree.spec.ts
git commit -m "$(cat <<'EOF'
#80: add confirm guard to cancelEdit when session has unsaved changes

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Run lint and verify everything is clean

- [ ] **Step 1: Run lint**

```bash
cd /home/enisz/dev/bitbutler && npm run lint
```

Expected: no warnings or errors. If there are any, fix them (likely unused import or `item.type` reference remaining somewhere).

- [ ] **Step 2: Run the full test suite one final time**

```bash
cd /home/enisz/dev/bitbutler/packages/app && npx ng test --watch=false
```

Expected: all tests pass.

- [ ] **Step 3: Run electron tests**

```bash
cd /home/enisz/dev/bitbutler && npm test
```

Expected: all 166 electron tests pass.
