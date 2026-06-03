# Optional Server Credentials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make username and password optional in server management, showing a credential prompt modal on Connect when either is missing, with an option to save credentials to the server record.

**Architecture:** DB schema migrated to allow nullable password; Electron `qbLogin` IPC extended to accept runtime credentials; Angular `connect()` flow checks stored credentials and opens `CredentialPrompt` modal before login when needed.

**Tech Stack:** better-sqlite3 (Electron DB), Vitest (Electron tests), Angular 20 signals/zoneless, NgbModal (Bootstrap modal), Reactive Forms, @ngx-translate

---

## File Map

| File                                                                                 | Action | Purpose                                                            |
| ------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------ |
| `packages/electron/src/db.ts`                                                        | Modify | DB migration: nullable password, recreate table                    |
| `packages/electron/src/ipc/server.ts`                                                | Modify | encryptPassword returns null, relax username, fix has_password SQL |
| `packages/electron/src/ipc/server.spec.ts`                                           | Modify | Update/add tests for null password behavior                        |
| `packages/electron/src/ipc/qbittorrent.ts`                                           | Modify | decryptPassword handles null, qbLogin accepts runtime credentials  |
| `packages/electron/src/ipc/qbittorrent.spec.ts`                                      | Modify | Add tests for runtime credential override                          |
| `packages/shared/src/models/server.model.ts`                                         | Modify | username/password optional in NewServer                            |
| `packages/shared/src/ipc.types.ts`                                                   | Modify | Add BitButlerQbLoginPayload, update qb.login signature             |
| `packages/electron/src/preload.ts`                                                   | Modify | Pass full payload through qb.login                                 |
| `packages/app/src/app/services/qb.service.ts`                                        | Modify | login() accepts optional username/password                         |
| `packages/app/src/app/components/modals/server-editor/server-editor.ts`              | Modify | Remove Validators.required from username and password              |
| `packages/app/src/app/components/modals/server-editor/server-editor.html`            | Modify | Add "(optional)" hint to username/password labels                  |
| `packages/app/src/app/components/modals/credential-prompt/credential-prompt.ts`      | Create | New modal component                                                |
| `packages/app/src/app/components/modals/credential-prompt/credential-prompt.html`    | Create | Modal template                                                     |
| `packages/app/src/app/components/modals/credential-prompt/credential-prompt.scss`    | Create | Modal styles (empty)                                               |
| `packages/app/src/app/components/modals/credential-prompt/credential-prompt.spec.ts` | Create | Component tests                                                    |
| `packages/app/src/app/pages/login/login.ts`                                          | Modify | Pre-login credential guard in connect()                            |
| `public/i18n/us.json`                                                                | Modify | Add credential-prompt keys, update username/password labels        |
| `public/i18n/hu.json`                                                                | Modify | Same keys in Hungarian                                             |

---

### Task 1: DB Migration

**Files:**

- Modify: `packages/electron/src/db.ts`

The `servers` table currently has `password BLOB NOT NULL`. SQLite cannot drop NOT NULL constraints, so the migration recreates the table. The guard checks `PRAGMA table_info` before running to be idempotent.

- [ ] **Step 1: Add the migration block to db.ts**

In `packages/electron/src/db.ts`, add this block after the existing `CREATE TABLE IF NOT EXISTS servers` and index statements (around line 34, after the `uq_servers_auto_login` index creation):

```typescript
// Migrate: make password nullable (allow servers without stored credentials)
interface ColInfo {
  name: string;
  notnull: number;
}
const cols = db.pragma('table_info(servers)') as ColInfo[];
const pwCol = cols.find((c) => c.name === 'password');
if (pwCol?.notnull === 1) {
  db.transaction(() => {
    db.exec(`
      CREATE TABLE servers_new (
        id           TEXT PRIMARY KEY,
        name         TEXT NOT NULL,
        host         TEXT NOT NULL,
        protocol     TEXT NOT NULL CHECK (protocol IN ('http','https')),
        port         INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
        username     TEXT NOT NULL DEFAULT '',
        password     BLOB,
        auto_login   INTEGER NOT NULL DEFAULT 0 CHECK (auto_login IN (0,1)),
        created_at   TEXT NOT NULL
      )
    `);
    db.exec(`INSERT INTO servers_new SELECT * FROM servers`);
    db.exec(`DROP TABLE servers`);
    db.exec(`ALTER TABLE servers_new RENAME TO servers`);
  })();
  db.exec(`CREATE INDEX IF NOT EXISTS idx_servers_auto_login ON servers(auto_login)`);
  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_servers_auto_login ON servers(auto_login) WHERE auto_login = 1`,
  );
}
```

- [ ] **Step 2: Build Electron to verify no TypeScript errors**

```bash
npm run build:electron
```

Expected: exits 0 with no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/electron/src/db.ts
git commit -m "#122: migrate servers table to allow nullable password"
```

---

### Task 2: Update Shared Types

**Files:**

- Modify: `packages/shared/src/models/server.model.ts`
- Modify: `packages/shared/src/ipc.types.ts`

- [ ] **Step 1: Make username and password optional in NewServer**

In `packages/shared/src/models/server.model.ts`, change:

```typescript
export interface NewServer {
  id?: string;
  name: string;
  host: string;
  protocol: ServerProtocol;
  port: number;
  username?: string;
  password?: string;
  auto_login?: boolean;
}
```

- [ ] **Step 2: Add BitButlerQbLoginPayload and update qb.login signature**

In `packages/shared/src/ipc.types.ts`, add after the existing `BitButlerServerIdPayload` line:

```typescript
export type BitButlerQbLoginPayload = { id: string; username?: string; password?: string };
```

Then change the `qb.login` signature in `BitButlerAPI`:

```typescript
qb: {
  login(payload: BitButlerQbLoginPayload): Promise<{ loggedIn: boolean }>;
  // ...rest unchanged
```

- [ ] **Step 3: Build to verify no errors across workspaces**

```bash
npm run build:electron
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/models/server.model.ts packages/shared/src/ipc.types.ts
git commit -m "#122: make username/password optional in NewServer, add BitButlerQbLoginPayload"
```

---

### Task 3: Electron server.ts — encryptPassword, username, has_password SQL

**Files:**

- Modify: `packages/electron/src/ipc/server.ts`
- Modify: `packages/electron/src/ipc/server.spec.ts`

- [ ] **Step 1: Update server.spec.ts — remove "throws when password is empty" and add null-password tests**

In `packages/electron/src/ipc/server.spec.ts`, within the `describe('server:add IPC handler – validation', ...)` block:

Remove (delete entirely):

```typescript
it('throws when password is empty', async () => {
  const handler = await getAddHandler();
  await expect(
    handler(null, {
      name: 'L',
      host: 'localhost',
      port: 8080,
      username: 'u',
      password: '',
      protocol: 'http',
    }),
  ).rejects.toThrow("Field 'password' is required.");
});
```

Replace with:

```typescript
it('succeeds with empty password (stores null)', async () => {
  const handler = await getAddHandler();
  const result = (await handler(null, {
    name: 'L',
    host: 'localhost',
    port: 8080,
    username: 'u',
    password: '',
    protocol: 'http',
  })) as { id: string };
  expect(typeof result.id).toBe('string');
  expect(mockEncryptString).not.toHaveBeenCalled();
});

it('succeeds without password field (stores null)', async () => {
  const handler = await getAddHandler();
  const result = (await handler(null, {
    name: 'L',
    host: 'localhost',
    port: 8080,
    username: 'u',
    protocol: 'http',
  })) as { id: string };
  expect(typeof result.id).toBe('string');
  expect(mockEncryptString).not.toHaveBeenCalled();
});

it('succeeds with empty username', async () => {
  const handler = await getAddHandler();
  const result = (await handler(null, {
    name: 'L',
    host: 'localhost',
    port: 8080,
    username: '',
    password: 'secret',
    protocol: 'http',
  })) as { id: string };
  expect(typeof result.id).toBe('string');
});
```

Also update the `serverList` test that checks `has_password` to confirm it maps `0` correctly (the existing test already has `has_password: 0` rows, but the mapping is now from DB — the mock already returns the value we give it so no change needed there).

- [ ] **Step 2: Run tests to confirm failures**

```bash
npm test -- --filter packages/electron
```

Expected: the new "succeeds with empty password" test fails with `"Field 'password' is required."` or similar.

- [ ] **Step 3: Update encryptPassword to return null for empty input**

In `packages/electron/src/ipc/server.ts`, replace the `encryptPassword` function:

```typescript
function encryptPassword(plain: unknown): Buffer | null {
  if (!plain || (typeof plain === 'string' && plain.length === 0)) return null;
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption is not available on this system (safeStorage).');
  }
  return safeStorage.encryptString(plain as string);
}
```

- [ ] **Step 4: Remove requirePasswordString and relax username in normalizeNewServer**

In `packages/electron/src/ipc/server.ts`, delete the `requirePasswordString` function entirely:

```typescript
// DELETE this function:
function requirePasswordString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Field '${field}' is required.`);
  }
  return value;
}
```

In `normalizeNewServer`, replace the username and password lines:

```typescript
// BEFORE:
const username = requireString(i['username'] ?? '', 'username');
const password = requirePasswordString(i['password'], 'password');

// AFTER:
const username = typeof i['username'] === 'string' ? i['username'] : '';
const password = typeof i['password'] === 'string' ? i['password'] : '';
```

- [ ] **Step 5: Fix has_password SQL in stmtList, stmtGetById, and stmtGetByHost**

In `packages/electron/src/ipc/server.ts`, update all three prepared statements that contain `1 as has_password`:

```typescript
// stmtList — replace:
//   1 as has_password
// with:
//   CASE WHEN password IS NOT NULL THEN 1 ELSE 0 END as has_password
```

Apply the same change to `stmtGetById` and `stmtGetByHost`. Each becomes:

```sql
SELECT
  id, name, host, protocol, port, username,
  auto_login,
  created_at,
  CASE WHEN password IS NOT NULL THEN 1 ELSE 0 END as has_password
FROM servers
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
npm test -- --filter packages/electron
```

Expected: all tests pass, including the three new ones.

- [ ] **Step 7: Commit**

```bash
git add packages/electron/src/ipc/server.ts packages/electron/src/ipc/server.spec.ts
git commit -m "#122: allow null password in server IPC, fix has_password SQL"
```

---

### Task 4: Electron qbittorrent.ts — runtime credential override

**Files:**

- Modify: `packages/electron/src/ipc/qbittorrent.ts`
- Modify: `packages/electron/src/ipc/qbittorrent.spec.ts`

- [ ] **Step 1: Add failing tests to qbittorrent.spec.ts**

In `packages/electron/src/ipc/qbittorrent.spec.ts`, add a new `describe` block after the existing `getCookieJar` describe:

```typescript
describe('qb:login IPC handler', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function setup() {
    const mod = await import('./qbittorrent.js');
    mod.registerQbIpcHandlers();
    return ipcHandlers.get('qb:login')!;
  }

  it('uses stored credentials when no runtime credentials provided', async () => {
    mockGet.mockReturnValue({
      id: 'srv-1',
      name: 'Local',
      host: 'localhost',
      protocol: 'http',
      port: 8080,
      username: 'admin',
      password: Buffer.from('stored-pass'),
    });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'Ok.',
      headers: { get: () => 'SID=abc123', getSetCookie: undefined },
    });
    globalThis.fetch = mockFetch;
    const handler = await setup();
    await handler(null, { id: 'srv-1' });
    const body = mockFetch.mock.calls[0][1].body.toString();
    expect(body).toContain('username=admin');
    expect(body).toContain('password=stored-pass');
  });

  it('uses runtime username and password when provided', async () => {
    mockGet.mockReturnValue({
      id: 'srv-1',
      name: 'Local',
      host: 'localhost',
      protocol: 'http',
      port: 8080,
      username: 'admin',
      password: Buffer.from('stored-pass'),
    });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'Ok.',
      headers: { get: () => 'SID=abc123', getSetCookie: undefined },
    });
    globalThis.fetch = mockFetch;
    const handler = await setup();
    await handler(null, { id: 'srv-1', username: 'runtime-user', password: 'runtime-pass' });
    const body = mockFetch.mock.calls[0][1].body.toString();
    expect(body).toContain('username=runtime-user');
    expect(body).toContain('password=runtime-pass');
  });

  it('uses empty password when server has null password and no runtime password', async () => {
    mockGet.mockReturnValue({
      id: 'srv-1',
      name: 'Local',
      host: 'localhost',
      protocol: 'http',
      port: 8080,
      username: 'admin',
      password: null,
    });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'Ok.',
      headers: { get: () => 'SID=abc123', getSetCookie: undefined },
    });
    globalThis.fetch = mockFetch;
    const handler = await setup();
    await handler(null, { id: 'srv-1' });
    const body = mockFetch.mock.calls[0][1].body.toString();
    expect(body).toContain('password=');
  });
});
```

- [ ] **Step 2: Run tests to confirm failures**

```bash
npm test -- --filter packages/electron
```

Expected: the new qb:login tests fail.

- [ ] **Step 3: Update ServerRow interface in qbittorrent.ts to allow null password**

In `packages/electron/src/ipc/qbittorrent.ts`, change the `ServerRow` interface (around line 16):

```typescript
interface ServerRow {
  id: string;
  name: string;
  host: string;
  protocol: string;
  port: number;
  username: string;
  password: Buffer | null;
  auto_login: number;
  created_at: string;
}
```

- [ ] **Step 4: Update decryptPassword to accept null**

In `packages/electron/src/ipc/qbittorrent.ts`, replace the `decryptPassword` function (around line 265):

```typescript
function decryptPassword(passwordBlob: Buffer | Uint8Array | null): string {
  if (!passwordBlob) return '';
  const buf = Buffer.isBuffer(passwordBlob) ? passwordBlob : Buffer.from(passwordBlob);
  return safeStorage.decryptString(buf);
}
```

- [ ] **Step 5: Update qbLogin to accept and use runtime credentials**

In `packages/electron/src/ipc/qbittorrent.ts`, replace the `qbLogin` function (around line 118):

```typescript
async function qbLogin(payload: unknown): Promise<{ loggedIn: boolean }> {
  const p = payload as Record<string, unknown>;
  const id = requireString(p?.id, 'id');
  const runtimeUsername = typeof p?.username === 'string' ? p.username : undefined;
  const runtimePassword = typeof p?.password === 'string' ? p.password : undefined;

  const server = stmtGetByIdFull.get(id);
  if (!server) throw new Error('Server not found.');

  const username = runtimeUsername ?? server.username;
  const password = runtimePassword ?? decryptPassword(server.password);
  const url = buildBaseUrl(server) + '/api/v2/auth/login';

  const body = new URLSearchParams({ username, password });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: buildBaseUrl(server),
    },
    body,
  });

  const text = await res.text();
  if (!res.ok || (res.status !== 204 && !/^Ok\./i.test(text.trim()))) {
    throw new Error('Login failed. Check username/password and WebUI settings.');
  }

  const cookie = extractSidCookie(res);
  if (!cookie) {
    throw new Error(
      'Login succeeded but SID cookie was not returned (check proxy/HTTPS/WebUI config).',
    );
  }

  cookieJar.set(id, cookie);
  ipcMain.emit('server:set-active', null, id);
  rebuildMenu();
  rebuildTrayMenu();
  return { loggedIn: true };
}
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
npm test -- --filter packages/electron
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/electron/src/ipc/qbittorrent.ts packages/electron/src/ipc/qbittorrent.spec.ts
git commit -m "#122: extend qbLogin to accept runtime credentials, handle null stored password"
```

---

### Task 5: Preload.ts — pass full login payload

**Files:**

- Modify: `packages/electron/src/preload.ts`

- [ ] **Step 1: Update qb.login to forward the full payload**

In `packages/electron/src/preload.ts`, change the `qb.login` line (around line 57):

```typescript
// BEFORE:
login: ({ id }) => ipcRenderer.invoke('qb:login', { id }),

// AFTER:
login: ({ id, username, password }) => ipcRenderer.invoke('qb:login', { id, username, password }),
```

- [ ] **Step 2: Build to verify no TypeScript errors**

```bash
npm run build:electron
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add packages/electron/src/preload.ts
git commit -m "#122: forward username/password through preload qb.login"
```

---

### Task 6: QbService — accept optional credentials in login()

**Files:**

- Modify: `packages/app/src/app/services/qb.service.ts`

- [ ] **Step 1: Update login() signature to accept optional credentials**

In `packages/app/src/app/services/qb.service.ts`, replace the `login` method (around line 51):

```typescript
login(serverId: string, username?: string, password?: string): Promise<QbLoginResponse> {
  this.clearRunApiCache(serverId);
  return window.bitbutler.qb.login({ id: serverId, username, password });
}
```

Also remove the now-unused local `ServerIdPayload` type at the top of the file (line 21: `type ServerIdPayload = { id: string };`) since we no longer use `satisfies ServerIdPayload`.

- [ ] **Step 2: Build Angular to verify no type errors**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add packages/app/src/app/services/qb.service.ts
git commit -m "#122: extend QbService.login to accept optional runtime credentials"
```

---

### Task 7: Server Editor — remove required validators and update i18n

**Files:**

- Modify: `packages/app/src/app/components/modals/server-editor/server-editor.ts`
- Modify: `packages/app/src/app/components/modals/server-editor/server-editor.html`
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

- [ ] **Step 1: Remove Validators.required from username and password in server-editor.ts**

In `packages/app/src/app/components/modals/server-editor/server-editor.ts`, change the form definition (around line 75):

```typescript
username: new FormControl<string>('', { nonNullable: true }),
password: new FormControl<string>('', { nonNullable: true }),
```

Also remove the edit-mode override that cleared the password validator — it's no longer needed. In `ngOnInit`, remove these lines (around line 127):

```typescript
// DELETE these three lines:
this.editorForm.get('password')?.clearValidators();
this.editorForm.get('password')?.updateValueAndValidity();
```

- [ ] **Step 2: Update i18n keys for username and password labels (us.json)**

In `public/i18n/us.json`, find the server-editor section (around line 216) and update:

```json
"username": "Username (optional)",
"password": "Password (optional)"
```

Also add the credential-prompt modal section. Find the `"modals"` object and add after `"server-editor"`:

```json
"credential-prompt": {
  "title": "Connect to {{name}}",
  "save-credentials": "Save credentials for this server"
}
```

- [ ] **Step 3: Update i18n keys in hu.json**

In `public/i18n/hu.json`, apply the same changes to the matching paths:

```json
"username": "Felhasználónév (opcionális)",
"password": "Jelszó (opcionális)"
```

And:

```json
"credential-prompt": {
  "title": "Csatlakozás: {{name}}",
  "save-credentials": "Hitelesítő adatok mentése ehhez a szerverhez"
}
```

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Expected: 0 warnings, 0 errors.

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/components/modals/server-editor/server-editor.ts public/i18n/us.json public/i18n/hu.json
git commit -m "#122: make server editor credentials optional, update i18n labels"
```

---

### Task 8: Credential Prompt Modal — new component

**Files:**

- Create: `packages/app/src/app/components/modals/credential-prompt/credential-prompt.ts`
- Create: `packages/app/src/app/components/modals/credential-prompt/credential-prompt.html`
- Create: `packages/app/src/app/components/modals/credential-prompt/credential-prompt.scss`
- Create: `packages/app/src/app/components/modals/credential-prompt/credential-prompt.spec.ts`

- [ ] **Step 1: Write the failing spec**

Create `packages/app/src/app/components/modals/credential-prompt/credential-prompt.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { CredentialPrompt } from './credential-prompt';

describe('CredentialPrompt', () => {
  let component: CredentialPrompt;
  let fixture: ComponentFixture<CredentialPrompt>;
  let mockActiveModal: Partial<NgbActiveModal>;

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CredentialPrompt, TranslateModule.forRoot()],
      providers: [{ provide: NgbActiveModal, useValue: mockActiveModal }],
    }).compileComponents();

    fixture = TestBed.createComponent(CredentialPrompt);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('serverName', 'My Server');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('pre-fills username when prefillUsername input is set', () => {
    fixture.componentRef.setInput('prefillUsername', 'admin');
    fixture.detectChanges();
    expect(component.credentialForm.get('username')?.value).toBe('admin');
  });

  it('connect() closes modal with username, password, and save=false when saveCredentials is unchecked', () => {
    component.credentialForm.patchValue({
      username: 'user1',
      password: 'pass1',
      saveCredentials: false,
    });
    component.connect();
    expect(mockActiveModal.close).toHaveBeenCalledWith({
      username: 'user1',
      password: 'pass1',
      save: false,
    });
  });

  it('connect() closes modal with save=true when saveCredentials is checked and fields are non-empty', () => {
    component.credentialForm.patchValue({
      username: 'user1',
      password: 'pass1',
      saveCredentials: true,
    });
    component.connect();
    expect(mockActiveModal.close).toHaveBeenCalledWith({
      username: 'user1',
      password: 'pass1',
      save: true,
    });
  });

  it('connect() closes with save=false when saveCredentials is checked but both fields are empty', () => {
    component.credentialForm.patchValue({ username: '', password: '', saveCredentials: true });
    component.connect();
    expect(mockActiveModal.close).toHaveBeenCalledWith({ username: '', password: '', save: false });
  });

  it('cancel() dismisses the modal', () => {
    component.cancel();
    expect(mockActiveModal.dismiss).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the spec to confirm it fails (component not found)**

```bash
npm test -- --filter packages/app
```

Expected: fails with "Cannot find module './credential-prompt'".

- [ ] **Step 3: Create the component TypeScript file**

Create `packages/app/src/app/components/modals/credential-prompt/credential-prompt.ts`:

```typescript
import { ChangeDetectionStrategy, Component, OnInit, inject, input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';

@Component({
  selector: 'app-credential-prompt',
  imports: [ReactiveFormsModule, TranslatePipe, AutofocusDirective],
  templateUrl: './credential-prompt.html',
  styleUrl: './credential-prompt.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CredentialPrompt implements OnInit {
  private readonly activeModal = inject(NgbActiveModal);

  readonly serverName = input.required<string>();
  readonly prefillUsername = input<string>('');

  public credentialForm = new FormGroup({
    username: new FormControl<string>('', { nonNullable: true }),
    password: new FormControl<string>('', { nonNullable: true }),
    saveCredentials: new FormControl<boolean>(false, { nonNullable: true }),
  });

  public ngOnInit(): void {
    const pre = this.prefillUsername();
    if (pre) {
      this.credentialForm.get('username')?.patchValue(pre);
    }
  }

  public connect(): void {
    const { username, password, saveCredentials } = this.credentialForm.getRawValue();
    const save = saveCredentials && (!!username || !!password);
    this.activeModal.close({ username, password, save });
  }

  public cancel(): void {
    this.activeModal.dismiss();
  }
}
```

- [ ] **Step 4: Create the template**

Create `packages/app/src/app/components/modals/credential-prompt/credential-prompt.html`:

```html
<div class="modal-header">
  <h4 class="modal-title">
    {{ 'components.modals.credential-prompt.title' | translate: { name: serverName() } }}
  </h4>
  <button type="button" class="btn-close" aria-label="Close" (click)="cancel()"></button>
</div>
<div class="modal-body">
  <form [formGroup]="credentialForm" (submit)="connect()">
    <div class="container-fluid">
      <div class="row">
        <div class="col-12 mb-3">
          <div class="form-floating">
            <input
              autofocus
              type="text"
              class="form-control"
              id="credential-username"
              placeholder="Username"
              formControlName="username"
            />
            <label for="credential-username"
              >{{ 'components.modals.server-editor.editor-form.username' | translate }}</label
            >
          </div>
        </div>
        <div class="col-12 mb-3">
          <div class="form-floating">
            <input
              type="password"
              class="form-control"
              id="credential-password"
              placeholder="Password"
              formControlName="password"
            />
            <label for="credential-password"
              >{{ 'components.modals.server-editor.editor-form.password' | translate }}</label
            >
          </div>
        </div>
        <div class="col-12">
          <div class="form-check">
            <input
              class="form-check-input"
              type="checkbox"
              id="save-credentials"
              formControlName="saveCredentials"
            />
            <label class="form-check-label" for="save-credentials"
              >{{ 'components.modals.credential-prompt.save-credentials' | translate }}</label
            >
          </div>
        </div>
      </div>
    </div>
    <button type="submit" hidden></button>
  </form>
</div>
<div class="modal-footer">
  <button type="button" class="btn btn-secondary" (click)="connect()">
    {{ 'general.button.connect' | translate }}
  </button>
  <button type="button" class="btn btn-link" (click)="cancel()">
    {{ 'general.button.cancel' | translate }}
  </button>
</div>
```

- [ ] **Step 5: Create the empty SCSS file**

Create `packages/app/src/app/components/modals/credential-prompt/credential-prompt.scss`:

```scss

```

- [ ] **Step 6: Add "connect" to general.button i18n keys**

In `public/i18n/us.json`, find `"general"` → `"button"` and add:

```json
"connect": "Connect"
```

In `public/i18n/hu.json`, add:

```json
"connect": "Csatlakozás"
```

- [ ] **Step 7: Run tests to confirm they pass**

```bash
npm test -- --filter packages/app
```

Expected: all CredentialPrompt tests pass.

- [ ] **Step 8: Run lint**

```bash
npm run lint
```

Expected: 0 warnings.

- [ ] **Step 9: Commit**

```bash
git add packages/app/src/app/components/modals/credential-prompt/ public/i18n/us.json public/i18n/hu.json
git commit -m "#122: add CredentialPrompt modal component"
```

---

### Task 9: Login Page — pre-login credential guard in connect()

**Files:**

- Modify: `packages/app/src/app/pages/login/login.ts`

- [ ] **Step 1: Import CredentialPrompt in login.ts**

In `packages/app/src/app/pages/login/login.ts`, add to imports:

```typescript
import { CredentialPrompt } from '../../components/modals/credential-prompt/credential-prompt';
```

- [ ] **Step 2: Replace connect() with the async guarded version**

In `packages/app/src/app/pages/login/login.ts`, replace the entire `connect()` method:

```typescript
public async connect(): Promise<void> {
  const currentServer = this.serverStoreService.currentServer();
  if (!currentServer) return;

  let runtimeUsername: string | undefined;
  let runtimePassword: string | undefined;

  if (!currentServer.username || !currentServer.has_password) {
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

  this.loading.set(true);
  const loadingModalRef = this.modalService.open(AppLoader, {
    size: 'sm',
    backdrop: 'static',
    keyboard: false,
  });
  setModalInput(
    loadingModalRef,
    'title',
    this.translateService.instant('pages.login.connecting'),
  );
  setModalInput(
    loadingModalRef,
    'message',
    `${currentServer.protocol}://${currentServer.host}:${currentServer.port}`,
  );

  this.qbittorrentService
    .login(currentServer.id, runtimeUsername, runtimePassword)
    .then(async (response) => {
      if (!response.loggedIn) return;
      this.serverStoreService.clearAutoLoginSuppression();
      await this.windowService.setOpenFilesEnabled(true);
      loadingModalRef.close();
      this.router.navigate(['/pages/main']);
    })
    .catch((error) => {
      loadingModalRef.close();
      this.toastService.danger(
        error.message,
        this.translateService.instant('pages.login.error.connection-failed'),
      );
    })
    .finally(() => this.loading.set(false));
}
```

- [ ] **Step 3: Update the auto-login call in ngOnInit to void the promise**

In `ngOnInit`, find:

```typescript
if (autoLoginServer && !isLogoutRedirect) {
  this.connect();
}
```

Change to:

```typescript
if (autoLoginServer && !isLogoutRedirect) {
  void this.connect();
}
```

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Expected: 0 warnings.

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: all tests pass across all workspaces.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/pages/login/login.ts
git commit -m "#122: add credential prompt guard to login connect() flow"
```

---

### Task 10: Final verification

- [ ] **Step 1: Run full lint and test suite**

```bash
npm run lint && npm test
```

Expected: 0 lint warnings, all tests pass.

- [ ] **Step 2: Build full UI to catch any remaining type errors**

```bash
npm run build:ui
```

Expected: exits 0.
