# Settings pages design

## Intent

Replace the two settings modals (app settings and qBittorrent settings) with full pages that use the sidebar-and-cards layout from the design handoff (`design_handoff_settings`). The design is a visual reference only; its contents are filler and the real content comes from the existing tabs. One PR covers the shared shell and both pages.

Success criteria:

- Both settings screens are routed pages built on one shared shell component.
- Every pane has its own URL, so any pane can be opened directly by route.
- The app settings pane list matches the design's grouping, with an added Notifications pane.
- Existing behavior is preserved: forms save the same data, with the same validation, dirty tracking and unsaved-changes prompt.
- The page works across all themes and adapts to screen width (1 or 2 card columns).

## Out of scope

- Moving Manage Servers, Manage Tags and Manage Categories into the settings page (follow-up PR; the shell supports panes without a save bar so this is a small step later).
- Settings search and sidebar collapse (the handoff marks both as not designed).
- Merging the qBittorrent settings into the app settings page (the shell makes this a nav-config change if wanted later).
- Live theme preview before Save (theme still applies on Save, as today).
- A window-close prompt for unsaved changes.
- Auth guards. Settings are only reachable from the logged-in menu (`menu.ts` builds the Settings menu only when `loggedIn`) and the torrent-list button bar, and users cannot navigate by URL in Electron.

## Routes

Two lazy routes under `pages/`, each with a `:pane` parameter that selects the visible pane:

```
pages/settings/:pane      general|appearance|startup|notifications|polling|path-mappings|torrent-list-grid|status-bar
pages/qb-settings/:pane   bandwidth|storage|queue-limits|seeding-ratios
```

Every pane has its own URL. An unknown or missing `:pane` redirects to the page's first pane.

- `UI_OPEN_SETTINGS` and `UI_OPEN_QB_SETTINGS` keep their names. Both gain an optional `pane` field (replacing `tabToOpen`). Their handlers navigate to the page (default pane when none given) instead of opening a modal.
- The back button in the sidebar navigates to `pages/torrent-list`.
- A `canDeactivate` guard sits on each route. It receives the next URL and allows navigation without prompting when the next URL is still inside the same page (switching panes changes only `:pane`), and prompts only when leaving the page with unsaved changes. It reuses `ConfirmService` and the existing `components.modals.guard.*` strings.
- The guard lets navigation through when it carries a `force` flag. `forceLogout` in `qb.service.ts` (the 401/403 path) sets it, so an expired session never asks the user to stay on a page whose session is gone. A deliberate Disconnect still prompts.

## Shell

One `SettingsShell` component takes a page config: title key, nav groups (each with items: id, label key, icon, route), footer note key, and a reference to the page's state service. It renders:

- **Sidebar:** back button, title, grouped nav with per-item unsaved marker, version footer (version from the app build).
- **Main area:** pane title and description, "Unsaved changes" pill, the panes, sticky footer with Discard and Save.
- Panes without a save bar are left to the Manage follow-up PR, which adds whatever flag it needs.

Page components (`pages/settings`, `pages/qb-settings`) are thin: they declare their config, provide their state service, and pass the pane list (id and lazy `loadComponent`) to the shell.

**All panes of a page stay mounted** and the shell shows only the active one (selected by the `:pane` route parameter), exactly as the modals do today with `ngComponentOutlet` and a `bb-tab-panel--active` class. This is deliberate: Torrent List Grid, Status Bar and the four qBittorrent panes each own a local `FormGroup` and register their save function from their constructor, so destroying a pane on navigation would lose its unsaved edits. Keeping panes mounted leaves those six components untouched and preserves edits when switching panes. Panes load lazily and in parallel, and the shell shows a spinner until they are ready.

Removed: both modal components with their `.html`/`.scss`, the `Settings` and `QbSettings` branches of `ui-command-handler.service.ts`, and their `isModalOpen` handling.

## State and panes

Page-scoped state services replace `SettingsStateService` and `QbSettingsStateService`. They keep the existing API (`markDirty`, `registerSave`, `isDirty`, `isDirtyMap`, `resetDirty`, `saveAll`), so the shell treats both pages the same.

`saveAll()` switches from `Promise.all` to `allSettled`: forms that saved clear their dirty flag, forms that failed stay dirty, and the failure is reported.

### App settings

- `GeneralSettingsFormService` owns the single `generalSettingsForm`, including the master-switch logic and the open-at-login hint now in `general.ts`. It loads from `GeneralSettingsService`, marks dirty on change, saves the whole object in one call and reapplies the theme.
- Each existing fieldset maps to a pane, bound to its slice of that form:

| Pane          | Existing content                                           |
| ------------- | ---------------------------------------------------------- |
| General       | Torrent handling, Localization (Language, Date format)     |
| Appearance    | Appearance (theme family and mode)                         |
| Startup       | Startup (open at login, start minimized, automatic update) |
| Notifications | Notifications (OS and in-app groups)                       |

- `ServerSettingsFormService` does the same for the server form. Polling and Path Mappings are the two panes. It still reloads when `currentServerId` changes and resets dirty when it does.
- Torrent List Grid and Status Bar keep their own forms and move onto the shell unchanged apart from the state service import.
- Dirty is tracked per form, so the sidebar marker shows on every pane of a form that is dirty.

### qBittorrent settings

- `QbSettingsStateService` stays, and the page loads the preferences before it creates the panes, because each pane reads `preferences()` once in its constructor.
- The four panes (Bandwidth, Storage, Queue Limits, Seeding Ratios) move onto the shell unchanged apart from the state service import.
- The page shows a spinner while loading preferences and an inline error with a Retry button if the load fails.

## Visual layer

The design's palette equals the existing BitButler theme (`styles/themes/bitbutler/_dark.scss`), so the shell uses existing CSS variables and no hardcoded hex values:

| Design token              | Variable                                                        |
| ------------------------- | --------------------------------------------------------------- |
| page and panel background | `--bs-body-bg`, `--bs-card-bg`                                  |
| elevated, select          | `--bs-card-cap-bg`                                              |
| border                    | `--bs-border-color`                                             |
| accent                    | `--bb-accent`, `--bb-accent-rgb`                                |
| controls                  | `--bb-control-bg`, `--bb-control-border`, `--bb-control-radius` |

Shades with no variable (sidebar, nav hover, nav active) use `color-mix()` over these variables, as `_theme-utils.scss` already does, so every theme gets a sensible result. All themes are checked visually.

Existing controls and styles are reused and restyled, not rebuilt: `bb-fieldset`, `bb-option`, `form-switch`, ng-select, `bb-popover`, `ngbTooltip`, FontAwesome. New styles live in `settings-shell.scss` (sidebar, nav states, pane header, sticky footer, pill, 10px scrollbar).

### Card grid

- `bb-fieldset` becomes the card (border, radius 12, uppercase title row).
- The pane content area is a container (`container-type: inline-size`), not a media query, because the sidebar takes 268px.
- The grid is one column by default and two columns above a content-width threshold (starting at about 1500px, one tunable value), max two columns.
- `align-items: start` so cards keep their own height. Cards fill left to right in DOM order, so tab order matches reading order.
- A `bb-card--wide` modifier spans both columns, for Path Mappings, the Torrent List Grid Columns card, and any card with wide rows.
- Cards that are one big fieldset are split where the form already has groups: Notifications into OS and in-app cards, Localization into Language and Date format.
- The design's fixed 860px content column becomes a fluid container with a larger max width. Below the minimum content width the pane scrolls instead of using an undefined collapsed sidebar.

## Import Torrents link

The category path mapping note in `import-torrents` currently opens QbSettings (Storage) as a stacked modal. A page cannot stack on a modal, and navigating would lose the in-progress import. The link is removed: the callout stays, the text is reworded to name the setting without linking, and `openQbSettings()` and its `QbSettings` import are deleted.

## Known behavior: polling pauses on settings pages

The torrent list page owns the maindata polling subscription and unsubscribes when it is destroyed. Navigating to a settings page therefore pauses polling, and with it the polling-driven notifications (finished downloads, poll failures), until the user returns. The modals did not have this effect because they sat on top of a live torrent list. This is accepted for this PR; `QbPollingService` resumes from its last position on return. Lifting polling out of the torrent list page is a possible follow-up.

Because of this, an open settings or qBittorrent settings command is ignored while any modal is open (`NgbModal.hasOpenModals()`), so it can never navigate away from a dialog that holds unsaved state.

## i18n

New keys in `us.json` and `hu.json`: nav group labels (Application, Server, Interface, plus the qBittorrent group title), pane descriptions, footer notes (app settings: applies to this device only; qBittorrent: saved on the server), the Notifications pane title, and empty/error strings. Existing `pages.settings.tab.*` and `pages.qb-settings.tab.*` keys keep their names where they still apply.

## Errors and feedback

- Save success: a short success toast (title "Settings Saved"), since the page no longer closes. Save failure: a danger toast (title "Failed to Save Settings", message is the raw error), form stays dirty.
- Discard reloads the form from persisted values and clears dirty, without confirmation. Save and Discard are disabled until something is dirty.
- Leaving the page with unsaved changes prompts through the existing guard (except forced logout, above).
- Toast titles and messages follow the repository's toast rules.

## Testing

Specs sit next to the code.

- **Shell:** nav groups and items render, active route is marked, pill and button states follow dirty, footer note renders.
- **Guard:** prompts when leaving the page with unsaved changes, does not prompt when only `:pane` changes, and does not prompt when the `force` flag is set.
- **State services:** existing specs move over, plus `allSettled` partial-failure behavior.
- **Form services:** most of `general.spec.ts` and `server.spec.ts` port here since the logic moves with the form. Pane specs reduce to binding checks.
- **Command handler:** both commands navigate to the right pane, with and without `pane`.
- **Import Torrents:** the note renders without a link.
- **Visual (manual):** the card grid and every theme at laptop and wide widths.

## Follow-up (separate PR)

Manage Servers, Manage Tags and Manage Categories as a "Manage" sidebar group of panes without a save bar. Open points for that PR: Manage Servers is also opened from the login screen (`hideConnect` mode) so its modal stays there, tags and categories read the torrent store, and ag-grid panes need a layout pass because the design has no grids.
