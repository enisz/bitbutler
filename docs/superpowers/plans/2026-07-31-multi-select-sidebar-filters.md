# Multi-select Sidebar Filter Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each sidebar filter group (Status, Trackers, Categories, Tags, Save Paths) hold multiple simultaneously-selected items instead of behaving like a radio group.

**Architecture:** `FilterGroupComponent` (presentational) switches its selection input from a single `activeKey: string` to `activeKeys: ReadonlySet<string>`, highlighting every row whose key is in the set and the "All" row whenever the set is empty. `Status` (the sidebar container) owns the actual toggle semantics against `FilterService`'s existing `Set<string>`-based filter state: for Trackers/Categories/Tags/Save Paths, toggling is a direct add/remove against the matching `Set`; for the Status group (which maps meta-keys like "Downloading" to arrays of overlapping `TorrentState`s), a meta-key counts as active when every one of its states is present in the current `states` Set, and toggling adds/removes that whole array. `FilterService.filtered`'s per-group `Set.has(...)` checks already implement OR-within-group / AND-across-group semantics and require no changes.

**Tech Stack:** Angular 20 (zoneless, signals), Vitest, TypeScript strict templates.

## Global Constraints

- No configuration input to disable multi-select per group - it applies uniformly to all five groups.
- No new component-local selection signal for the Status group - `activeStatusKeys` is derived purely from `FilterService.external.states` (confirmed during brainstorming: filter state is in-memory only, never persisted, and `Status`/`FilterGroupComponent` are not destroyed/recreated during normal use).
- Keep the existing highlighted-row (`.active`) visual style - no checkboxes or other new UI affordance.
- `packages/app/tsconfig.json` has `strictTemplates: true` - every task must leave the app compiling (no dangling template bindings to removed/renamed `@Input()`s). Each task below is scoped so the whole app type-checks and all existing tests pass at the end of that task.
- Use `-` not `—` in all commit messages / prose.
- Commit format: `#249: short description`.

---

## Task 1: `FilterGroupComponent` multi-select API + Status read-side wiring

Refactors the selection representation from a single active key to a `Set` of active keys, and rewires `Status` to feed each group's current selection as a `Set`. Click/toggle _behavior_ is unchanged in this task (each `setXGroup` method still fully replaces the underlying `Set`, so at the end of this task the app still behaves exactly like today, single-select) - this task is a pure, verifiable refactor of the read/highlighting path.

**Files:**

- Modify: `packages/app/src/app/pages/main/status/filter-group/filter-group.ts`
- Modify: `packages/app/src/app/pages/main/status/filter-group/filter-group.html`
- Test: `packages/app/src/app/pages/main/status/filter-group/filter-group.spec.ts`
- Modify: `packages/app/src/app/pages/main/status/status.ts`
- Modify: `packages/app/src/app/pages/main/status/status.html`
- Test: `packages/app/src/app/pages/main/status/status.spec.ts`

**Interfaces:**

- Produces: `FilterGroupComponent.activeKeys: input.required<ReadonlySet<string>>()` (replaces `activeKey: input.required<string>()`).
- Produces: `Status.activeStatusKeys`, `Status.activeTrackerKeys`, `Status.activeSavePathKeys`, `Status.activeCategoryKeys`, `Status.activeTagKeys` - all `computed<ReadonlySet<string>>`. These replace `activeKey`, `activeTrackerKey`, `activeSavePathKey`, `activeCategoryKey`, `activeTagKey`.
- Consumes (by Task 2 and Task 3): `Status.filtersSig` (existing, `this.filterService.external`) and `Status.groups` (existing `Record<StatusKey, TorrentState[]>` map) - unchanged, just noting the setters Task 2/3 rewrite will read from the same `filtersSig()` these new computeds read from.

- [ ] **Step 1: Write the failing `FilterGroupComponent` tests**

Edit `packages/app/src/app/pages/main/status/filter-group/filter-group.spec.ts`:

Replace the `beforeEach` input setup:

```ts
fixture = TestBed.createComponent(FilterGroupComponent);
component = fixture.componentInstance;
fixture.componentRef.setInput('label', 'Status');
fixture.componentRef.setInput('activeKeys', new Set<string>());
fixture.componentRef.setInput('showAllCount', 10);
fixture.componentRef.setInput('items', sampleItems);
fixture.detectChanges();
```

Replace the whole `describe('auto-emit on item removal', ...)` block with:

```ts
describe('auto-prune stale active keys', () => {
  it('should emit the stale key when an active item is removed from items list', () => {
    const emitted: string[] = [];
    component.itemSelected.subscribe((key) => emitted.push(key));

    fixture.componentRef.setInput('activeKeys', new Set(['downloading']));
    fixture.componentRef.setInput('items', [{ key: 'seeding', label: 'Seeding', count: 7 }]);
    fixture.detectChanges();

    expect(emitted).toEqual(['downloading']);
  });

  it('should preserve a sibling active key that is still present', () => {
    const emitted: string[] = [];
    component.itemSelected.subscribe((key) => emitted.push(key));

    fixture.componentRef.setInput('activeKeys', new Set(['downloading', 'seeding']));
    fixture.componentRef.setInput('items', [{ key: 'seeding', label: 'Seeding', count: 7 }]);
    fixture.detectChanges();

    expect(emitted).toEqual(['downloading']);
  });

  it('should not emit when all active items are still in the updated list', () => {
    const emitted: string[] = [];
    component.itemSelected.subscribe((key) => emitted.push(key));

    fixture.componentRef.setInput('activeKeys', new Set(['downloading']));
    fixture.componentRef.setInput('items', [...sampleItems]);
    fixture.detectChanges();

    expect(emitted).toHaveLength(0);
  });

  it('should not emit when activeKeys is empty', () => {
    const emitted: string[] = [];
    component.itemSelected.subscribe((key) => emitted.push(key));

    fixture.componentRef.setInput('activeKeys', new Set());
    fixture.componentRef.setInput('items', []);
    fixture.detectChanges();

    expect(emitted).toHaveLength(0);
  });
});

describe('active row highlighting', () => {
  it('should mark the "All" row active when activeKeys is empty', () => {
    fixture.componentRef.setInput('activeKeys', new Set());
    fixture.detectChanges();
    const items: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.list-group-item'),
    );
    const allItem = items.find((el) => el.textContent?.includes('All'));
    expect(allItem?.classList.contains('active')).toBe(true);
  });

  it('should mark the "All" row active again once the only active key is toggled off', () => {
    fixture.componentRef.setInput('activeKeys', new Set(['downloading']));
    fixture.detectChanges();
    fixture.componentRef.setInput('activeKeys', new Set());
    fixture.detectChanges();
    const items: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.list-group-item'),
    );
    const allItem = items.find((el) => el.textContent?.includes('All'));
    expect(allItem?.classList.contains('active')).toBe(true);
  });

  it('should mark multiple item rows active simultaneously, and "All" inactive', () => {
    fixture.componentRef.setInput('activeKeys', new Set(['downloading', 'seeding']));
    fixture.detectChanges();
    const items: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.list-group-item'),
    );
    const downloadingItem = items.find((el) => el.textContent?.includes('Downloading'));
    const seedingItem = items.find((el) => el.textContent?.includes('Seeding'));
    const allItem = items.find((el) => el.textContent?.includes('All'));
    expect(downloadingItem?.classList.contains('active')).toBe(true);
    expect(seedingItem?.classList.contains('active')).toBe(true);
    expect(allItem?.classList.contains('active')).toBe(false);
  });
});
```

Every other describe block (`items input`, `clearFilter`, `onItemSelected`, `isIconArray`, `item badge variant`, `item variant coloring`, `filteredItems`, `showFilter input`, `action input`) is untouched - none of them set the `activeKey`/`activeKeys` input directly.

- [ ] **Step 2: Run the `FilterGroupComponent` tests to verify they fail**

Run: `npm test --workspace=packages/app -- filter-group.spec.ts`
Expected: FAIL - `setInput('activeKeys', ...)` on an input that doesn't exist yet / template still reads `activeKey()`.

- [ ] **Step 3: Implement the `FilterGroupComponent` change**

In `packages/app/src/app/pages/main/status/filter-group/filter-group.ts`, replace:

```ts
  readonly activeKey = input.required<string>();
```

with:

```ts
  readonly activeKeys = input.required<ReadonlySet<string>>();
```

Replace the constructor's `effect()`:

```ts
  constructor() {
    effect(() => {
      const next = this.items() ?? [];
      const key = this.activeKey();
      if (key && key !== 'all' && !next.some((i) => i.key === key)) {
        this.itemSelected.emit('all');
      }
    });
  }
```

with:

```ts
  constructor() {
    effect(() => {
      const next = this.items() ?? [];
      const validKeys = new Set(next.map((i) => i.key));
      for (const key of this.activeKeys()) {
        if (!validKeys.has(key)) {
          this.itemSelected.emit(key);
        }
      }
    });
  }
```

In `packages/app/src/app/pages/main/status/filter-group/filter-group.html`, replace:

```html
[class.active]="activeKey() === 'all'"
```

with:

```html
[class.active]="activeKeys().size === 0"
```

and replace:

```html
[class.active]="activeKey() === item.key"
```

with:

```html
[class.active]="activeKeys().has(item.key)"
```

- [ ] **Step 4: Run the `FilterGroupComponent` tests to verify they pass**

Run: `npm test --workspace=packages/app -- filter-group.spec.ts`
Expected: PASS

- [ ] **Step 5: Write the failing `Status` tests for the renamed computed signals**

Edit `packages/app/src/app/pages/main/status/status.spec.ts`. Replace the whole `describe('activeKey', ...)` block with:

```ts
describe('activeStatusKeys', () => {
  it('should return an empty set when no states filter is active', () => {
    filterMock.external.set({ ...GRID_FILTER_INITIAL.external, states: new Set() });
    expect(component.activeStatusKeys()).toEqual(new Set());
  });

  it('should include "stopped" when the stopped states are fully active', () => {
    filterMock.external.set({
      ...GRID_FILTER_INITIAL.external,
      states: new Set(['pausedDL', 'pausedUP', 'stoppedDL', 'stoppedUP']),
    });
    expect(component.activeStatusKeys()).toEqual(new Set(['stopped']));
  });

  it('should include both keys when the union of two groups is active', () => {
    filterMock.external.set({
      ...GRID_FILTER_INITIAL.external,
      states: new Set([
        'downloading',
        'forcedDL',
        'queuedDL',
        'metaDL',
        'stalledDL',
        'pausedDL',
        'pausedUP',
        'stoppedDL',
        'stoppedUP',
      ]),
    });
    expect(component.activeStatusKeys()).toEqual(new Set(['downloading', 'stopped']));
  });

  it('should return an empty set for an unrecognised/partial combination of states', () => {
    filterMock.external.set({
      ...GRID_FILTER_INITIAL.external,
      states: new Set(['downloading', 'uploading']),
    });
    expect(component.activeStatusKeys()).toEqual(new Set());
  });
});
```

- [ ] **Step 6: Run the `Status` tests to verify they fail**

Run: `npm test --workspace=packages/app -- status.spec.ts`
Expected: FAIL - `component.activeStatusKeys` is not a function.

- [ ] **Step 7: Implement the `Status` computed signal changes**

In `packages/app/src/app/pages/main/status/status.ts`, replace the `activeKey` computed (the block starting `readonly activeKey = computed<StatusKey>(...)` and its helper `equals`) with:

```ts
  readonly activeStatusKeys = computed<ReadonlySet<string>>(() => {
    const current = this.filtersSig().states;
    const keys = new Set<string>();
    for (const key of Object.keys(this.groups) as StatusKey[]) {
      const g = this.groups[key];
      if (g.length > 0 && g.every((s) => current.has(s))) keys.add(key);
    }
    return keys;
  });
```

Replace:

```ts
  readonly activeTrackerKey = computed(() => {
    const set = this.filtersSig().trackers;
    return set?.size === 0 ? 'all' : [...set][0];
  });

  readonly activeSavePathKey = computed(() => {
    const set = this.filtersSig().savePaths;
    return set?.size === 0 ? 'all' : [...set][0];
  });
```

with:

```ts
  readonly activeTrackerKeys = computed<ReadonlySet<string>>(() => this.filtersSig().trackers);

  readonly activeSavePathKeys = computed<ReadonlySet<string>>(() => this.filtersSig().savePaths);
```

Replace:

```ts
  readonly activeCategoryKey = computed(() => {
    const set = this.filtersSig().categories;
    return set?.size === 0 ? 'all' : [...set][0];
  });

  readonly activeTagKey = computed(() => {
    const set = this.filtersSig().tags;
    return set?.size === 0 ? 'all' : [...set][0];
  });
```

with:

```ts
  readonly activeCategoryKeys = computed<ReadonlySet<string>>(() => this.filtersSig().categories);

  readonly activeTagKeys = computed<ReadonlySet<string>>(() => this.filtersSig().tags);
```

In `packages/app/src/app/pages/main/status/status.html`, update each `app-filter-group`'s binding:

```html
[activeKey]="activeKey()"
```

→

```html
[activeKeys]="activeStatusKeys()"
```

```html
[activeKey]="activeTrackerKey()"
```

→

```html
[activeKeys]="activeTrackerKeys()"
```

```html
[activeKey]="activeCategoryKey()"
```

→

```html
[activeKeys]="activeCategoryKeys()"
```

```html
[activeKey]="activeTagKey()"
```

→

```html
[activeKeys]="activeTagKeys()"
```

```html
[activeKey]="activeSavePathKey()"
```

→

```html
[activeKeys]="activeSavePathKeys()"
```

- [ ] **Step 8: Run the `Status` tests to verify they pass**

Run: `npm test --workspace=packages/app -- status.spec.ts`
Expected: PASS (the `setGroup`/`setTrackerGroup`/`setSavePathGroup`/`setCategoryGroup`/`setTagGroup`/`clearAll`/`categoriesAction`/`tagsAction`/`statusItems variant` describe blocks are untouched and still pass, since click/toggle behavior hasn't changed yet).

- [ ] **Step 9: Type-check the whole app**

Run: `npm run build --workspace=packages/app`
Expected: succeeds with no template type errors (confirms no leftover `[activeKey]` bindings or `activeKey()` references anywhere).

- [ ] **Step 10: Commit**

```bash
git add packages/app/src/app/pages/main/status/filter-group/filter-group.ts \
        packages/app/src/app/pages/main/status/filter-group/filter-group.html \
        packages/app/src/app/pages/main/status/filter-group/filter-group.spec.ts \
        packages/app/src/app/pages/main/status/status.ts \
        packages/app/src/app/pages/main/status/status.html \
        packages/app/src/app/pages/main/status/status.spec.ts
git commit -m "#249: switch filter-group selection to a Set of active keys"
```

---

## Task 2: Toggle logic for Trackers, Save Paths, Categories, Tags

Makes clicking an item in these four groups add/remove it from the current selection instead of replacing the whole group, using a shared `toggleKey` helper.

**Files:**

- Modify: `packages/app/src/app/pages/main/status/status.ts`
- Test: `packages/app/src/app/pages/main/status/status.spec.ts`

**Interfaces:**

- Consumes: `Status.filtersSig` (existing), `FilterService.setTrackers/setSavePaths/setCategories/setTags` (existing, unchanged signatures - `Iterable<string>`).
- Produces: `Status.toggleKey(current: ReadonlySet<string>, key: string): Set<string>` (private) - used by Task 2's four methods; not used by Task 3 (Status/states toggling has its own inline logic since it operates on `TorrentState` arrays, not single keys).

- [ ] **Step 1: Write the failing toggle tests**

Edit `packages/app/src/app/pages/main/status/status.spec.ts`. Replace the `describe('setTrackerGroup', ...)` block with:

```ts
describe('setTrackerGroup', () => {
  it('should call clearTrackers when key is "all"', () => {
    component.setTrackerGroup('all');
    expect(filterMock.clearTrackers).toHaveBeenCalled();
  });

  it('should add the key to the current set when not yet selected', () => {
    filterMock.external.set({
      ...GRID_FILTER_INITIAL.external,
      trackers: new Set(['tracker.a.com']),
    });
    component.setTrackerGroup('tracker.b.com');
    expect(filterMock.setTrackers).toHaveBeenCalledWith(
      new Set(['tracker.a.com', 'tracker.b.com']),
    );
  });

  it('should remove the key from the current set when already selected', () => {
    filterMock.external.set({
      ...GRID_FILTER_INITIAL.external,
      trackers: new Set(['tracker.a.com', 'tracker.b.com']),
    });
    component.setTrackerGroup('tracker.a.com');
    expect(filterMock.setTrackers).toHaveBeenCalledWith(new Set(['tracker.b.com']));
  });
});
```

Replace the `describe('setSavePathGroup', ...)` block with:

```ts
describe('setSavePathGroup', () => {
  it('should call clearSavePaths when key is "all"', () => {
    component.setSavePathGroup('all');
    expect(filterMock.clearSavePaths).toHaveBeenCalled();
  });

  it('should add the key to the current set when not yet selected', () => {
    filterMock.external.set({
      ...GRID_FILTER_INITIAL.external,
      savePaths: new Set(['/downloads']),
    });
    component.setSavePathGroup('/media');
    expect(filterMock.setSavePaths).toHaveBeenCalledWith(new Set(['/downloads', '/media']));
  });

  it('should remove the key from the current set when already selected', () => {
    filterMock.external.set({
      ...GRID_FILTER_INITIAL.external,
      savePaths: new Set(['/downloads', '/media']),
    });
    component.setSavePathGroup('/downloads');
    expect(filterMock.setSavePaths).toHaveBeenCalledWith(new Set(['/media']));
  });
});
```

Replace the `describe('setCategoryGroup', ...)` block with:

```ts
describe('setCategoryGroup', () => {
  it('should call clearCategories when key is "all"', () => {
    component.setCategoryGroup('all');
    expect(filterMock.clearCategories).toHaveBeenCalled();
  });

  it('should add the key to the current set when not yet selected', () => {
    filterMock.external.set({
      ...GRID_FILTER_INITIAL.external,
      categories: new Set(['Movies']),
    });
    component.setCategoryGroup('TV');
    expect(filterMock.setCategories).toHaveBeenCalledWith(new Set(['Movies', 'TV']));
  });

  it('should remove the key from the current set when already selected', () => {
    filterMock.external.set({
      ...GRID_FILTER_INITIAL.external,
      categories: new Set(['Movies', 'TV']),
    });
    component.setCategoryGroup('Movies');
    expect(filterMock.setCategories).toHaveBeenCalledWith(new Set(['TV']));
  });
});
```

Replace the `describe('setTagGroup', ...)` block with:

```ts
describe('setTagGroup', () => {
  it('should call clearTags when key is "all"', () => {
    component.setTagGroup('all');
    expect(filterMock.clearTags).toHaveBeenCalled();
  });

  it('should add the key to the current set when not yet selected', () => {
    filterMock.external.set({ ...GRID_FILTER_INITIAL.external, tags: new Set(['hd']) });
    component.setTagGroup('4k');
    expect(filterMock.setTags).toHaveBeenCalledWith(new Set(['hd', '4k']));
  });

  it('should remove the key from the current set when already selected', () => {
    filterMock.external.set({
      ...GRID_FILTER_INITIAL.external,
      tags: new Set(['hd', '4k']),
    });
    component.setTagGroup('hd');
    expect(filterMock.setTags).toHaveBeenCalledWith(new Set(['4k']));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=packages/app -- status.spec.ts`
Expected: FAIL - the "add"/"remove" assertions fail because the current implementation still calls `setTrackers([key])` etc. (full replace, ignoring the current set).

- [ ] **Step 3: Implement the toggle helper and rewrite the four group setters**

In `packages/app/src/app/pages/main/status/status.ts`, add a private helper directly below the `filtersSig`/`languageChanged` field declarations (near the top of the class body):

```ts
  private toggleKey(current: ReadonlySet<string>, key: string): Set<string> {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  }
```

Replace:

```ts
  public clearTrackers(): void {
    this.filterService.clearTrackers();
  }

  public setTracker(key: string): void {
    this.filterService.setTrackers([key]);
  }

  public setTrackerGroup(key: string): void {
    if (key === 'all') {
      this.clearTrackers();
      return;
    }
    this.setTracker(key);
  }

  public clearSavePaths(): void {
    this.filterService.clearSavePaths();
  }

  public setSavePath(key: string): void {
    this.filterService.setSavePaths([key]);
  }

  public setSavePathGroup(key: string): void {
    if (key === 'all') {
      this.clearSavePaths();
      return;
    }
    this.setSavePath(key);
  }
```

with:

```ts
  public clearTrackers(): void {
    this.filterService.clearTrackers();
  }

  public setTrackerGroup(key: string): void {
    if (key === 'all') {
      this.clearTrackers();
      return;
    }
    this.filterService.setTrackers(this.toggleKey(this.filtersSig().trackers, key));
  }

  public clearSavePaths(): void {
    this.filterService.clearSavePaths();
  }

  public setSavePathGroup(key: string): void {
    if (key === 'all') {
      this.clearSavePaths();
      return;
    }
    this.filterService.setSavePaths(this.toggleKey(this.filtersSig().savePaths, key));
  }
```

Replace:

```ts
  public clearCategories(): void {
    this.filterService.clearCategories();
  }

  public setCategory(key: string): void {
    this.filterService.setCategories([key]);
  }

  public setCategoryGroup(key: string): void {
    if (key === 'all') {
      this.clearCategories();
      return;
    }
    this.setCategory(key);
  }

  public clearTags(): void {
    this.filterService.clearTags();
  }

  public clearAll(): void {
    this.filterService.resetAll();
  }

  public setTag(key: string): void {
    this.filterService.setTags([key]);
  }

  public setTagGroup(key: string): void {
    if (key === 'all') {
      this.clearTags();
      return;
    }
    this.setTag(key);
  }
```

with:

```ts
  public clearCategories(): void {
    this.filterService.clearCategories();
  }

  public setCategoryGroup(key: string): void {
    if (key === 'all') {
      this.clearCategories();
      return;
    }
    this.filterService.setCategories(this.toggleKey(this.filtersSig().categories, key));
  }

  public clearTags(): void {
    this.filterService.clearTags();
  }

  public clearAll(): void {
    this.filterService.resetAll();
  }

  public setTagGroup(key: string): void {
    if (key === 'all') {
      this.clearTags();
      return;
    }
    this.filterService.setTags(this.toggleKey(this.filtersSig().tags, key));
  }
```

(`setTracker`, `setSavePath`, `setCategory`, `setTag` are removed - confirmed via `grep -rn "setTracker(\|setSavePath(\|setCategory(\|setTag(" packages/app/src` that they were only called from within this file, by the methods just rewritten.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --workspace=packages/app -- status.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/pages/main/status/status.ts \
        packages/app/src/app/pages/main/status/status.spec.ts
git commit -m "#249: toggle trackers/save-paths/categories/tags selection instead of replacing it"
```

---

## Task 3: Toggle logic for the Status (states) group

Makes clicking a Status meta-key (Downloading/Completed/Active/Inactive/Stopped/Checking/Errored) add/remove its whole `TorrentState` array from the current selection instead of replacing it, using the same subset-check `activeStatusKeys` already computes.

**Files:**

- Modify: `packages/app/src/app/pages/main/status/status.ts`
- Test: `packages/app/src/app/pages/main/status/status.spec.ts`

**Interfaces:**

- Consumes: `Status.filtersSig`, `Status.groups` (existing `Record<StatusKey, TorrentState[]>`), `FilterService.setStates`/`clearStates` (existing, unchanged).
- Produces: nothing new consumed by later tasks - this is the last behavioral change.

- [ ] **Step 1: Write the failing toggle tests**

Edit `packages/app/src/app/pages/main/status/status.spec.ts`. Replace the `describe('setGroup', ...)` block with:

```ts
describe('setGroup', () => {
  it('should call filterService.clearStates when key is "all"', () => {
    component.setGroup('all');
    expect(filterMock.clearStates).toHaveBeenCalled();
  });

  it('should add the downloading group states when not yet active', () => {
    filterMock.external.set({ ...GRID_FILTER_INITIAL.external, states: new Set() });
    component.setGroup('downloading');
    expect(filterMock.setStates).toHaveBeenCalledWith(
      new Set(['downloading', 'forcedDL', 'queuedDL', 'metaDL', 'stalledDL']),
    );
  });

  it('should preserve a previously selected group when adding a second one', () => {
    filterMock.external.set({
      ...GRID_FILTER_INITIAL.external,
      states: new Set(['pausedDL', 'pausedUP', 'stoppedDL', 'stoppedUP']),
    });
    component.setGroup('downloading');
    expect(filterMock.setStates).toHaveBeenCalledWith(
      new Set([
        'pausedDL',
        'pausedUP',
        'stoppedDL',
        'stoppedUP',
        'downloading',
        'forcedDL',
        'queuedDL',
        'metaDL',
        'stalledDL',
      ]),
    );
  });

  it('should remove the stopped group states when already fully active', () => {
    filterMock.external.set({
      ...GRID_FILTER_INITIAL.external,
      states: new Set(['pausedDL', 'pausedUP', 'stoppedDL', 'stoppedUP']),
    });
    component.setGroup('stopped');
    expect(filterMock.setStates).toHaveBeenCalledWith(new Set());
  });

  it('should not add or remove anything for an unknown key', () => {
    filterMock.external.set({
      ...GRID_FILTER_INITIAL.external,
      states: new Set(['downloading']),
    });
    component.setGroup('nonexistent');
    expect(filterMock.setStates).toHaveBeenCalledWith(new Set(['downloading']));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=packages/app -- status.spec.ts`
Expected: FAIL - the current `setGroup` calls `setStates(states)` with the group's raw array only, ignoring the current selection.

- [ ] **Step 3: Implement the toggle behavior**

In `packages/app/src/app/pages/main/status/status.ts`, replace:

```ts
  public setGroup(key: string): void {
    if (key === 'all') {
      this.filterService.clearStates();
      return;
    }
    const states = this.groups[key as StatusKey] ?? [];
    this.filterService.setStates(states);
  }
```

with:

```ts
  public setGroup(key: string): void {
    if (key === 'all') {
      this.filterService.clearStates();
      return;
    }
    const groupStates = this.groups[key as StatusKey] ?? [];
    const current = this.filtersSig().states;
    const isActive = groupStates.length > 0 && groupStates.every((s) => current.has(s));
    const next = new Set(current);
    for (const s of groupStates) {
      if (isActive) next.delete(s);
      else next.add(s);
    }
    this.filterService.setStates(next);
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --workspace=packages/app -- status.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/pages/main/status/status.ts \
        packages/app/src/app/pages/main/status/status.spec.ts
git commit -m "#249: toggle status selection instead of replacing it"
```

---

## Task 4: Full workspace verification

**Files:** none (verification only).

- [ ] **Step 1: Run lint across the workspace**

Run: `npm run lint`
Expected: 0 warnings/errors (max-warnings=0).

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all workspaces pass.

- [ ] **Step 3: Run the production Angular build**

Run: `npm run build`
Expected: succeeds - confirms `strictTemplates` finds no leftover references to the removed `activeKey`/`setTracker`/`setSavePath`/`setCategory`/`setTag` API anywhere in the app.

- [ ] **Step 4: Grep for any remaining references to the removed API**

Run: `grep -rn "activeKey\b\|setTracker(\|setSavePath(\|setCategory(\|setTag(" packages/app/src --include="*.ts" --include="*.html"`
Expected: no matches inside `status.ts`/`status.html`/`filter-group.ts`/`filter-group.html` (the only acceptable hits are unrelated same-named methods on other services, e.g. `qbService.torrents.setCategory` in `grid-inline-edit.service.ts` and `set-torrent-category.ts`, and `torrent-details-actions.service.ts`'s unrelated `setSavePath()` - verify by inspecting each match, don't just count them).

- [ ] **Step 5: Manual smoke test**

Use the `run` skill to launch the Electron app against a connected qBittorrent server (or the dev server if no live server is configured) and verify in the browser/app window:

- Selecting two items in the same group (e.g. two categories) shows torrents matching either.
- Selecting items across two groups (e.g. a category and a tag) shows only torrents matching both.
- Clicking an already-active item turns it off.
- Toggling off the last active item in a group re-highlights "All".
- "Clear all" resets every group back to "All".

If no live qBittorrent server is available to generate real filter data, state that explicitly rather than claiming the smoke test passed.

---

## Task 5: Documentation update

**Files:**

- Modify: `packages/docs/docs/guide/user-interface/torrent-list-view.md:128`
- Modify: `packages/docs/docs/hu/guide/user-interface/torrent-list-view.md:128`

There is no dedicated screenshot for the filter-groups subsection - the only screenshot in that section is `/screenshots/torrent-list-view/overview.png`, a whole-page screenshot (toolbar + sidebar + grid + status bar) not specific to filter selection state, so no screenshot change is required for this task.

- [ ] **Step 1: Update the English prose**

In `packages/docs/docs/guide/user-interface/torrent-list-view.md`, replace line 128:

```markdown
Trackers, Categories, Tags, and Save Paths each have their own filter box to search long lists. Selecting an entry filters the grid to just that value; only one selection per group is active at a time. Once any filter is active anywhere in the sidebar, a **Clear All** button appears beneath the groups to reset every filter at once.
```

with:

```markdown
Trackers, Categories, Tags, and Save Paths each have their own filter box to search long lists. Selecting an entry adds it to the active filter for that group; you can select multiple entries within a group, and the grid shows torrents matching any of them. Selecting an already-active entry removes it. Once any filter is active anywhere in the sidebar, a **Clear All** button appears beneath the groups to reset every filter at once.
```

- [ ] **Step 2: Update the Hungarian prose**

In `packages/docs/docs/hu/guide/user-interface/torrent-list-view.md`, replace line 128:

```markdown
A Trackerek, Kategóriák, Címkék és Mentési útvonalak mindegyikéhez saját szűrőmező tartozik a hosszú listák kereséséhez. Egy bejegyzés kiválasztása az adott értékre szűri a táblázatot; csoportonként egyszerre csak egy kiválasztás aktív. Amint bármely szűrő aktívvá válik bárhol az oldalsávon, egy **Összes törlése** gomb jelenik meg a csoportok alatt, amely egyszerre visszaállítja az összes szűrőt.
```

with:

```markdown
A Trackerek, Kategóriák, Címkék és Mentési útvonalak mindegyikéhez saját szűrőmező tartozik a hosszú listák kereséséhez. Egy bejegyzés kiválasztása hozzáadja azt az adott csoport aktív szűréséhez; egy csoporton belül több bejegyzés is kiválasztható, és a táblázat bármelyikükre illeszkedő torrenteket megjeleníti. Egy már aktív bejegyzés kiválasztása eltávolítja azt. Amint bármely szűrő aktívvá válik bárhol az oldalsávon, egy **Összes törlése** gomb jelenik meg a csoportok alatt, amely egyszerre visszaállítja az összes szűrőt.
```

- [ ] **Step 3: Commit**

```bash
git add packages/docs/docs/guide/user-interface/torrent-list-view.md \
        packages/docs/docs/hu/guide/user-interface/torrent-list-view.md
git commit -m "#249: document multi-select sidebar filter groups"
```
