# Manage Servers Credential Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Manage Servers modal's "connect" action prompt for credentials (instead of failing silently) when a server has no saved username/password and no active session.

**Architecture:** `ManageServers.switchTo()` gains the same missing-credentials branch that `Login.connect()` already has: when there's no session and the server lacks a saved username or password, lazy-load and open `CredentialPrompt`, then either persist the entered credentials (and let login read them from the DB) or pass them through for a one-off login. Logic is inlined directly in `switchTo()` — no shared helper (per design decision).

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

## Post-implementation cleanup (not a task — do after Task 1 is reviewed and accepted)

Per `CLAUDE.md`, before opening the PR:

- Remove the `docs/superpowers` folder (spec + this plan) in its own commit: `#255: removed spec and plan`.
- Read `.github/pull_request_template.md` and use it verbatim as the `--body` structure for `gh pr create`.
- PR body must include `Fixes #255`. PR title must be a clean description with no issue ID.
