# Optional Server Credentials with Connect-Time Credential Prompt

**Date:** 2026-06-03
**Issue:** #122
**Branch:** `122-optional-server-credentials`

## Overview

Username and password are currently required fields when saving a server. This design makes both optional. When a user clicks Connect and either credential is missing from the stored server record, a credential prompt modal is shown before the login attempt. The modal offers a "Save credentials" checkbox to optionally persist the entered credentials to the server record.

---

## 1. DB Migration

**File:** `packages/electron/src/db.ts`

The `servers` table currently has `password BLOB NOT NULL` and `username TEXT NOT NULL`. SQLite does not support dropping NOT NULL constraints via `ALTER TABLE`, so the migration recreates the table.

Migration guard: read `PRAGMA table_info(servers)` and check whether `password.notnull = 1`. If true, run the migration; otherwise skip (already migrated).

Schema changes:

- `password BLOB` — nullable; NULL means no stored password
- `username TEXT NOT NULL DEFAULT ''` — NOT NULL kept, empty string is the "not set" value

Migration steps (inside a transaction):

1. Create `servers_new` with the new schema
2. `INSERT INTO servers_new SELECT * FROM servers`
3. `DROP TABLE servers`
4. `ALTER TABLE servers_new RENAME TO servers`
5. Recreate `idx_servers_auto_login` and `uq_servers_auto_login`

`has_password` in `stmtList` and `stmtGetById` changes from the hardcoded `1 as has_password` to:

```sql
CASE WHEN password IS NOT NULL THEN 1 ELSE 0 END as has_password
```

---

## 2. Electron IPC - server.ts

**File:** `packages/electron/src/ipc/server.ts`

- `encryptPassword`: returns `null` when input is empty/falsy instead of throwing; return type changes to `Buffer | null`
- `requirePasswordString` is removed; `normalizeNewServer` and `normalizeUpdate` treat a missing/empty password as `null`
- Username validation is relaxed to allow empty string (removed `requireString` enforcement for the `username` field; it defaults to `''`)
- `stmtInsert` and `stmtUpdate` already handle `NULL` via COALESCE - no SQL changes needed beyond the schema migration

---

## 3. Electron IPC - qbittorrent.ts

**File:** `packages/electron/src/ipc/qbittorrent.ts`

`qbLogin` payload is extended to accept optional runtime credentials:

```typescript
{ id: string; username?: string; password?: string }
```

Resolution order for credentials used in the login POST:

1. If runtime `username` is provided, use it; otherwise use `server.username`
2. If runtime `password` is provided, use it; otherwise decrypt `server.password` if non-null; otherwise use `''`

`decryptPassword` is updated to accept `Buffer | null` and return `''` for null input.

---

## 4. Shared Types

**File:** `packages/shared/src/models/server.model.ts`

```typescript
export interface NewServer {
  id?: string;
  name: string;
  host: string;
  protocol: ServerProtocol;
  port: number;
  username?: string; // was required
  password?: string; // was required
  auto_login?: boolean;
}
```

`ServerRecord` is unchanged - `username: string` (empty string when not set), `has_password: boolean` (now accurate).

**File:** `packages/shared/src/ipc.types.ts`

New type:

```typescript
export type BitButlerQbLoginPayload = { id: string; username?: string; password?: string };
```

`qb.login` signature changes from `(payload: BitButlerServerIdPayload)` to `(payload: BitButlerQbLoginPayload)`.

---

## 5. Angular - Server Editor

**File:** `packages/app/src/app/components/modals/server-editor/server-editor.ts`

- `Validators.required` removed from `username` and `password` form controls in both create and edit modes (edit mode already cleared password validators; now both are unconditionally optional)
- `canSave` continues to derive from `editorForm.valid` - it will be true when `name`, `host`, `protocol`, and `port` are valid regardless of credential fields
- Label/placeholder for username and password updated to indicate they are optional

**File:** `packages/app/src/app/components/modals/server-editor/server-editor.html`

- Username and password field labels get an "(optional)" hint

---

## 6. Angular - Credential Prompt Modal

**New files:**

- `packages/app/src/app/components/modals/credential-prompt/credential-prompt.ts`
- `packages/app/src/app/components/modals/credential-prompt/credential-prompt.html`
- `packages/app/src/app/components/modals/credential-prompt/credential-prompt.scss`

Component inputs:

- `serverName: string` - displayed in the modal header as "Connect to [serverName]"
- `username: string` - pre-fills the username field if non-empty

Form fields:

- `username` (text input, not required - user may connect without credentials)
- `password` (password input, not required)
- `saveCredentials` checkbox (unchecked by default)

Behavior:

- "Connect" closes the modal with `{ username: string; password: string; save: boolean }`
- "Cancel" dismisses the modal (no result)
- If "Save credentials" is checked but both fields are empty, the save flag is set to `false` (no point persisting empty credentials)

---

## 7. Angular - Login Page Connect Flow

**File:** `packages/app/src/app/pages/login/login.ts`

`connect()` gets a pre-login credentials guard inserted before the existing loading modal:

```
const currentServer = this.serverStoreService.currentServer();
if (!currentServer) return;

let runtimeUsername: string | undefined;
let runtimePassword: string | undefined;

if (!currentServer.username || !currentServer.has_password) {
  open CredentialPromptModal with { serverName: currentServer.name, username: currentServer.username }
  if modal dismissed → return

  const { username, password, save } = modal result
  runtimeUsername = username;
  runtimePassword = password;

  if (save && (username || password)) {
    await serverService.update(currentServer.id, { username, password })
    commandBusService.emit({ type: 'SERVER_UPDATED', id: currentServer.id })
    runtimeUsername = undefined;   // now stored in DB; let Electron read them
    runtimePassword = undefined;
  }
}

// existing loading modal + qbLogin call:
qbLogin({ id: currentServer.id, username: runtimeUsername, password: runtimePassword })
```

The loading modal, error handling, and post-login navigation are unchanged.

---

## Affected Files Summary

| File                                                                              | Change                                                  |
| --------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `packages/electron/src/db.ts`                                                     | DB migration: nullable password, recreate table         |
| `packages/electron/src/ipc/server.ts`                                             | Allow null password, relax username validation          |
| `packages/electron/src/ipc/qbittorrent.ts`                                        | Extend qbLogin payload, runtime credential override     |
| `packages/shared/src/models/server.model.ts`                                      | username/password optional in NewServer                 |
| `packages/shared/src/ipc.types.ts`                                                | BitButlerQbLoginPayload type, update qb.login signature |
| `packages/app/src/app/components/modals/server-editor/server-editor.ts`           | Remove required validators                              |
| `packages/app/src/app/components/modals/server-editor/server-editor.html`         | Optional hints on labels                                |
| `packages/app/src/app/components/modals/credential-prompt/credential-prompt.ts`   | New modal component                                     |
| `packages/app/src/app/components/modals/credential-prompt/credential-prompt.html` | New modal template                                      |
| `packages/app/src/app/components/modals/credential-prompt/credential-prompt.scss` | New modal styles                                        |
| `packages/app/src/app/pages/login/login.ts`                                       | Pre-login credentials guard in connect()                |
