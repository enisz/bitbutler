# Manage Servers Credential Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every place that connects to a server prompt for credentials (instead of failing silently) when the server has no saved username/password and no active session: the Manage Servers modal (Task 1), and — added after the final review found a third call site with the identical bug — the login page and the app/tray menu's "switch server" action (Tasks 2-4).

**Architecture:** Task 1 gave `ManageServers.switchTo()` the same missing-credentials branch `Login.connect()` already had, inlined directly (no shared helper) since there were only two call sites. The final whole-branch review found a third call site — `UiCommandHandlerService.handleServerSwitch()` (the app/tray menu's server switcher) — with the exact same gap. With three call sites, Tasks 2-4 extract the duplicated logic into a new `CredentialPromptService` (check-missing-credentials + open-prompt + save-or-return-runtime-creds) and make all three callers (`Login.connect()`, `ManageServers.switchTo()`, `UiCommandHandlerService.handleServerSwitch()`) use it instead of inlining it.

**Tech Stack:** Angular 20 (signals, standalone components), `@ng-bootstrap/ng-bootstrap` (`NgbModal`), Vitest + Angular TestBed.

## Global Constraints

- Commit format: `#255: short description` (this is issue #255).
- Use `-` not `—` in all commit messages and any written output.
- `npm run lint` must pass with zero warnings before committing (enforced by pre-commit hook, but run it manually too since this task edits `.ts`).

---

### Task 1: Prompt for credentials in `ManageServers.switchTo()` when none are saved

**Files:**

- Modify: `packages/app/src/app/modals/manage-servers/manage-servers.ts:104-125` (the `switchTo` method)
- Modify: `packages/app/src/app/modals/manage-servers/manage-servers.spec.ts` (add `select` to the `ServerStoreService` mock, fix the existing `switchTo` fixture, add new `switchTo` tests)

**Interfaces:**

- Consumes (already available in `ManageServers`, no new injections needed):
  - `this.qbService.auth.hasCookie(id: string): Promise<boolean>`
  - `this.qbService.auth.login(id: string, username?: string, password?: string): Promise<{ loggedIn: boolean }>`
  - `this.serverService.update(id: string, changes: Partial<NewServer>): Promise<boolean>` (already injected as `serverService`)
  - `this.commandBusService.emit({ type: 'SERVER_UPDATED', id: string })`
  - `this.modalService.open(component)` returning an `NgbModalRef` (already injected as `modalService`)
  - `setModalInput(modalRef, name, value)` from `../../utils/modal-input` (already imported)
  - `CredentialPrompt` from `../credential-prompt/credential-prompt`, lazy-loaded via dynamic `import()` (matches `login.ts`'s pattern), whose modal result resolves to `{ username: string; password: string; save: boolean }` or rejects on cancel/dismiss.
- Produces: `switchTo(server: ServerRecord): Promise<void>` — same public signature as before, no callers need to change (`manage-servers.html`'s `(click)="switchTo(server)"` is untouched).

- [ ] **Step 1: Add `select` to the `ServerStoreService` test mock**

  In `manage-servers.spec.ts`, the `ServerStoreService` provider currently only stubs `servers` and `currentServerId`. `switchTo()` already calls `this.serverStoreService.select(server.id)` on success, but no existing test exercises that path, so `select` was never stubbed. Add it now — later steps in this task need it.

  Change:

  ```typescript
  {
    provide: ServerStoreService,
    useValue: {
      servers: signal([]),
      currentServerId: signal(null),
    },
  },
  ```

  to:

  ```typescript
  {
    provide: ServerStoreService,
    useValue: {
      servers: signal([]),
      currentServerId: signal(null),
      select: vi.fn(),
    },
  },
  ```

- [ ] **Step 2: Fix the existing failing-login test's fixture so its intent stays isolated**

  The existing test "should show a danger toast..." uses a `server` object with no `username`/`has_password`. Under the new logic, a server missing those fields will now hit the credential-prompt branch first (which this test isn't about) since `NgbModal.open` is mocked to return `undefined` by default. Give this fixture saved credentials so it continues to exercise only the login-failure path:

  ```typescript
  const server = {
    id: 'srv-1',
    name: 'My Server',
    host: 'localhost',
    port: 8080,
    protocol: 'http',
    username: 'admin',
    has_password: true,
  } as any;
  ```

  (Same test body otherwise — just the two added fields on `server`.)

- [ ] **Step 3: Add a `describe('switchTo credential prompt', ...)` block with failing tests**

  Add this block inside the existing `describe('switchTo', ...)` block in `manage-servers.spec.ts`, after the existing test:

  ```typescript
  describe('credential prompt', () => {
    function makeModalRef(result: Promise<unknown>) {
      const componentInstance: Record<string, unknown> = {};
      return {
        componentInstance,
        result,
        _contentRef: {
          componentRef: {
            setInput: vi.fn((name: string, value: unknown) => {
              componentInstance[name] = value;
            }),
          },
        },
      };
    }

    function server(overrides: Record<string, unknown> = {}) {
      return {
        id: 'srv-1',
        name: 'My Server',
        host: 'localhost',
        port: 8080,
        protocol: 'http',
        username: '',
        has_password: false,
        ...overrides,
      } as any;
    }

    it('opens the credential prompt when there is no session and credentials are missing', async () => {
      const qbServiceMock = TestBed.inject(QbService) as any;
      qbServiceMock.auth.hasCookie.mockResolvedValue(false);

      const ngbModalMock = TestBed.inject(NgbModal) as any;
      const cancelled = Promise.reject(undefined);
      cancelled.catch(() => {});
      const modalRef = makeModalRef(cancelled);
      ngbModalMock.open.mockReturnValue(modalRef);

      await component.switchTo(server());

      expect(ngbModalMock.open).toHaveBeenCalledTimes(1);
      expect(modalRef.componentInstance['serverName']).toBe('My Server');
      expect(modalRef.componentInstance['prefillUsername']).toBe('');
      expect(qbServiceMock.auth.login).not.toHaveBeenCalled();
    });

    it('skips the credential prompt when a session already exists', async () => {
      const qbServiceMock = TestBed.inject(QbService) as any;
      qbServiceMock.auth.hasCookie.mockResolvedValue(true);
      const ngbModalMock = TestBed.inject(NgbModal) as any;
      const serverStoreMock = TestBed.inject(ServerStoreService) as any;

      await component.switchTo(server());

      expect(ngbModalMock.open).not.toHaveBeenCalled();
      expect(qbServiceMock.auth.login).not.toHaveBeenCalled();
      expect(serverStoreMock.select).toHaveBeenCalledWith('srv-1');
    });

    it('skips the credential prompt when credentials are already saved', async () => {
      const qbServiceMock = TestBed.inject(QbService) as any;
      qbServiceMock.auth.hasCookie.mockResolvedValue(false);
      qbServiceMock.auth.login.mockResolvedValue({ loggedIn: true });
      const ngbModalMock = TestBed.inject(NgbModal) as any;

      await component.switchTo(server({ username: 'admin', has_password: true }));

      expect(ngbModalMock.open).not.toHaveBeenCalled();
      expect(qbServiceMock.auth.login).toHaveBeenCalledWith('srv-1', undefined, undefined);
    });

    it('persists credentials and logs in with no runtime args when the prompt saves', async () => {
      const qbServiceMock = TestBed.inject(QbService) as any;
      qbServiceMock.auth.hasCookie.mockResolvedValue(false);
      qbServiceMock.auth.login.mockResolvedValue({ loggedIn: true });

      const ngbModalMock = TestBed.inject(NgbModal) as any;
      const modalRef = makeModalRef(
        Promise.resolve({ username: 'admin', password: 'secret', save: true }),
      );
      ngbModalMock.open.mockReturnValue(modalRef);

      const updateSpy = vi
        .spyOn(window.bitbutler.server, 'update')
        .mockResolvedValue({ updated: true });
      const commandBus = TestBed.inject(CommandBusService) as any;

      await component.switchTo(server());

      expect(updateSpy).toHaveBeenCalledWith({
        id: 'srv-1',
        changes: { username: 'admin', password: 'secret' },
      });
      expect(commandBus.emit).toHaveBeenCalledWith({ type: 'SERVER_UPDATED', id: 'srv-1' });
      expect(qbServiceMock.auth.login).toHaveBeenCalledWith('srv-1', undefined, undefined);
    });

    it('logs in with the entered credentials without persisting when the prompt does not save', async () => {
      const qbServiceMock = TestBed.inject(QbService) as any;
      qbServiceMock.auth.hasCookie.mockResolvedValue(false);
      qbServiceMock.auth.login.mockResolvedValue({ loggedIn: true });

      const ngbModalMock = TestBed.inject(NgbModal) as any;
      const modalRef = makeModalRef(
        Promise.resolve({ username: 'admin', password: 'secret', save: false }),
      );
      ngbModalMock.open.mockReturnValue(modalRef);

      const updateSpy = vi.spyOn(window.bitbutler.server, 'update');

      await component.switchTo(server());

      expect(updateSpy).not.toHaveBeenCalled();
      expect(qbServiceMock.auth.login).toHaveBeenCalledWith('srv-1', 'admin', 'secret');
    });

    it('aborts quietly without a toast when the credential prompt is cancelled', async () => {
      const qbServiceMock = TestBed.inject(QbService) as any;
      qbServiceMock.auth.hasCookie.mockResolvedValue(false);

      const ngbModalMock = TestBed.inject(NgbModal) as any;
      const cancelled = Promise.reject(undefined);
      cancelled.catch(() => {});
      const modalRef = makeModalRef(cancelled);
      ngbModalMock.open.mockReturnValue(modalRef);

      const toastServiceMock = TestBed.inject(ToastService) as any;

      await component.switchTo(server());

      expect(qbServiceMock.auth.login).not.toHaveBeenCalled();
      expect(toastServiceMock.danger).not.toHaveBeenCalled();
      expect(component.connectingId()).toBeNull();
    });
  });
  ```

- [ ] **Step 4: Run the tests to verify the new ones fail and confirm nothing else broke**

  Run: `npm test --workspace=@bitbutler/app -- manage-servers`

  Expected: the 6 new tests in `credential prompt` FAIL (switchTo doesn't open any prompt yet, so `ngbModalMock.open` is never called, `login` is called unconditionally, etc). The pre-existing "should show a danger toast..." test (now with credentials in its fixture) still PASSES.

- [ ] **Step 5: Implement the credential-prompt branch in `switchTo()`**

  Replace the current `switchTo` method in `packages/app/src/app/modals/manage-servers/manage-servers.ts:104-125`:

  ```typescript
  public async switchTo(server: ServerRecord): Promise<void> {
    if (this.busy()) return;
    this.connectingId.set(server.id);
    try {
      const hasSession = await this.qbService.auth.hasCookie(server.id);

      if (!hasSession) {
        let runtimeUsername: string | undefined;
        let runtimePassword: string | undefined;

        if (!server.username || !server.has_password) {
          const { CredentialPrompt } = await import(
            '../credential-prompt/credential-prompt'
          );
          const credModalRef = this.modalService.open(CredentialPrompt);
          setModalInput(credModalRef, 'serverName', server.name);
          setModalInput(credModalRef, 'prefillUsername', server.username);

          let result: { username: string; password: string; save: boolean };
          try {
            result = await credModalRef.result;
          } catch {
            return;
          }

          if (result.save && (result.username || result.password)) {
            await this.serverService.update(server.id, {
              username: result.username,
              password: result.password,
            });
            this.commandBusService.emit({ type: 'SERVER_UPDATED', id: server.id });
          } else {
            runtimeUsername = result.username;
            runtimePassword = result.password;
          }
        }

        const loginRes = await this.qbService.auth.login(
          server.id,
          runtimeUsername,
          runtimePassword,
        );
        if (!loginRes.loggedIn) throw new Error('Login failed');
      }

      this.serverStoreService.select(server.id);
      this.activeModal.dismiss();
    } catch (err) {
      this.toastService.danger(
        `"${server.name || server.host}"`,
        this.translateService.instant(
          'services.menu-bar-command-handler.error.failed-to-connect-title',
        ),
      );
    } finally {
      this.connectingId.set(null);
    }
  }
  ```

  No import changes needed — `ServerService`, `NgbModal`/`modalService`, `setModalInput`, and `CommandBusService` are already imported/injected in this file for other methods (`toggleAutoLogin`, `openEditor`).

- [ ] **Step 6: Run the tests to verify everything passes**

  Run: `npm test --workspace=@bitbutler/app -- manage-servers`

  Expected: all tests in `manage-servers.spec.ts` PASS, including the 6 new ones and the fixed pre-existing one.

- [ ] **Step 7: Lint and format**

  Run: `npm run lint` and `npm run format`

  Expected: zero warnings/errors. If `format` rewrites either file, re-run the tests from Step 6 to confirm nothing broke.

- [ ] **Step 8: Commit**

  ```bash
  git add packages/app/src/app/modals/manage-servers/manage-servers.ts packages/app/src/app/modals/manage-servers/manage-servers.spec.ts
  git commit -m "#255: prompt for credentials in manage servers when none are saved"
  ```

---

### Task 2: Create `CredentialPromptService`

**Files:**

- Create: `packages/app/src/app/services/credential-prompt.service.ts`
- Create: `packages/app/src/app/services/credential-prompt.service.spec.ts`

**Interfaces:**

- Consumes: `NgbModal` (`@ng-bootstrap/ng-bootstrap`), `ServerService.update(id, changes): Promise<boolean>`, `CommandBusService.emit(...)`, `setModalInput` (`../utils/modal-input`), `CredentialPrompt` (lazy-loaded from `../modals/credential-prompt/credential-prompt`), `ServerRecord` (`@bitbutler/shared`).
- Produces (used by Tasks 3 and 4):
  - `needsPrompt(server: Pick<ServerRecord, 'username' | 'has_password'>): boolean`
  - `resolve(server: Pick<ServerRecord, 'id' | 'name' | 'username' | 'has_password'>): Promise<{ username?: string; password?: string } | null>` — `null` means the user cancelled the prompt; callers must abort their connection attempt silently (no toast) in that case. A non-null return with both fields `undefined` means credentials were saved (caller should call `login` with no runtime args, same as before).

This task creates a standalone, isolated new file with no callers yet — Tasks 3 and 4 wire it in.

- [ ] **Step 1: Write the failing tests**

  Create `packages/app/src/app/services/credential-prompt.service.spec.ts`:

  ```typescript
  import { TestBed } from '@angular/core/testing';
  import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
  import { CommandBusService } from './command-bus.service';
  import { CredentialPromptService } from './credential-prompt.service';
  import { ServerService } from './server.service';

  describe('CredentialPromptService', () => {
    let service: CredentialPromptService;
    let modalMock: { open: ReturnType<typeof vi.fn> };
    let serverServiceMock: { update: ReturnType<typeof vi.fn> };
    let commandBusMock: { emit: ReturnType<typeof vi.fn> };

    function makeModalRef(result: Promise<unknown>) {
      const componentInstance: Record<string, unknown> = {};
      return {
        componentInstance,
        result,
        _contentRef: {
          componentRef: {
            setInput: vi.fn((name: string, value: unknown) => {
              componentInstance[name] = value;
            }),
          },
        },
      };
    }

    beforeEach(() => {
      modalMock = { open: vi.fn() };
      serverServiceMock = { update: vi.fn().mockResolvedValue(true) };
      commandBusMock = { emit: vi.fn() };

      TestBed.configureTestingModule({
        providers: [
          { provide: NgbModal, useValue: modalMock },
          { provide: ServerService, useValue: serverServiceMock },
          { provide: CommandBusService, useValue: commandBusMock },
        ],
      });

      service = TestBed.inject(CredentialPromptService);
    });

    describe('needsPrompt', () => {
      it('returns true when username is missing', () => {
        expect(service.needsPrompt({ username: '', has_password: true })).toBe(true);
      });

      it('returns true when has_password is false', () => {
        expect(service.needsPrompt({ username: 'admin', has_password: false })).toBe(true);
      });

      it('returns false when both are present', () => {
        expect(service.needsPrompt({ username: 'admin', has_password: true })).toBe(false);
      });
    });

    describe('resolve', () => {
      const server = { id: 'srv-1', name: 'My Server', username: '', has_password: false };

      it('opens the credential prompt with the server name and prefilled username', async () => {
        const modalRef = makeModalRef(Promise.resolve({ username: '', password: '', save: false }));
        modalMock.open.mockReturnValue(modalRef);

        await service.resolve(server);

        expect(modalRef.componentInstance['serverName']).toBe('My Server');
        expect(modalRef.componentInstance['prefillUsername']).toBe('');
      });

      it('returns null when the prompt is cancelled', async () => {
        const cancelled = Promise.reject(undefined);
        cancelled.catch(() => {});
        modalMock.open.mockReturnValue(makeModalRef(cancelled));

        const result = await service.resolve(server);

        expect(result).toBeNull();
      });

      it('persists credentials and returns an empty object when the prompt saves', async () => {
        modalMock.open.mockReturnValue(
          makeModalRef(Promise.resolve({ username: 'admin', password: 'secret', save: true })),
        );

        const result = await service.resolve(server);

        expect(serverServiceMock.update).toHaveBeenCalledWith('srv-1', {
          username: 'admin',
          password: 'secret',
        });
        expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'SERVER_UPDATED', id: 'srv-1' });
        expect(result).toEqual({});
      });

      it('returns the entered credentials without persisting when the prompt does not save', async () => {
        modalMock.open.mockReturnValue(
          makeModalRef(Promise.resolve({ username: 'admin', password: 'secret', save: false })),
        );

        const result = await service.resolve(server);

        expect(serverServiceMock.update).not.toHaveBeenCalled();
        expect(result).toEqual({ username: 'admin', password: 'secret' });
      });
    });
  });
  ```

- [ ] **Step 2: Run the test file to verify it fails**

  Run: `npm test --workspace=@bitbutler/app -- credential-prompt.service`

  Expected: FAIL — `credential-prompt.service.ts` doesn't exist yet (module not found).

- [ ] **Step 3: Implement `CredentialPromptService`**

  Create `packages/app/src/app/services/credential-prompt.service.ts`:

  ```typescript
  import { Injectable, inject } from '@angular/core';
  import type { ServerRecord } from '@bitbutler/shared';
  import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
  import { setModalInput } from '../utils/modal-input';
  import { CommandBusService } from './command-bus.service';
  import { ServerService } from './server.service';

  export interface ResolvedCredentials {
    username?: string;
    password?: string;
  }

  type PromptableServer = Pick<ServerRecord, 'id' | 'name' | 'username' | 'has_password'>;

  @Injectable({ providedIn: 'root' })
  export class CredentialPromptService {
    private readonly modalService = inject(NgbModal);
    private readonly serverService = inject(ServerService);
    private readonly commandBusService = inject(CommandBusService);

    public needsPrompt(server: Pick<ServerRecord, 'username' | 'has_password'>): boolean {
      return !server.username || !server.has_password;
    }

    // null return means the user cancelled - callers must abort silently.
    public async resolve(server: PromptableServer): Promise<ResolvedCredentials | null> {
      const { CredentialPrompt } = await import('../modals/credential-prompt/credential-prompt');
      const credModalRef = this.modalService.open(CredentialPrompt);
      setModalInput(credModalRef, 'serverName', server.name);
      setModalInput(credModalRef, 'prefillUsername', server.username);

      let result: { username: string; password: string; save: boolean };
      try {
        result = await credModalRef.result;
      } catch {
        return null;
      }

      if (result.save && (result.username || result.password)) {
        await this.serverService.update(server.id, {
          username: result.username,
          password: result.password,
        });
        this.commandBusService.emit({ type: 'SERVER_UPDATED', id: server.id });
        return {};
      }

      return { username: result.username, password: result.password };
    }
  }
  ```

- [ ] **Step 4: Run the test file to verify it passes**

  Run: `npm test --workspace=@bitbutler/app -- credential-prompt.service`

  Expected: PASS, 7/7 tests.

- [ ] **Step 5: Lint and format**

  Run: `npm run lint` and `npm run format`. Expected: zero warnings/errors.

- [ ] **Step 6: Commit**

  ```bash
  git add packages/app/src/app/services/credential-prompt.service.ts packages/app/src/app/services/credential-prompt.service.spec.ts
  git commit -m "#255: add CredentialPromptService"
  ```

---

### Task 3: Refactor `Login.connect()` and `ManageServers.switchTo()` to use `CredentialPromptService`

**Files:**

- Modify: `packages/app/src/app/pages/login/login.ts`
- Modify: `packages/app/src/app/pages/login/login.spec.ts`
- Modify: `packages/app/src/app/modals/manage-servers/manage-servers.ts`
- Modify: `packages/app/src/app/modals/manage-servers/manage-servers.spec.ts` (only if the review in Task 3 finds a test that breaks — see note in Step 3 below; expect no changes needed)

**Interfaces:**

- Consumes: `CredentialPromptService.needsPrompt(...)` and `.resolve(...)` from Task 2 (`../../services/credential-prompt.service` from `login.ts`, `../../services/credential-prompt.service` from `manage-servers.ts`).
- Produces: `Login.connect(): Promise<void>` and `ManageServers.switchTo(server): Promise<void>` keep their existing public signatures — no other files call these directly aside from their own templates, which are unchanged.

- [ ] **Step 1: Replace the inline credential logic in `login.ts`**

  In `packages/app/src/app/pages/login/login.ts`:

  Remove the `ServerService` import and its injection (`private readonly serverService = inject(ServerService);`) — it is no longer used directly by this file once the block below is replaced. Add:

  ```typescript
  import { CredentialPromptService } from '../../services/credential-prompt.service';
  ```

  and the injection:

  ```typescript
  private readonly credentialPromptService = inject(CredentialPromptService);
  ```

  Replace this block inside `connect()`:

  ```typescript
  if (!currentServer.username || !currentServer.has_password) {
    const { CredentialPrompt } = await import('../../modals/credential-prompt/credential-prompt');
    const credModalRef = this.modalService.open(CredentialPrompt);
    setModalInput(credModalRef, 'serverName', currentServer.name);
    setModalInput(credModalRef, 'prefillUsername', currentServer.username);

    try {
      const result = (await credModalRef.result) as {
        username: string;
        password: string;
        save: boolean;
      };

      if (result.save && (result.username || result.password)) {
        await this.serverService.update(currentServer.id, {
          username: result.username,
          password: result.password,
        });
        this.commandBusService.emit({ type: 'SERVER_UPDATED', id: currentServer.id });
      } else {
        runtimeUsername = result.username;
        runtimePassword = result.password;
      }
    } catch {
      return;
    }
  }
  ```

  with:

  ```typescript
  if (this.credentialPromptService.needsPrompt(currentServer)) {
    const resolved = await this.credentialPromptService.resolve(currentServer);
    if (resolved === null) return;
    runtimeUsername = resolved.username;
    runtimePassword = resolved.password;
  }
  ```

  Everything else in `connect()` (the `let runtimeUsername`/`runtimePassword` declarations above this block, and the `AppLoader`/login-call code below it) is unchanged.

- [ ] **Step 2: Add missing-credentials tests to `login.spec.ts`**

  `login.spec.ts`'s existing `describe('connect', ...)` block only ever sets `currentServer` with `username: 'admin', has_password: true` (via its local `setCurrentServer` helper), so the credential-prompt branch has never been exercised by any test in this file. Add this nested block right after the existing tests inside `describe('connect', ...)`:

  ```typescript
  describe('missing credentials', () => {
    function credentialModalRef(result: Promise<unknown>) {
      const componentInstance: Record<string, unknown> = {};
      return {
        componentInstance,
        result,
        _contentRef: {
          componentRef: {
            setInput: vi.fn((name: string, value: unknown) => {
              componentInstance[name] = value;
            }),
          },
        },
      };
    }

    it('opens the credential prompt when username or password is missing', async () => {
      setCurrentServer({ username: '', has_password: false });
      const cancelled = Promise.reject(undefined);
      cancelled.catch(() => {});
      const modalRef = credentialModalRef(cancelled);
      modalMock.open.mockReturnValue(modalRef);

      await component.connect();

      expect(modalMock.open).toHaveBeenCalled();
      expect(modalRef.componentInstance['serverName']).toBe('Local');
      expect(qbServiceMock.login).not.toHaveBeenCalled();
    });

    it('persists credentials and logs in with no runtime args when the prompt saves', async () => {
      setCurrentServer({ username: '', has_password: false });
      qbServiceMock.login.mockResolvedValue({ loggedIn: true });
      modalMock.open.mockReturnValue(
        credentialModalRef(Promise.resolve({ username: 'admin', password: 'secret', save: true })),
      );
      const serverServiceMock = TestBed.inject(ServerService) as any;

      await component.connect();

      expect(serverServiceMock.update).toHaveBeenCalledWith('srv-1', {
        username: 'admin',
        password: 'secret',
      });
      expect(qbServiceMock.login).toHaveBeenCalledWith('srv-1', undefined, undefined);
    });

    it('logs in with the entered credentials without persisting when the prompt does not save', async () => {
      setCurrentServer({ username: '', has_password: false });
      qbServiceMock.login.mockResolvedValue({ loggedIn: true });
      modalMock.open.mockReturnValue(
        credentialModalRef(Promise.resolve({ username: 'admin', password: 'secret', save: false })),
      );
      const serverServiceMock = TestBed.inject(ServerService) as any;

      await component.connect();

      expect(serverServiceMock.update).not.toHaveBeenCalled();
      expect(qbServiceMock.login).toHaveBeenCalledWith('srv-1', 'admin', 'secret');
    });
  });
  ```

  Note: `login.spec.ts` already provides `ServerService` as `{ update: vi.fn().mockResolvedValue(undefined) }` and provides the real `modalMock`/`qbServiceMock` this nested block reuses from the enclosing scope — no new providers needed. `setCurrentServer`'s default fixture uses id `'srv-1'` and name `'Local'` — keep those in the assertions above.

- [ ] **Step 3: Replace the inline credential logic in `manage-servers.ts`**

  In `packages/app/src/app/modals/manage-servers/manage-servers.ts`, add the import and injection:

  ```typescript
  import { CredentialPromptService } from '../../services/credential-prompt.service';
  ```

  ```typescript
  private readonly credentialPromptService = inject(CredentialPromptService);
  ```

  Replace the body of `switchTo` (the whole method) with:

  ```typescript
    public async switchTo(server: ServerRecord): Promise<void> {
      if (this.busy()) return;
      this.connectingId.set(server.id);
      try {
        const hasSession = await this.qbService.auth.hasCookie(server.id);

        if (!hasSession) {
          let runtimeUsername: string | undefined;
          let runtimePassword: string | undefined;

          if (this.credentialPromptService.needsPrompt(server)) {
            const resolved = await this.credentialPromptService.resolve(server);
            if (resolved === null) return;
            runtimeUsername = resolved.username;
            runtimePassword = resolved.password;
          }

          const loginRes = await this.qbService.auth.login(
            server.id,
            runtimeUsername,
            runtimePassword,
          );
          if (!loginRes.loggedIn) throw new Error('Login failed');
        }

        this.serverStoreService.select(server.id);
        this.activeModal.dismiss();
      } catch (err) {
        this.toastService.danger(
          `"${server.name || server.host}"`,
          this.translateService.instant(
            'services.menu-bar-command-handler.error.failed-to-connect-title',
          ),
        );
      } finally {
        this.connectingId.set(null);
      }
    }
  ```

  `setModalInput` stays imported (still used by `openEditor`); `ServerService` stays injected (still used by `toggleAutoLogin`). No import removals needed in this file.

  This should not change `manage-servers.spec.ts`'s existing "credential prompt" tests' behavior: `CredentialPromptService` is `providedIn: 'root'` and internally injects `NgbModal`, `ServerService`, and `CommandBusService` — all three already have test doubles registered in that spec file's `TestBed.configureTestingModule`, so it resolves against the same fakes the tests already assert against. Run the tests in Step 5 to confirm; if any assertion in `manage-servers.spec.ts` unexpectedly fails, that is real information — report it rather than forcing a pass.

- [ ] **Step 4: Run both spec files to verify everything passes**

  Run: `npm test --workspace=@bitbutler/app -- login manage-servers`

  Expected: all tests PASS, including the 3 new tests added to `login.spec.ts` in Step 2.

- [ ] **Step 5: Lint and format**

  Run: `npm run lint` and `npm run format`. Expected: zero warnings/errors. Re-run Step 4's tests if formatting touched either file.

- [ ] **Step 6: Commit**

  ```bash
  git add packages/app/src/app/pages/login/login.ts packages/app/src/app/pages/login/login.spec.ts packages/app/src/app/modals/manage-servers/manage-servers.ts packages/app/src/app/modals/manage-servers/manage-servers.spec.ts
  git commit -m "#255: use CredentialPromptService in login and manage servers"
  ```

---

### Task 4: Prompt for credentials in the menu-bar server-switch handler

**Files:**

- Modify: `packages/app/src/app/services/ui-command-handler.service.ts:465-517` (the `handleServerSwitch` method)
- Modify: `packages/app/src/app/services/ui-command-handler.service.spec.ts`

**Interfaces:**

- Consumes: `CredentialPromptService.needsPrompt(...)` / `.resolve(...)` from Task 2 (`../services/credential-prompt.service`, relative to `ui-command-handler.service.ts`'s own directory: `./credential-prompt.service`).
- Produces: `handleServerSwitch(serverId: string): Promise<void>` stays `private`, reached only via the existing `UI_SERVER_SWITCH` command case (`ui-command-handler.service.ts:416-417`) — unchanged.

There is currently **no test coverage at all** for `handleServerSwitch` / `UI_SERVER_SWITCH` in `ui-command-handler.service.spec.ts` — this task adds the first tests for it alongside the fix.

- [ ] **Step 1: Update the test providers**

  In `ui-command-handler.service.spec.ts`, the `QbService` and `ServerStoreService` mocks are missing pieces `handleServerSwitch` needs. Change:

  ```typescript
  {
    provide: QbService,
    useValue: { torrents: { files: vi.fn().mockResolvedValue([{ name: 'file.mkv' }]) } },
  },
  { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
  ```

  to:

  ```typescript
  {
    provide: QbService,
    useValue: {
      torrents: { files: vi.fn().mockResolvedValue([{ name: 'file.mkv' }]) },
      auth: { hasCookie: vi.fn(), login: vi.fn() },
    },
  },
  {
    provide: ServerStoreService,
    useValue: {
      currentServerId: signal('server-1'),
      servers: signal([]),
      select: vi.fn(),
    },
  },
  ```

- [ ] **Step 2: Write the failing tests**

  Add this block to `ui-command-handler.service.spec.ts`, after the existing `it` blocks (top-level, alongside the other `describe`/`it` blocks — check how the file is organized and place it as a sibling `describe`):

  ```typescript
  describe('UI_SERVER_SWITCH', () => {
    let qbAuthMock: { hasCookie: ReturnType<typeof vi.fn>; login: ReturnType<typeof vi.fn> };
    let serverStoreMock: {
      servers: ReturnType<typeof signal<any[]>>;
      select: ReturnType<typeof vi.fn>;
      currentServerId: ReturnType<typeof signal<string | null>>;
    };
    let toastMock: { danger: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };

    function loaderRef() {
      return { close: vi.fn() };
    }

    function credentialRef(result: Promise<unknown>) {
      const componentInstance: Record<string, unknown> = {};
      return {
        componentInstance,
        result,
        _contentRef: {
          componentRef: {
            setInput: vi.fn((name: string, value: unknown) => {
              componentInstance[name] = value;
            }),
          },
        },
      };
    }

    function setServer(overrides: Record<string, unknown> = {}) {
      serverStoreMock.servers.set([
        {
          id: 'server-1',
          name: 'My Server',
          host: 'localhost',
          port: 8080,
          protocol: 'http',
          username: '',
          has_password: false,
          ...overrides,
        },
      ]);
    }

    beforeEach(() => {
      qbAuthMock = (TestBed.inject(QbService) as any).auth;
      serverStoreMock = TestBed.inject(ServerStoreService) as any;
      toastMock = TestBed.inject(ToastService) as any;
    });

    it('opens the credential prompt when there is no session and credentials are missing', async () => {
      setServer();
      qbAuthMock.hasCookie.mockResolvedValue(false);
      const cancelled = Promise.reject(undefined);
      cancelled.catch(() => {});
      mockModalService.open
        .mockReturnValueOnce(loaderRef())
        .mockReturnValueOnce(credentialRef(cancelled));

      commands$.next({ type: 'UI_SERVER_SWITCH', id: 'server-1' });
      await flushPromises();

      expect(mockModalService.open).toHaveBeenCalledTimes(2);
      expect(qbAuthMock.login).not.toHaveBeenCalled();
    });

    it('skips the credential prompt when a session already exists', async () => {
      setServer();
      qbAuthMock.hasCookie.mockResolvedValue(true);
      mockModalService.open.mockReturnValueOnce(loaderRef());

      commands$.next({ type: 'UI_SERVER_SWITCH', id: 'server-1' });
      await flushPromises();

      expect(mockModalService.open).toHaveBeenCalledTimes(1);
      expect(qbAuthMock.login).not.toHaveBeenCalled();
      expect(serverStoreMock.select).toHaveBeenCalledWith('server-1');
    });

    it('skips the credential prompt when credentials are already saved', async () => {
      setServer({ username: 'admin', has_password: true });
      qbAuthMock.hasCookie.mockResolvedValue(false);
      qbAuthMock.login.mockResolvedValue({ loggedIn: true });
      mockModalService.open.mockReturnValueOnce(loaderRef());

      commands$.next({ type: 'UI_SERVER_SWITCH', id: 'server-1' });
      await flushPromises();

      expect(mockModalService.open).toHaveBeenCalledTimes(1);
      expect(qbAuthMock.login).toHaveBeenCalledWith('server-1', undefined, undefined);
    });

    it('persists credentials and logs in with no runtime args when the prompt saves', async () => {
      setServer();
      qbAuthMock.hasCookie.mockResolvedValue(false);
      qbAuthMock.login.mockResolvedValue({ loggedIn: true });
      const updateSpy = vi
        .spyOn(window.bitbutler.server, 'update')
        .mockResolvedValue({ updated: true });
      mockModalService.open
        .mockReturnValueOnce(loaderRef())
        .mockReturnValueOnce(
          credentialRef(Promise.resolve({ username: 'admin', password: 'secret', save: true })),
        )
        .mockReturnValueOnce(loaderRef());

      commands$.next({ type: 'UI_SERVER_SWITCH', id: 'server-1' });
      await flushPromises();

      expect(updateSpy).toHaveBeenCalledWith({
        id: 'server-1',
        changes: { username: 'admin', password: 'secret' },
      });
      expect(commandBusEmit).toHaveBeenCalledWith({ type: 'SERVER_UPDATED', id: 'server-1' });
      expect(qbAuthMock.login).toHaveBeenCalledWith('server-1', undefined, undefined);
    });

    it('logs in with the entered credentials without persisting when the prompt does not save', async () => {
      setServer();
      qbAuthMock.hasCookie.mockResolvedValue(false);
      qbAuthMock.login.mockResolvedValue({ loggedIn: true });
      const updateSpy = vi.spyOn(window.bitbutler.server, 'update');
      mockModalService.open
        .mockReturnValueOnce(loaderRef())
        .mockReturnValueOnce(
          credentialRef(Promise.resolve({ username: 'admin', password: 'secret', save: false })),
        )
        .mockReturnValueOnce(loaderRef());

      commands$.next({ type: 'UI_SERVER_SWITCH', id: 'server-1' });
      await flushPromises();

      expect(updateSpy).not.toHaveBeenCalled();
      expect(qbAuthMock.login).toHaveBeenCalledWith('server-1', 'admin', 'secret');
    });

    it('aborts quietly without a toast when the credential prompt is cancelled', async () => {
      setServer();
      qbAuthMock.hasCookie.mockResolvedValue(false);
      const cancelled = Promise.reject(undefined);
      cancelled.catch(() => {});
      mockModalService.open
        .mockReturnValueOnce(loaderRef())
        .mockReturnValueOnce(credentialRef(cancelled));

      commands$.next({ type: 'UI_SERVER_SWITCH', id: 'server-1' });
      await flushPromises();

      expect(qbAuthMock.login).not.toHaveBeenCalled();
      expect(toastMock.danger).not.toHaveBeenCalled();
    });

    it('shows a danger toast and falls back to the current server when login fails', async () => {
      setServer({ username: 'admin', has_password: true });
      qbAuthMock.hasCookie.mockResolvedValue(false);
      qbAuthMock.login.mockResolvedValue({ loggedIn: false });
      mockModalService.open.mockReturnValueOnce(loaderRef());

      commands$.next({ type: 'UI_SERVER_SWITCH', id: 'server-1' });
      await flushPromises();

      expect(toastMock.danger).toHaveBeenCalledWith('"My Server"', expect.any(String));
    });
  });
  ```

- [ ] **Step 3: Run the test file to verify the new tests fail**

  Run: `npm test --workspace=@bitbutler/app -- ui-command-handler`

  Expected: the 7 new `UI_SERVER_SWITCH` tests FAIL (current code opens the loader unconditionally with no `close`-returning mock support in some paths, never prompts, and calls `login(serverId)` with no credential args). All pre-existing tests in this file still PASS.

- [ ] **Step 4: Implement the fix in `handleServerSwitch`**

  Add the import and injection to `ui-command-handler.service.ts`:

  ```typescript
  import { CredentialPromptService } from './credential-prompt.service';
  ```

  ```typescript
  private readonly credentialPromptService = inject(CredentialPromptService);
  ```

  Replace the entire `handleServerSwitch` method (`ui-command-handler.service.ts:465-517`) with:

  ```typescript
    private async handleServerSwitch(serverId: string): Promise<void> {
      const server = this.serverStoreService.servers().find((s) => s.id === serverId);
      const name = server?.name || '';

      this.toastService.info(
        this.translateService.instant('services.menu-bar-command-handler.info.switching-server', {
          name,
        }),
      );

      const openLoader = (): NgbModalRef => {
        const modal = this.modalService.open(AppLoader, { size: 'sm', centered: true });
        setModalInput(
          modal,
          'title',
          this.translateService.instant('services.menu-bar-command-handler.app-loader.title'),
        );
        setModalInput(
          modal,
          'message',
          this.translateService.instant('services.menu-bar-command-handler.app-loader.message', {
            name,
          }),
        );
        return modal;
      };

      let appLoaderModal: NgbModalRef | null = openLoader();

      try {
        const hasSession = await this.qbService.auth.hasCookie(serverId);

        if (!hasSession) {
          let runtimeUsername: string | undefined;
          let runtimePassword: string | undefined;

          if (server && this.credentialPromptService.needsPrompt(server)) {
            appLoaderModal.close();
            appLoaderModal = null;

            const resolved = await this.credentialPromptService.resolve(server);
            if (resolved === null) return;
            runtimeUsername = resolved.username;
            runtimePassword = resolved.password;

            appLoaderModal = openLoader();
          }

          const loginRes = await this.qbService.auth.login(
            serverId,
            runtimeUsername,
            runtimePassword,
          );
          if (!loginRes.loggedIn) {
            throw new Error('Login failed');
          }
        }

        this.serverStoreService.select(serverId);
      } catch (err) {
        console.error(
          UiCommandHandlerService.name,
          'handleServerSwitch',
          'Failed to switch servers',
          err,
        );
        this.toastService.danger(
          `"${name}"`,
          this.translateService.instant(
            'services.menu-bar-command-handler.error.failed-to-connect-title',
          ),
        );
        this.serverService.setActive(this.serverStoreService.currentServerId());
      } finally {
        appLoaderModal?.close();
      }
    }
  ```

  This keeps the loader's behavior identical to before when no prompt is needed (opened immediately, closed once in `finally`). When a prompt is needed, the loader is closed before the prompt opens (so the two modals never stack) and reopened afterward for the actual login call; on cancel, `appLoaderModal` is `null` so `finally`'s `appLoaderModal?.close()` is a no-op rather than a double-close.

- [ ] **Step 5: Run the test file to verify everything passes**

  Run: `npm test --workspace=@bitbutler/app -- ui-command-handler`

  Expected: all tests PASS, including the 7 new ones and every pre-existing test in this file.

- [ ] **Step 6: Lint and format**

  Run: `npm run lint` and `npm run format`. Expected: zero warnings/errors. Re-run Step 5 if formatting touched the file.

- [ ] **Step 7: Commit**

  ```bash
  git add packages/app/src/app/services/ui-command-handler.service.ts packages/app/src/app/services/ui-command-handler.service.spec.ts
  git commit -m "#255: prompt for credentials in menu-bar server switch when none are saved"
  ```

---

## Post-implementation cleanup (not a task — do after Task 4 is reviewed and accepted)

Per `CLAUDE.md`, before opening the PR:

- Remove the `docs/superpowers` folder (spec + this plan) in its own commit: `#255: removed spec and plan`.
- Read `.github/pull_request_template.md` and use it verbatim as the `--body` structure for `gh pr create`.
- PR body must include `Fixes #255`. PR title must be a clean description with no issue ID.
