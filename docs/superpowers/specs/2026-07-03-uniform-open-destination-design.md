# Uniform "Open Destination" button + row double-click fix

## Problem

1. The "Open Destination" action is presented inconsistently:
   - In the Torrent Details modal footer, the button is hidden entirely when path mappings can't resolve a local path.
   - In the grid context menu, the equivalent item is always rendered but shown disabled with an explanatory tooltip when unresolved.

   This should be unified: always render the button, disable it when unresolved, and explain why via a tooltip in both places.

2. The context menu renders disabled-item tooltips through a hand-rolled mechanism (native Popover API + manual position math in `context-menu.ts`), built specifically to escape `.bb-menu`'s `overflow: auto` clipping. The codebase already has an established pattern for tooltips that must escape a clipping/scrolling ancestor: `ngbTooltip` with `container="body"` (used throughout, including inside `ngbDropdown` menus). This should replace the manual mechanism.

3. When "Open Destination" is configured as the grid's row double-click action, and path mappings are not configured (or don't resolve), double-clicking a row calls `electronService.openPath(event.data.save_path)` with the **raw remote path**, with no path resolution step at all. This throws an OS-level error dialog instead of failing gracefully. This is a strict subset of the bug: the call never resolves through `pathService.resolveLocalPath()`, unlike every other "open destination" entry point (footer button, context menu item), so it's broken whenever remote and local filesystems differ - not only when mappings are absent.

## Design

### 1. Torrent Details modal footer button

File: `packages/app/src/app/modals/torrent-details/torrent-details.html`

Change the `@if (dataService.localPath())` guard around the "Open Destination"/"Show File" `ngbDropdownItem` button so the button always renders. Add:

- `[disabled]="!dataService.localPath()"` on the button.
- `[ngbTooltip]="'components.modals.torrent-details.general.tooltip.open-destination-unresolved' | translate"`, `[disableTooltip]="!!dataService.localPath()"`, `placement="right"`, `container="body"`.

Add the new key to both `public/i18n/us.json` and `public/i18n/hu.json` under `components.modals.torrent-details.general.tooltip.open-destination-unresolved`, with the same message as the existing context-menu key (`pages.main.grid.context-menu.tooltip.open-destination-unresolved`): "This torrent's save path could not be resolved on this machine." Each feature keeps its own translation namespace rather than reaching into another feature's keys, matching the existing convention (e.g. `local-path-failed` toast text is also duplicated per-feature rather than shared).

`ngbDropdownItem` buttons support a native `disabled` attribute like any `<button>`; clicking a disabled button won't fire `(click)`, so `actionsService.openPath()` is naturally not invoked.

### 2. Context menu tooltip mechanism

Files: `packages/app/src/app/pages/main/grid/context-menu/context-menu.html`, `context-menu.ts`, `context-menu.scss`.

- Add to the `kind === 'item'` button template:
  - `[ngbTooltip]="entry.tooltip ? (entry.tooltip | translate) : null"`
  - `placement="{{ entry.id === 'files.openDestination' ? 'top' : 'right' }}"`
  - `container="body"`
- Remove the manual tooltip mechanism entirely:
  - Template: the `#tooltipEl` popover div at the bottom of `context-menu.html`.
  - Component: `tooltipElRef` (`@ViewChild`), `tooltipText` signal, `onItemMouseEnter()`, `onItemMouseLeave()`, and their `(mouseenter)`/`(mouseleave)` bindings on the item button.
  - SCSS: the `.bb-tooltip-popover` rule.
- No changes to `grid-context-menu.service.ts` - it already sets `disabled`/`tooltip` correctly for every relevant entry (open destination, pin/unpin, sort, filter, export-unavailable), and those all flow through the same generic template binding.

Placement rationale: `files.openDestination` is the first item in the "Files" submenu, so a top-placed tooltip has nothing above it to overlap. Every other disabled item with a tooltip keeps the existing "right" placement convention used elsewhere in the app (e.g. modal footer dropdowns, `add-torrent` options).

### 3. Row double-click "Open Destination" fix

File: `packages/app/src/app/pages/main/grid/grid.ts`, `handleRowDoubleClick()`.

Replace:

```ts
else if (action === 'SAVE_PATH' && event.data.save_path)
  this.electronService.openPath(event.data.save_path);
```

with:

```ts
else if (action === 'SAVE_PATH' && event.data.content_path)
  this.commandBusService.emit({
    type: 'UI_OPEN_DESTINATION',
    remotePath: event.data.content_path,
    hash: event.data.hash,
  });
```

This routes through the existing `UI_OPEN_DESTINATION` handler in `ui-command-handler.service.ts`, which already:

- resolves the local path via `pathService.resolveLocalPath()`,
- shows a danger toast ("Could not resolve local path") and stops if resolution fails,
- otherwise shows the file or opens the folder with an info toast.

This matches the `remotePath`/`hash` shape the context menu's `files.openDestination` action already emits (`data.row.content_path`, `data.row.hash`), so all three "open destination" entry points (footer, context menu, row double-click) now share one resolution/error path. This part reuses the `UI_OPEN_DESTINATION` handler's existing toasts, so it needs no new translation strings of its own (unlike part 1, which adds one new key).

If `electronService` becomes unused elsewhere in `grid.ts` after this change, remove the now-unused import/injection.

## Testing

- `torrent-details.spec.ts`: update/add cases so the "Open Destination"/"Show File" button is always present, and asserts `disabled` state + tooltip text based on `localPath()`.
- `context-menu.spec.ts`: replace tests of the manual popover mechanism (`onItemMouseEnter`/`onItemMouseLeave`, popover show/hide) with assertions that `ngbTooltip`/`disableTooltip` inputs are bound correctly for disabled items with a `tooltip`.
- `grid.spec.ts`: update the `SAVE_PATH` double-click test to assert a `UI_OPEN_DESTINATION` command is emitted with `content_path`/`hash` instead of asserting a direct `electronService.openPath()` call.
