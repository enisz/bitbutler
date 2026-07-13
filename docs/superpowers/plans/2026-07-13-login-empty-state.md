# Login Screen Empty State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When no servers are configured, the login screen hides the host selector/Connect/Manage-Servers UI and shows a single "Add Server" call to action instead; it reverts to the normal layout automatically once a server exists.

**Architecture:** Add a `hasServers` computed signal and an `addNewServer()` method to the existing `Login` component (`packages/app/src/app/pages/login/login.ts`), then branch the existing template (`login.html`) on that signal. `addNewServer()` reuses the exact modal-opening pattern `ManageServers.openEditor()` already uses to add a server, so no new modal wiring is needed - the existing `ServerCommandHandlerService` already refreshes the store and auto-selects the new server, which flips `hasServers()` back to `true` reactively.

**Tech Stack:** Angular 20 (standalone components, signals, `@if`/`@else` control flow), Vitest + Angular TestBed for unit tests, `@ngx-translate/core` for i18n.

## Global Constraints

- Reuse the existing `general.button.add-server` translation key for the button label ("Add Server" / "Szerver hozzáadása") - do not add a new key for it.
- New translation key `pages.login.form-subtitle-empty` must be added to both `public/i18n/us.json` ("Add a server to get started.") and `public/i18n/hu.json` ("Adj hozzá egy szervert a kezdéshez.").
- No changes to `ManageServers` or `ServerEditor` components themselves.
- No auto-connect after adding a server from the empty state.
- Commit format: `#224: short description`.

---

### Task 1: `Login` component logic - `hasServers` and `addNewServer()`

**Files:**

- Modify: `packages/app/src/app/pages/login/login.ts`
- Test: `packages/app/src/app/pages/login/login.spec.ts`

**Interfaces:**

- Consumes: `this.servers` (existing `Signal<ServerRecord[]>`, `login.ts:125`), `this.modalService` (existing `NgbModal`, `login.ts:67`), `this.commandBusService` (existing `CommandBusService`, `login.ts:75`).
- Produces: `public readonly hasServers: Signal<boolean>` and `public async addNewServer(): Promise<void>` - Task 2's template consumes both by name.

- [ ] **Step 1: Write the failing tests**

Add to `packages/app/src/app/pages/login/login.spec.ts`, after the existing `canConnect` describe block (after line 155):

```typescript
describe('hasServers', () => {
  it('should be false when there are no servers', () => {
    serverStoreMock.servers.set([]);
    expect(component.hasServers()).toBe(false);
  });

  it('should be true when at least one server exists', () => {
    serverStoreMock.servers.set([{ id: '1' }] as any);
    expect(component.hasServers()).toBe(true);
  });
});
```

Add a new describe block after the existing `openManageServers` describe block (after line 284):

```typescript
describe('addNewServer', () => {
  it('should open the ServerEditor modal in add mode', async () => {
    await component.addNewServer();
    expect(modalMock.open).toHaveBeenCalledWith(expect.anything(), { size: 'lg' });
  });

  it('should emit SERVER_ADDED with the new id when the editor resolves', async () => {
    const commandBus = TestBed.inject(CommandBusService) as any;
    modalMock.open.mockReturnValue({ componentInstance: {}, result: Promise.resolve('new-id') });

    await component.addNewServer();

    expect(commandBus.emit).toHaveBeenCalledWith({ type: 'SERVER_ADDED', id: 'new-id' });
  });

  it('should not emit anything when the editor is dismissed', async () => {
    const commandBus = TestBed.inject(CommandBusService) as any;
    const dismissed = Promise.reject<string>(undefined);
    dismissed.catch(() => {});
    modalMock.open.mockReturnValue({ componentInstance: {}, result: dismissed });

    await component.addNewServer();

    expect(commandBus.emit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace=@bitbutler/app -- login.spec.ts`
Expected: FAIL - `component.hasServers is not a function` and `component.addNewServer is not a function`.

- [ ] **Step 3: Implement `hasServers` and `addNewServer()`**

In `packages/app/src/app/pages/login/login.ts`, update the icon import (line 16-22) to add `faPlus`:

```typescript
import {
  faCircleHalfStroke,
  faLanguage,
  faPalette,
  faPlug,
  faPlus,
  faServer,
} from '@fortawesome/free-solid-svg-icons';
```

Update the `icons` field (line 83):

```typescript
  public readonly icons = { faLanguage, faPalette, faCircleHalfStroke, faPlug, faPlus, faServer };
```

Add `hasServers` right after `public servers = this.serverStoreService.servers;` (line 125):

```typescript
  public servers = this.serverStoreService.servers;
  public readonly hasServers = computed(() => this.servers().length > 0);
  public loading = this.serverStoreService.loading;
```

Add `addNewServer()` right after `openManageServers()` (after line 273):

```typescript
  public async addNewServer(): Promise<void> {
    const { ServerEditor } = await import('../../modals/server-editor/server-editor');
    const ref = this.modalService.open(ServerEditor, { size: 'lg' });
    try {
      const newId: string = await ref.result;
      this.commandBusService.emit({ type: 'SERVER_ADDED', id: newId });
    } catch {
      // dismissed - nothing to do
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --workspace=@bitbutler/app -- login.spec.ts`
Expected: PASS - all `hasServers` and `addNewServer` tests green (template-related tests from Task 2 don't exist yet, so the full suite passes at this point).

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/pages/login/login.ts packages/app/src/app/pages/login/login.spec.ts
git commit -m "#224: add hasServers signal and addNewServer to Login"
```

---

### Task 2: Template branch + i18n keys

**Files:**

- Modify: `packages/app/src/app/pages/login/login.html`
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`
- Test: `packages/app/src/app/pages/login/login.spec.ts`

**Interfaces:**

- Consumes: `hasServers()` and `addNewServer()` from Task 1, `icons.faPlus` from Task 1.
- Produces: `.add-server-cta` CSS class on the new button (used only by this task's own tests).

- [ ] **Step 1: Write the failing tests**

Add to `packages/app/src/app/pages/login/login.spec.ts`, after the `quick settings toolbar` describe block (after line 253):

```typescript
describe('empty state', () => {
  it('should hide the host form and show the add-server CTA when there are no servers', () => {
    serverStoreMock.servers.set([]);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('#server'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.add-server-cta'))).not.toBeNull();
  });

  it('should show the host form and hide the add-server CTA when a server exists', () => {
    serverStoreMock.servers.set([{ id: '1', name: 'Local' }] as any);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('#server'))).not.toBeNull();
    expect(fixture.debugElement.query(By.css('.add-server-cta'))).toBeNull();
  });

  it('should call addNewServer when the add-server CTA is clicked', () => {
    serverStoreMock.servers.set([]);
    fixture.detectChanges();
    const addSpy = vi.spyOn(component, 'addNewServer').mockResolvedValue(undefined);

    fixture.debugElement.query(By.css('.add-server-cta')).nativeElement.click();

    expect(addSpy).toHaveBeenCalled();
  });

  it('should show the get-started subtitle when there are no servers', () => {
    serverStoreMock.servers.set([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('pages.login.form-subtitle-empty');
  });

  it('should show the default subtitle when a server exists', () => {
    serverStoreMock.servers.set([{ id: '1', name: 'Local' }] as any);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('pages.login.form-subtitle');
    expect(fixture.nativeElement.textContent).not.toContain('pages.login.form-subtitle-empty');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace=@bitbutler/app -- login.spec.ts`
Expected: FAIL - `.add-server-cta` never found (template doesn't branch yet), subtitle always shows `pages.login.form-subtitle`.

- [ ] **Step 3: Add the i18n key**

In `public/i18n/us.json`, inside the `pages.login` object, add after `"form-subtitle"` (currently line 1066):

```json
      "form-subtitle": "Select a host to connect to.",
      "form-subtitle-empty": "Add a server to get started.",
```

In `public/i18n/hu.json`, inside the `pages.login` object, add after `"form-subtitle"` (currently line 1066):

```json
      "form-subtitle": "Válassz gazdagépet a csatlakozáshoz.",
      "form-subtitle-empty": "Adj hozzá egy szervert a kezdéshez.",
```

- [ ] **Step 4: Update the template**

In `packages/app/src/app/pages/login/login.html`, replace the subtitle paragraph (lines 36-38):

```html
<p class="text-body-secondary small mb-0">{{ 'pages.login.form-subtitle' | translate }}</p>
```

with:

```html
<p class="text-body-secondary small mb-0">
  {{ (hasServers() ? 'pages.login.form-subtitle' : 'pages.login.form-subtitle-empty') | translate }}
</p>
```

Replace the form + button group (lines 42-85):

```html
<form [formGroup]="serverForm" class="mb-4">
  <div class="form-floating">
    <ng-select
      id="server"
      bindLabel="name"
      bindValue="id"
      formControlName="server"
      placeholder="No hosts"
      [searchable]="false"
      [clearable]="false"
      [items]="servers()"
      [fixedPlaceholder]="false"
      [readonly]="servers().length === 0"
      [trackByFn]="trackByFn"
    >
      <ng-template ng-label-tmp let-item="item">{{ item.name }}</ng-template>
    </ng-select>
    <label for="server">{{ 'pages.login.server-form.host' | translate }}</label>
  </div>
</form>

<div class="d-flex flex-column gap-3">
  <button
    type="button"
    class="btn btn-lg btn-primary btn-split"
    (click)="connect()"
    [disabled]="!canConnect()"
  >
    <bb-btn-content
      [icon]="icons.faPlug"
      [text]="'general.button.connect' | translate"
    ></bb-btn-content>
  </button>
  <button
    type="button"
    class="btn btn-lg btn-dashed-secondary btn-split"
    (click)="openManageServers()"
  >
    <bb-btn-content
      [icon]="icons.faServer"
      [text]="'general.button.manage-servers' | translate"
    ></bb-btn-content>
  </button>
</div>
```

with:

```html
@if (hasServers()) {
<form [formGroup]="serverForm" class="mb-4">
  <div class="form-floating">
    <ng-select
      id="server"
      bindLabel="name"
      bindValue="id"
      formControlName="server"
      placeholder="No hosts"
      [searchable]="false"
      [clearable]="false"
      [items]="servers()"
      [fixedPlaceholder]="false"
      [readonly]="servers().length === 0"
      [trackByFn]="trackByFn"
    >
      <ng-template ng-label-tmp let-item="item">{{ item.name }}</ng-template>
    </ng-select>
    <label for="server">{{ 'pages.login.server-form.host' | translate }}</label>
  </div>
</form>

<div class="d-flex flex-column gap-3">
  <button
    type="button"
    class="btn btn-lg btn-primary btn-split"
    (click)="connect()"
    [disabled]="!canConnect()"
  >
    <bb-btn-content
      [icon]="icons.faPlug"
      [text]="'general.button.connect' | translate"
    ></bb-btn-content>
  </button>
  <button
    type="button"
    class="btn btn-lg btn-dashed-secondary btn-split"
    (click)="openManageServers()"
  >
    <bb-btn-content
      [icon]="icons.faServer"
      [text]="'general.button.manage-servers' | translate"
    ></bb-btn-content>
  </button>
</div>
} @else {
<div class="d-flex flex-column gap-3 mb-4">
  <button
    type="button"
    class="btn btn-lg btn-primary btn-split add-server-cta"
    (click)="addNewServer()"
  >
    <bb-btn-content
      [icon]="icons.faPlus"
      [text]="'general.button.add-server' | translate"
    ></bb-btn-content>
  </button>
</div>
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test --workspace=@bitbutler/app -- login.spec.ts`
Expected: PASS - full `login.spec.ts` suite green, including the new `empty state` describe block.

- [ ] **Step 6: Run the full app test suite and lint**

Run: `npm test --workspace=@bitbutler/app`
Expected: PASS - no regressions elsewhere.

Run: `npm run lint`
Expected: PASS - zero warnings.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/pages/login/login.html packages/app/src/app/pages/login/login.spec.ts public/i18n/us.json public/i18n/hu.json
git commit -m "#224: hide host selector and show add-server CTA when no servers exist"
```

---

### Task 3: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start the app**

Run: `npm start`

- [ ] **Step 2: Verify the empty state**

On a fresh profile (or after deleting all servers via Manage Servers), confirm the login screen shows only the "Add Server" button with a plus icon, and the subtitle reads "Add a server to get started."

- [ ] **Step 3: Verify the transition back to the normal layout**

Click "Add Server", fill in and save a server. Confirm the screen switches back to the host selector + Connect + Manage Servers layout, with the new server pre-selected in the dropdown, without a page reload.

- [ ] **Step 4: Verify the normal layout is unaffected when servers already exist**

Restart with at least one server already configured and confirm the screen shows the normal selector/Connect/Manage-Servers layout on load (no regression).

- [ ] **Step 5: Clean up the docs folder**

Per this repo's convention, spec/plan docs must not be merged to main. Once implementation is verified:

```bash
git rm -r docs/superpowers
git commit -m "#224: removed spec and plan"
```
