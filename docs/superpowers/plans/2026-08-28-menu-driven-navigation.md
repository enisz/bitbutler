# Menu-Driven Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the right-aligned `Shell`/`NavRail` sidebar with menu-driven page
navigation, using a new Electron "View" menu (radio items showing the active page),
so the app has only one sidebar left.

**Architecture:** A new main-process "active view" IPC module (mirroring the existing
"active server" module) tracks which page is open and drives a radio-button "View" menu.
Clicking a menu item sends an IPC event the renderer turns into a router navigation;
navigating in the renderer reports the new active page back to the main process. Once
that loop works, the `Shell`/`NavRail` components are deleted and `app.routes.ts` is
flattened to a component-less `pages` path.

**Tech Stack:** Angular 22 (zoneless, signals), Electron (TypeScript main process),
`@bitbutler/shared` IPC contract, Vitest (both `packages/app` and `packages/electron`).

**Spec:** `docs/superpowers/specs/2026-08-28-menu-driven-navigation-design.md`

## Global Constraints

- Out of scope: the Settings page UI itself, and any "back to torrent list" chevron
  affordance. Settings stays a modal (`UI_OPEN_SETTINGS`) for now.
- `/pages/torrent-list` must keep working as a literal URL — `login.ts` already
  navigates there directly.
- The "View" menu is only visible while logged in (same gate as the existing
  Servers/Settings menu items).
- The renderer→main "which view is active" wiring must derive the view id from the URL
  segment, not hardcode `'torrent-list'` — adding a second page later must require only
  a new route entry and a new menu item, no change to this wiring.
- Commit format: `#319: <short description>` (this is a `#319` follow-up task).
- Use `-` (hyphen), never `—` (em dash), in commit messages and any written output.

---

## File Structure

| File                                                                     | Responsibility                                                                                    |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `packages/shared/src/ipc.types.ts`                                       | Adds the `view` namespace to `BitButlerAPI` and `viewId` to `MenuClickPayload`                    |
| `packages/electron/src/ipc/view.ts` (new)                                | In-memory "active view" state + the `view:set-active` IPC handler, mirrors `ipc/server.ts`        |
| `packages/electron/src/ipc/view.spec.ts` (new)                           | Tests for the above                                                                               |
| `packages/electron/src/preload.ts`                                       | Exposes `window.bitbutler.view.setActive`                                                         |
| `packages/electron/src/main.ts`                                          | Registers the new IPC handler                                                                     |
| `packages/electron/src/menu.ts`                                          | Adds the "View" menu with a radio item per page                                                   |
| `packages/electron/src/menu.spec.ts`                                     | Tests for the above                                                                               |
| `packages/app/public/i18n/us.json`, `hu.json`                            | New `electron.menu.view-menu` / `view-torrent-list` keys; removal of the dead `pages.shell` block |
| `packages/app/src/app/models/command.model.ts`                           | New `UI_VIEW_SELECT` command variant                                                              |
| `packages/app/src/app/services/menu-bar-command-handler.service.ts`      | Turns the `view.select` menu click into a `UI_VIEW_SELECT` command                                |
| `packages/app/src/app/services/menu-bar-command-handler.service.spec.ts` | Tests for the above                                                                               |
| `packages/app/src/app/services/ui-command-handler.service.ts`            | Turns `UI_VIEW_SELECT` into a router navigation                                                   |
| `packages/app/src/app/services/ui-command-handler.service.spec.ts`       | Tests for the above                                                                               |
| `packages/app/src/app/app.ts`                                            | Reports the active view to the main process on navigation                                         |
| `packages/app/src/app/app.spec.ts`                                       | Tests for the above                                                                               |
| `packages/app/src/test-setup.ts`                                         | Adds the `window.bitbutler.view` test stub                                                        |
| `packages/app/src/app/app.routes.ts`                                     | Drops the `Shell` component from the `pages` route                                                |
| `packages/app/src/app/pages/main/main.html`                              | Layout fix: `w-100 h-100` → `vw-100 vh-100`                                                       |
| `packages/app/src/app/pages/shell/**` (deleted)                          | `Shell` and `NavRail` components, no longer needed                                                |

---

## Task 1: Shared IPC contract + Electron "active view" module

**Files:**

- Modify: `packages/shared/src/ipc.types.ts`
- Modify: `packages/electron/src/preload.ts`
- Create: `packages/electron/src/ipc/view.ts`
- Test: `packages/electron/src/ipc/view.spec.ts`
- Modify: `packages/electron/src/main.ts`
- Modify: `packages/app/src/test-setup.ts`

**Interfaces:**

- Consumes: `rebuildMenu` from `packages/electron/src/menu.ts` (already exists, used by `ipc/server.ts` the same way).
- Produces: `getActiveViewId(): string | null`, `setActiveViewId(id: string | null): void`, `registerViewIpcHandlers(): void` (all in `ipc/view.ts`); `window.bitbutler.view.setActive(viewId: string): void`. Task 2 (menu.ts) and Task 5 (app.ts) both depend on these.

- [ ] **Step 1: Write the failing test for the active-view module**

Create `packages/electron/src/ipc/view.spec.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ipcOnHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const mockRebuildMenu = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  ipcMain: {
    on: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcOnHandlers.set(channel, handler);
    }),
  },
}));

vi.mock('../menu.js', () => ({ rebuildMenu: mockRebuildMenu }));

describe('getActiveViewId / setActiveViewId', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcOnHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns null initially', async () => {
    const { getActiveViewId } = await import('./view.js');
    expect(getActiveViewId()).toBeNull();
  });

  it('stores and returns the set id', async () => {
    const { getActiveViewId, setActiveViewId } = await import('./view.js');
    setActiveViewId('torrent-list');
    expect(getActiveViewId()).toBe('torrent-list');
  });

  it('accepts null to clear the active view', async () => {
    const { getActiveViewId, setActiveViewId } = await import('./view.js');
    setActiveViewId('torrent-list');
    setActiveViewId(null);
    expect(getActiveViewId()).toBeNull();
  });
});

describe('view:set-active IPC event handler', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcOnHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('updates activeViewId and rebuilds the menu', async () => {
    const { registerViewIpcHandlers, getActiveViewId } = await import('./view.js');
    registerViewIpcHandlers();
    const handler = ipcOnHandlers.get('view:set-active')!;
    handler(null, 'torrent-list');
    expect(getActiveViewId()).toBe('torrent-list');
    expect(mockRebuildMenu).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=packages/electron -- view.spec.ts`
Expected: FAIL — `./view.js` does not exist yet.

- [ ] **Step 3: Implement the active-view module**

Create `packages/electron/src/ipc/view.ts`:

```ts
import { ipcMain } from 'electron';
import { rebuildMenu } from '../menu.js';

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

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=packages/electron -- view.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire the module into the app**

In `packages/electron/src/main.ts`, add the import next to the other `ipc/*` imports:

```ts
import { registerViewIpcHandlers } from './ipc/view.js';
```

And register it inside `registerAppIpcHandlers()`, next to `registerServerIpcHandlers()`:

```ts
function registerAppIpcHandlers(): void {
  if (appIpcHandlersRegistered) return;
  appIpcHandlersRegistered = true;

  registerNotificationIpcHandlers();
  registerServerIpcHandlers();
  registerViewIpcHandlers();
  registerQbIpcHandlers();
  registerTorrentIpcHandlers();
  registerSettingsIpcHandlers();
  registerElectronIpcHandlers();
  registerUpdaterIpcHandlers();
  registerExportIpcHandlers();
  registerLogIpcHandlers();
}
```

- [ ] **Step 6: Expose the IPC call through the preload bridge**

In `packages/electron/src/preload.ts`, add a new `view` namespace to the `api` object,
right after the existing `server: { ... },` block:

```ts
  view: {
    setActive: (viewId: string) => ipcRenderer.send('view:set-active', viewId),
  },
```

- [ ] **Step 7: Add the shared type contract**

In `packages/shared/src/ipc.types.ts`, update `MenuClickPayload` (around line 33):

```ts
export type MenuClickPayload = { action: string; ts: number; serverId?: string; viewId?: string };
```

And add a `view` block to `BitButlerAPI`, right after the `server: { ... };` block:

```ts
  view: {
    setActive(viewId: string): void;
  };
```

- [ ] **Step 8: Add the renderer test stub**

In `packages/app/src/test-setup.ts`, add a `view` stub to the `window.bitbutler = { ... }`
object, right after the existing `server: { ... },` block:

```ts
  view: {
    setActive: noop,
  },
```

- [ ] **Step 9: Verify the whole slice type-checks and builds**

Run: `npm run build --workspace=packages/electron`
Expected: succeeds with no TypeScript errors (confirms `preload.ts` and `main.ts` compile
against the updated shared types).

Run: `npm run test --workspace=packages/app`
Expected: full suite passes (confirms `test-setup.ts` still satisfies the `BitButlerAPI`
shape used elsewhere).

- [ ] **Step 10: Commit**

```bash
git add packages/shared/src/ipc.types.ts packages/electron/src/preload.ts \
  packages/electron/src/ipc/view.ts packages/electron/src/ipc/view.spec.ts \
  packages/electron/src/main.ts packages/app/src/test-setup.ts
git commit -m "#319: add the active-view IPC channel"
```

---

## Task 2: Electron "View" menu

**Files:**

- Modify: `packages/electron/src/menu.ts`
- Test: `packages/electron/src/menu.spec.ts`
- Modify: `packages/app/public/i18n/us.json`
- Modify: `packages/app/public/i18n/hu.json`

**Interfaces:**

- Consumes: `getActiveViewId` from `./ipc/view.js` (Task 1).
- Produces: a `'view.select'` menu action, sent via the existing `sendMenuAction(mainWindow, action, extraPayload)` helper as `sendMenuAction(mainWindow, 'view.select', { viewId: 'torrent-list' })` — Task 3 consumes this `action`/`viewId` shape.

- [ ] **Step 1: Write the failing tests for the View menu**

In `packages/electron/src/menu.spec.ts`, add a new hoisted mock next to
`mockGetActiveServerId` (around line 11):

```ts
const mockGetActiveViewId = vi.hoisted(() => vi.fn<() => string | null>(() => null));
```

Add a mock for the new module, next to the existing `vi.mock('./ipc/server.js', ...)`:

```ts
vi.mock('./ipc/view.js', () => ({ getActiveViewId: mockGetActiveViewId }));
```

Reset it in the outer `beforeEach` (around line 76-84), next to `mockGetActiveServerId.mockReturnValue(null);`:

```ts
mockGetActiveViewId.mockReturnValue(null);
```

Add a new `describe` block, next to the existing `describe('Settings menu', ...)` block:

```ts
describe('View menu', () => {
  it('is hidden when logged out', async () => {
    const template = await buildMenu();
    expect(findItem(template, byLabel('electron.menu.view-menu'))).toBeUndefined();
  });

  it('is shown when logged in, with the torrent list item checked when active', async () => {
    mockGetCookieJar.mockReturnValue(new Map([['srv-1', 'SID=abc']]));
    mockGetActiveViewId.mockReturnValue('torrent-list');
    const template = await buildMenu();
    const viewMenu = findItem(template, byLabel('electron.menu.view-menu'));
    const items = viewMenu!.submenu as MenuItemConstructorOptions[];
    expect(items[0]).toMatchObject({
      label: 'electron.menu.view-torrent-list',
      type: 'radio',
      checked: true,
    });
  });

  it('is unchecked when no view has reported itself active yet', async () => {
    mockGetCookieJar.mockReturnValue(new Map([['srv-1', 'SID=abc']]));
    const template = await buildMenu();
    const viewMenu = findItem(template, byLabel('electron.menu.view-menu'));
    const items = viewMenu!.submenu as MenuItemConstructorOptions[];
    expect(items[0].checked).toBe(false);
  });

  it('sends view.select with the view id when clicked', async () => {
    mockGetCookieJar.mockReturnValue(new Map([['srv-1', 'SID=abc']]));
    const mainWindow = createFakeWindow();
    const template = await buildMenu(mainWindow);
    const viewMenu = findItem(template, byLabel('electron.menu.view-menu'));
    const items = viewMenu!.submenu as MenuItemConstructorOptions[];
    (items[0].click as () => void)();
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      'menu:clicked',
      expect.objectContaining({ action: 'view.select', viewId: 'torrent-list' }),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=packages/electron -- menu.spec.ts`
Expected: FAIL — `electron.menu.view-menu` is never found in the template (the menu
item doesn't exist yet).

- [ ] **Step 3: Implement the View menu**

In `packages/electron/src/menu.ts`, add the import next to the existing
`import { getActiveServerId, serverList } from './ipc/server.js';`:

```ts
import { getActiveViewId } from './ipc/view.js';
```

Add a new item as the first element of the `loggedInItems` array (before the
`...(servers.length > 0 ? [...] : [])` spread), so it renders right after `File` and
before Servers/Settings:

```ts
  const loggedInItems: Electron.MenuItemConstructorOptions[] = loggedIn
    ? [
        {
          label: t('electron.menu.view-menu'),
          submenu: [
            {
              label: t('electron.menu.view-torrent-list'),
              type: 'radio' as const,
              checked: getActiveViewId() === 'torrent-list',
              click: () => sendMenuAction(mainWindow, 'view.select', { viewId: 'torrent-list' }),
            },
          ],
        },
        ...(servers.length > 0
          ? [
              {
                label: t('electron.menu.servers'),
                submenu: serverMenuItems,
              },
            ]
          : []),
```

(the rest of `loggedInItems` — the Settings submenu — is unchanged).

- [ ] **Step 4: Add the i18n keys**

In `packages/app/public/i18n/us.json`, inside the `menu` block, add two keys right
after `"disconnect": "Disconnect",`:

```json
      "view-menu": "View",
      "view-torrent-list": "Torrent List",
```

In `packages/app/public/i18n/hu.json`, inside the `menu` block, add the matching keys
right after `"disconnect": "Kijelentkezés",`:

```json
      "view-menu": "Nézet",
      "view-torrent-list": "Torrent lista",
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test --workspace=packages/electron -- menu.spec.ts`
Expected: PASS (all `View menu` tests, plus the pre-existing ones still pass).

- [ ] **Step 6: Commit**

```bash
git add packages/electron/src/menu.ts packages/electron/src/menu.spec.ts \
  packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git commit -m "#319: add the View menu"
```

---

## Task 3: Menu click → `UI_VIEW_SELECT` command

**Files:**

- Modify: `packages/app/src/app/models/command.model.ts`
- Modify: `packages/app/src/app/services/menu-bar-command-handler.service.ts`
- Test: `packages/app/src/app/services/menu-bar-command-handler.service.spec.ts`

**Interfaces:**

- Consumes: the `'view.select'` action with a `viewId` payload field (Task 2).
- Produces: `UiCommand` variant `{ type: 'UI_VIEW_SELECT'; viewId: string }`, emitted via `CommandBusService.emit(...)`. Task 4 consumes this command.

- [ ] **Step 1: Write the failing tests**

In `packages/app/src/app/services/menu-bar-command-handler.service.spec.ts`, add two
tests next to the existing `it('should emit UI_SERVER_EDITOR_OPEN for server.add', ...)`
block:

```ts
it('should emit UI_VIEW_SELECT with the view id for view.select', () => {
  clicks$.next({ action: 'view.select', ts: 1, viewId: 'torrent-list' });
  expect(commandBusEmit).toHaveBeenCalledWith({
    type: 'UI_VIEW_SELECT',
    viewId: 'torrent-list',
  });
});

it('should do nothing for view.select without a view id', () => {
  clicks$.next({ action: 'view.select', ts: 1 });
  expect(commandBusEmit).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=packages/app`
Expected: FAIL — the two new tests fail because `view.select` falls into the `default`
case and never calls `commandBusEmit`.

- [ ] **Step 3: Add the command type**

In `packages/app/src/app/models/command.model.ts`, update the end of the `UiCommand`
union:

```ts
  | { type: 'UI_TORRENT_EXISTS'; hash: string | null; originalPath: string | null }
  | { type: 'UI_DISCONNECT' }
  | { type: 'UI_VIEW_SELECT'; viewId: string };
```

- [ ] **Step 4: Handle the menu action**

In `packages/app/src/app/services/menu-bar-command-handler.service.ts`, add a new case
right after `case 'server.select': { ... }` (before `case 'help.checkForUpdates':`):

```ts
        case 'view.select': {
          const { viewId } = payload;
          if (viewId) this.commandBusService.emit({ type: 'UI_VIEW_SELECT', viewId });
          break;
        }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test --workspace=packages/app`
Expected: full suite passes, including the two new tests.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/models/command.model.ts \
  packages/app/src/app/services/menu-bar-command-handler.service.ts \
  packages/app/src/app/services/menu-bar-command-handler.service.spec.ts
git commit -m "#319: turn View menu clicks into UI_VIEW_SELECT commands"
```

---

## Task 4: `UI_VIEW_SELECT` → router navigation

**Files:**

- Modify: `packages/app/src/app/services/ui-command-handler.service.ts`
- Test: `packages/app/src/app/services/ui-command-handler.service.spec.ts`

**Interfaces:**

- Consumes: `UI_VIEW_SELECT` command (Task 3), `this.router` (`Router`, already injected in this service at line 54).
- Produces: `this.router.navigate(['/pages', viewId])` call.

- [ ] **Step 1: Write the failing test**

In `packages/app/src/app/services/ui-command-handler.service.spec.ts`, add a test next
to the existing `it('should open Settings modal for UI_OPEN_SETTINGS', ...)` block:

```ts
it('should navigate to the selected view for UI_VIEW_SELECT', async () => {
  commands$.next({ type: 'UI_VIEW_SELECT', viewId: 'torrent-list' });
  await flushPromises();
  expect(routerNavigate).toHaveBeenCalledWith(['/pages', 'torrent-list']);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=packages/app`
Expected: FAIL — `UI_VIEW_SELECT` falls into the `default` case (a `console.warn`, no
`router.navigate` call), so `routerNavigate` is never called.

- [ ] **Step 3: Handle the command**

In `packages/app/src/app/services/ui-command-handler.service.ts`, add a new case right
after the `UI_TORRENT_EXISTS` block and before `default:` (around line 519-521):

```ts
        case 'UI_VIEW_SELECT':
          this.router.navigate(['/pages', command.viewId]);
          break;

        default:
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=packages/app`
Expected: full suite passes, including the new test.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/services/ui-command-handler.service.ts \
  packages/app/src/app/services/ui-command-handler.service.spec.ts
git commit -m "#319: navigate on UI_VIEW_SELECT"
```

---

## Task 5: Report the active view to the main process

**Files:**

- Modify: `packages/app/src/app/app.ts`
- Test: `packages/app/src/app/app.spec.ts`

**Interfaces:**

- Consumes: `window.bitbutler.view.setActive` (Task 1), Angular `Router.events` / `NavigationEnd`.
- Produces: nothing consumed by later tasks — this closes the loop back to the main process for Task 2's `checked` state.

- [ ] **Step 1: Write the failing tests**

In `packages/app/src/app/app.spec.ts`, add `Router` to the existing
`@angular/router` import:

```ts
import { Router, provideRouter } from '@angular/router';
```

Add a new `describe` block at the end of the file, before the closing `});` of the
outer `describe('App', ...)`:

```ts
describe('active view reporting', () => {
  it('notifies the main process of the active view when navigation reaches a /pages/* route', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const setActiveSpy = vi.spyOn(window.bitbutler.view, 'setActive');

    await router.navigateByUrl('/pages/torrent-list');

    expect(setActiveSpy).toHaveBeenCalledWith('torrent-list');
  });

  it('does not notify the main process for a non-/pages/ route', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const setActiveSpy = vi.spyOn(window.bitbutler.view, 'setActive');

    await router.navigateByUrl('/login');

    expect(setActiveSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=packages/app`
Expected: FAIL — `window.bitbutler.view.setActive` is never called since `App` doesn't
subscribe to router events yet.

- [ ] **Step 3: Implement the navigation reporting**

In `packages/app/src/app/app.ts`, update the `@angular/router` import (currently just
`import { RouterOutlet } from '@angular/router';`):

```ts
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
```

Add a new injected field next to the other service injections (e.g. after
`private readonly windowService = inject(WindowService);`):

```ts
  private readonly router = inject(Router);
```

Add a new subscription at the end of the constructor, right after the existing
`generalSettingsService.asObservable()...subscribe(...)` block, before the constructor's
closing brace:

```ts
this.router.events
  .pipe(
    filter((e): e is NavigationEnd => e instanceof NavigationEnd),
    takeUntilDestroyed(this.destroyRef),
  )
  .subscribe((event) => {
    const match = event.urlAfterRedirects.match(/^\/pages\/([^/]+)/);
    if (match) window.bitbutler.view.setActive(match[1]);
  });
```

(`filter` and `takeUntilDestroyed` are already imported in this file.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=packages/app`
Expected: full suite passes, including the two new tests.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/app.ts packages/app/src/app/app.spec.ts
git commit -m "#319: report the active view to the main process on navigation"
```

---

## Task 6: Remove `Shell`/`NavRail`, flatten the `pages` route

**Files:**

- Modify: `packages/app/src/app/app.routes.ts`
- Modify: `packages/app/src/app/pages/main/main.html`
- Delete: `packages/app/src/app/pages/shell/shell.ts`, `shell.html`, `shell.scss`, `shell.spec.ts`
- Delete: `packages/app/src/app/pages/shell/nav-rail/nav-rail.ts`, `nav-rail.html`, `nav-rail.scss`, `nav-rail.spec.ts`
- Modify: `packages/app/public/i18n/us.json`
- Modify: `packages/app/public/i18n/hu.json`

**Interfaces:**

- Consumes: nothing from Tasks 1-5 — this is an independent removal/refactor.
- Produces: nothing consumed elsewhere; this is the terminal task.

This task removes code rather than adding new behavior, so there is no new unit test to
write first — the verification is that the full existing suite still passes and the app
still builds once `Shell`/`NavRail` are gone.

- [ ] **Step 1: Flatten the `pages` route**

In `packages/app/src/app/app.routes.ts`, replace the `pages` route entry:

```ts
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((mod) => mod.Login),
  },
  {
    path: 'pages',
    children: [
      {
        path: 'torrent-list',
        loadComponent: () => import('./pages/main/main').then((mod) => mod.Main),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '/login',
    pathMatch: 'full',
  },
];
```

- [ ] **Step 2: Fix `Main`'s layout to not depend on `Shell`'s viewport-sized wrapper**

In `packages/app/src/app/pages/main/main.html`, change line 1:

```html
<div class="d-flex flex-row vw-100 vh-100"></div>
```

(was `<div class="d-flex flex-row w-100 h-100">`).

- [ ] **Step 3: Delete `Shell` and `NavRail`**

```bash
rm -rf packages/app/src/app/pages/shell
```

- [ ] **Step 4: Remove the dead `pages.shell` i18n block**

In `packages/app/public/i18n/us.json`, remove:

```json
    "shell": {
      "nav": {
        "label": "Page navigation",
        "torrents": "Torrents",
        "about": "About",
        "disconnect": "Disconnect"
      }
    },
```

(the block sits directly between the `servers` block's closing `},` and the `"main": {`
key).

In `packages/app/public/i18n/hu.json`, remove the matching block:

```json
    "shell": {
      "nav": {
        "label": "Oldal navigáció",
        "torrents": "Torrentek",
        "about": "A BitButlerről",
        "disconnect": "Kijelentkezés"
      }
    },
```

- [ ] **Step 5: Run the full app test suite**

Run: `npm run test --workspace=packages/app`
Expected: full suite passes with no reference-to-deleted-file errors (the deleted
`shell.spec.ts`/`nav-rail.spec.ts` are simply gone from the run).

- [ ] **Step 6: Verify the production build still compiles**

Run: `npm run build --workspace=packages/app`
Expected: succeeds — this catches any leftover import of `Shell`/`NavRail` the test
suite might not exercise.

- [ ] **Step 7: Manual smoke check**

Run: `npm start`, log in against a real or test qBittorrent-nox instance, and confirm:

- The right-aligned sidebar is gone; only the torrent-list filter sidebar remains.
- The Electron menu bar shows a "View" menu with a checked "Torrent List" item.
- `File > Disconnect` (`Ctrl+L`) and `Help > About` (`F1`) still work exactly as before.

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/app/app.routes.ts packages/app/src/app/pages/main/main.html \
  packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git add -u packages/app/src/app/pages/shell
git commit -m "#319: remove the Shell/NavRail sidebar in favor of menu-driven navigation"
```

---

## Self-Review Notes

- **Spec coverage:** Section A (routing) → Task 6. Section B (removal) → Task 6.
  Section C (Electron menu + IPC) → Tasks 1-2. Section D (renderer wiring, both
  directions) → Tasks 3-5. Section E (testing) → covered inline in every task's Step
  1/Step 2 pairs plus Task 6 Steps 5-6.
- **Type consistency checked:** `getActiveViewId`/`setActiveViewId`/`registerViewIpcHandlers`
  (Task 1) are the exact names used in Task 2's `menu.ts` import and `view.spec.ts`.
  `UI_VIEW_SELECT` / `viewId` (Task 3) match what Task 4's `ui-command-handler.service.ts`
  reads off `command.viewId`. `window.bitbutler.view.setActive` (Task 1's shared type +
  preload + test stub) matches the call site added in Task 5.
- **No placeholders:** every step has literal file contents to write, not descriptions.
