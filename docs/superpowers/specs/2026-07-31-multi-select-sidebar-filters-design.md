# Multi-select sidebar filter groups

## Problem

The left sidebar (`Status`) renders five filter groups: Status, Trackers, Categories, Tags, Save Paths. Each group currently behaves like a radio group - selecting an item replaces the group's active selection with that single item. We want each group to support selecting multiple items at once.

## Goals

- Each sidebar filter group (Status, Trackers, Categories, Tags, Save Paths) allows multiple simultaneously-selected items, independent of the others. This applies uniformly across all groups, with no per-group or input-driven opt-out.
- Within a group, selected items combine with OR (a torrent matching any selected item in that group is included).
- Across groups, active groups combine with AND (a torrent must satisfy every group that has an active selection) - this already matches current behavior.
- Clicking an already-active item turns it off (toggle).
- The global "Clear all" button resets every group, same as today.
- Visual style: keep the existing highlighted-row (`.active`) style, applied to every selected row in a group. No new UI affordance (e.g. checkboxes).

## Non-goals

- No change to `FilterService.filtered`'s filtering logic - the underlying `Set`-based matching already applies OR-within-group / AND-across-group semantics correctly for multiple values per group.
- No persistence of filter selection across app restarts (none exists today; out of scope).
- No configuration input to toggle multi-select on/off per group.

## Design

### `FilterGroupComponent` (`packages/app/src/app/pages/main/status/filter-group/filter-group.ts`)

Presentational component - stays purely a function of `items` + the current selection, emitting clicked keys. It does not decide what "already selected" means beyond checking the injected `activeKeys` set.

- Replace `activeKey: input.required<string>()` with `activeKeys: input.required<ReadonlySet<string>>()`.
- Template (`filter-group.html`):
  - "All" row is active when `activeKeys().size === 0`.
  - Each item row is active when `activeKeys().has(item.key)`.
- Constructor `effect()` (auto-prune when an active item disappears from `items()`): currently resets the whole group to `'all'` when the single active key vanishes. Change to iterate the current `activeKeys()`, and for each key no longer present in the (possibly refreshed) `items()` list, emit `itemSelected(key)` for that key only. Since the parent's toggle logic removes an already-active key on receiving its own key, this naturally prunes just the stale keys and leaves the rest of the group's selection intact.
- `onItemSelected(key)` is unchanged - it just emits the clicked key. All toggle/add/remove decisions live in the parent.

### `Status` component (`packages/app/src/app/pages/main/status/status.ts`)

Owns the toggle semantics per group, since it owns the `FilterService` interactions.

**Trackers, Categories, Tags, Save Paths** - these map 1:1 to raw string values already stored as `FilterService` `Set<string>`s, so toggling is a direct membership flip:

```ts
private toggleKey(current: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(current);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

public setTrackerGroup(key: string): void {
  if (key === 'all') {
    this.clearTrackers();
    return;
  }
  this.filterService.setTrackers(this.toggleKey(this.filtersSig().trackers, key));
}
```

Same pattern for `setSavePathGroup`, `setCategoryGroup`, `setTagGroup`. The now-unused single-item setters (`setTracker`, `setSavePath`, `setCategory`, `setTag`) are removed since their only caller becomes the toggle helper above.

`activeTrackerKey`/`activeSavePathKey`/`activeCategoryKey`/`activeTagKey` (each currently `set.size === 0 ? 'all' : [...set][0]`, i.e. only ever reading the first element) become `activeTrackerKeys`/`activeSavePathKeys`/`activeCategoryKeys`/`activeTagKeys`, returning the underlying `Set<string>` directly (e.g. `computed(() => this.filtersSig().trackers)`), bound to `FilterGroupComponent`'s `[activeKeys]` input.

**Status** (Downloading / Completed / Active / Inactive / Stopped / Checking / Errored) - these are meta-keys that map to (overlapping) arrays of `TorrentState` via the existing `groups: Record<StatusKey, TorrentState[]>` map. Raw membership doesn't work here since a meta-key isn't itself present in the `states` Set. Instead, a meta-key counts as "active" when every state in its array is present in the current `states` Set (subset check), and toggling adds/removes that key's whole state array:

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

This replaces the old `activeKey` computed (which did exact-set-equality matching against a single group and fell back to `'all'` for any combination). It is derived purely from `FilterService.external.states` - no new component-local signal is introduced. Confirmed via codebase research: `FilterService` state is in-memory only (never persisted to `localStorage`/settings), and `Status`/`FilterGroupComponent` are not destroyed/recreated during normal use (server switch, settings modal) - only on full navigation away from the main route. A derived-from-source-of-truth computed is therefore both simpler and safer than tracking a separate selection signal.

Edge case (acceptable, not a regression): because `activeStatusKeys` is a subset check rather than exact-match, a combination of selections whose union happens to fully cover a _different_ meta-key's array will also highlight that key, even though the user didn't click it directly. This is a cosmetic edge case inherent to any derived-highlighting approach over overlapping meta-groups, not a functional bug (filtering itself is unaffected), and is a superset (not a regression) of the imprecision already present in the current single-select `activeKey` matching.

### `FilterService` (`packages/app/src/app/services/filter.service.ts`)

No changes. `filtered`'s per-group `Set.has(...)` checks already implement OR-within-group (any single torrent value matching any set member passes) and AND-across-groups (each non-empty group's condition must pass) semantics.

## Testing

- `filter-group.spec.ts`: update the `activeKey` input usages to `activeKeys` (a `Set`); rewrite the "auto-emit on item removal" describe block to cover: (a) a stale key gets pruned via an `itemSelected` emission while a sibling still-present key remains untouched, (b) no emission when all active keys are still present, (c) no emission when `activeKeys` is empty.
- `status.spec.ts`: extend `setGroup`/`setTrackerGroup`/`setSavePathGroup`/`setCategoryGroup`/`setTagGroup` tests to cover toggle-on (key not yet in the set → added) and toggle-off (key already in the set → removed, other members preserved) cases, in addition to the existing "all" case. Replace the `activeKey` describe block with `activeStatusKeys`, asserting the derived Set for: no filter, an exact single-group match, a two-group union, and an unrecognised/partial combination.

## Documentation

Per project convention, the docs site (`@bitbutler/docs`) user guide update for this page is scoped and written once the implementation has stabilized, around PR creation time - not as part of this spec.
