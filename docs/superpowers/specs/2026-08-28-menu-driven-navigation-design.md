# Menu-driven navigation (replace the shell/nav-rail with the Electron app menu)

## Purpose

`#319` introduced a `Shell` component with a right-aligned `NavRail` sidebar to prepare
for multi-page navigation. Having a second, page-level sidebar in addition to the
existing torrent-list sidebar is one navigation surface too many. This change removes
the shell/nav-rail entirely and replaces page navigation with the Electron main-process
application menu instead: a new "View" menu whose items are radio buttons showing which
page is currently active.

**Out of scope for this task:**

- The actual Settings page UI (the mockup that motivated this conversation). Only the
  navigation mechanism is being built now; Settings stays a modal (`UI_OPEN_SETTINGS`)
  until a future task turns it into a page.
- Any "back to torrent list" chevron affordance. With only one page in the route table,
  there's nothing to navigate back from yet. This will be revisited once a second page
  (e.g. Settings) actually exists.

## Success criteria

- The right-aligned `NavRail` sidebar is gone; there is only one sidebar left (the
  torrent-list filter sidebar).
- Navigating to `/pages/torrent-list` still works and renders `Main` with no visual
  regression.
- An Electron "View" menu exists (visible only while logged in) with a single checked
  "Torrent List" radio item, wired end-to-end through real IPC (not a stub).
- Adding a second page later requires only: a new route entry, a new `View` submenu
  item with a matching id, and nothing else — the renderer→main "which view is active"
  wiring must not need to change.

## A. Routing restructure

Angular allows a route with no `component`/`loadComponent`, only `children`. Such a
route contributes nothing but a URL prefix; its matched child renders into the nearest
ancestor `<router-outlet>` (here, the root outlet in `app.html`). This removes the need
for `Shell` to exist purely to host a nested outlet:

```ts
// packages/app/src/app/app.routes.ts
{
  path: 'pages',
  children: [
    { path: 'torrent-list', loadComponent: () => import('./pages/main/main').then((m) => m.Main) },
  ],
},
```

`/pages/torrent-list` is unchanged as a URL — `login.ts` already navigates to that
literal path (not a path relative to a `pages` component), so no caller needs to change.

**Layout fix required:** `Shell`'s wrapper div sized itself with viewport units
(`vw-100 vh-100`), and `Main`'s own root div uses percentage units (`w-100 h-100`),
relying on Shell's viewport-sized wrapper as its ancestor. Nothing in the global styles
(`styles.scss`, `index.html`) gives `html`/`body`/`app-root` an explicit height, so once
`Main` sits directly under the root outlet, `h-100`/`w-100` resolves against nothing and
collapses to zero height. `Login` already renders straight into the root outlet and
already uses `100vh`/`100vw` for exactly this reason (`login.scss`'s `.login-container`).
`Main`'s root container must get the same fix: `w-100 h-100` → `vw-100 vh-100`.

## B. Removing `Shell` / `NavRail`

Delete entirely:

- `packages/app/src/app/pages/shell/shell.ts`, `.html`, `.scss`, `.spec.ts`
- `packages/app/src/app/pages/shell/nav-rail/nav-rail.ts`, `.html`, `.scss`, `.spec.ts`

Remove the `pages.shell` i18n block (`nav.label`, `nav.torrents`, `nav.about`,
`nav.disconnect`) from `packages/app/public/i18n/us.json` and `hu.json` — it is only
referenced from `nav-rail.html`, so it becomes fully dead.

Nothing is lost functionally:

- The rail's only navigation link (Torrent List) is superseded by the new View menu.
- The rail's About/Disconnect buttons already duplicate existing menu items:
  `Help > About` (`F1`) and `File > Disconnect` (`Ctrl+L`) in `menu.ts`.

## C. Electron "View" menu + IPC plumbing

Mirrors the existing `server:set-active` / `getActiveServerId` pattern
(`packages/electron/src/ipc/server.ts`) exactly, for a new "active view" concept owned
by the main process.

**New `packages/electron/src/ipc/view.ts`:**

```ts
let activeViewId: string | null = null;

export const getActiveViewId = (): string | null => activeViewId;
export const setActiveViewId = (id: string | null): void => {
  activeViewId = id;
};

export function registerViewIpcHandlers(): void {
  ipcMain.on('view:set-active', (_event, viewId: string | null) => {
    activeViewId = viewId;
    rebuildMenu();
  });
}
```

Registered alongside the other handlers in `packages/electron/src/main.ts`'s
`registerAppIpcHandlers()`.

**`packages/electron/src/preload.ts`:** new namespace

```ts
view: {
  setActive: (viewId: string) => ipcRenderer.send('view:set-active', viewId),
},
```

**`packages/shared/src/ipc.types.ts`:**

- `BitButlerAPI` gains the `view: { setActive(viewId: string): void }` namespace.
- `MenuClickPayload` gains an optional `viewId?: string`, alongside the existing
  `serverId?: string`:
  `export type MenuClickPayload = { action: string; ts: number; serverId?: string; viewId?: string };`

**`packages/electron/src/menu.ts`:** new top-level `View` menu inside `loggedInItems`
(same visibility gate as the existing Servers/Settings items — pages only exist once
logged in), placed right after `File` and before the Servers/Settings items (there's no
Edit menu here, so View sits in the conventional File → Edit → View slot, immediately
after File). For now, one radio item:

```ts
{
  label: t('electron.menu.view-menu'),
  submenu: [
    {
      label: t('electron.menu.view-torrent-list'),
      type: 'radio',
      checked: getActiveViewId() === 'torrent-list',
      click: () => sendMenuAction(mainWindow, 'view.select', { viewId: 'torrent-list' }),
    },
  ],
},
```

New i18n keys in both `us.json` and `hu.json`: `electron.menu.view-menu` ("View") and
`electron.menu.view-torrent-list` ("Torrent List").

## D. Renderer-side wiring

Two directions, each following an existing pattern in the codebase.

**Menu click → navigate.** `MenuBarCommandHandlerService` gets a new case, mirroring
`server.select`:

```ts
case 'view.select': {
  const { viewId } = payload;
  if (viewId) this.commandBusService.emit({ type: 'UI_VIEW_SELECT', viewId });
  break;
}
```

New `UiCommand` variant in `packages/app/src/app/models/command.model.ts`:
`{ type: 'UI_VIEW_SELECT'; viewId: string }`.

`UiCommandHandlerService` (already injects `Router` for the disconnect flow) handles it:

```ts
case 'UI_VIEW_SELECT':
  this.router.navigate(['/pages', command.viewId]);
  break;
```

**Navigation → notify main.** Something must call `window.bitbutler.view.setActive(viewId)`
whenever the route settles on a `/pages/*` route, so the menu's radio state stays correct
regardless of how navigation happened. This mirrors `ServerStoreService`'s existing
`effect()` that calls `window.bitbutler.server.setActive(id)` on server-id change, but
there is no "view store" service to host it in yet, and building one for a single page
would be speculative. It goes directly in `App`'s constructor (`app.ts`), which already
owns equivalent global reactions (`translateService.onLangChange`,
`torrentStoreService.finished$`, etc.):

```ts
this.router.events
  .pipe(
    filter((e): e is NavigationEnd => e instanceof NavigationEnd),
    takeUntilDestroyed(this.destroyRef),
  )
  .subscribe((e) => {
    const match = e.urlAfterRedirects.match(/^\/pages\/([^/]+)/);
    if (match) window.bitbutler.view.setActive(match[1]);
  });
```

The id is derived from the URL segment rather than hardcoded to `'torrent-list'`, so
adding a second page later is just a new route + a new menu item — this subscription
does not need to change.

**Edge case:** on a fresh app launch, the main process's `activeViewId` starts `null`
until the renderer's first `NavigationEnd` for `/pages/torrent-list` fires and reports
it. The View menu already only appears once logged in (`loggedInItems`), and login only
completes shortly before that first navigation, so the window where the radio item would
show as unchecked is effectively unobservable in practice. No special handling needed.

## E. Testing

- `main.spec.ts` — update any layout-class assertions to `vw-100 vh-100`; confirm `Main`
  renders correctly with no `Shell` ancestor.
- `shell.spec.ts`, `nav-rail.spec.ts` — deleted along with the components.
- `menu-bar-command-handler.service.spec.ts` — new case: `view.select` → emits
  `UI_VIEW_SELECT`.
- `ui-command-handler.service.spec.ts` — new case: `UI_VIEW_SELECT` →
  `router.navigate(['/pages', viewId])`.
- `app.spec.ts` — new coverage: `NavigationEnd` on a `/pages/*` URL →
  `window.bitbutler.view.setActive` called with the right id.
- `menu.spec.ts` (electron) — new `View` menu radio item; checked state driven by
  `getActiveViewId()`.
- New `packages/electron/src/ipc/view.spec.ts`, mirroring `server.spec.ts`'s coverage of
  `getActiveServerId`/`setActiveServerId` and the `server:set-active` IPC handler.
- `test-setup.ts` — add a `view: { setActive: noop }` stub next to the existing
  `server.setActive` one, or any test touching `window.bitbutler` globally breaks.
