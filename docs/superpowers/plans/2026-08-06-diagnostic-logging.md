# Diagnostic Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add targeted `console.*` calls at diagnostically valuable points across the Electron main process and Angular renderer, now that all console output persists to the `logs` SQLite table (#262).

**Architecture:** No new abstractions - call `console.info/warn/error/debug` directly at each site, following the two conventions already established in the codebase (main process: `console.<level>('[BitButler][<module>] <message>.', ...)`; renderer: `console.error(<ClassName>.name, '<method>', '<message>', error)`).

**Tech Stack:** TypeScript, Vitest (electron + app packages).

## Global Constraints

- Never log credentials. Server logging must include only id/host, never username/password.
- Main process format: `console.<level>('[BitButler][<module>] <message>.', ...details)`.
- Renderer format: `console.error(<ClassName>.name, '<methodName>', '<message>', error)`.
- Don't invent new test scaffolding purely to assert on a log call where no natural test seam exists - extend an existing test that already exercises the branch instead.
- Run `npm run lint` and the relevant package's `npm test` after each task; both must pass before committing.

---

### Task 1: `qbittorrent.ts` - login, request, add, decrypt logging

**Files:**

- Modify: `packages/electron/src/ipc/qbittorrent.ts:123-164` (`qbLogin`), `:60-105` (`qbTorrentsAdd`), `:241-250` (`qbRequest` failure branch), `:277-281` (`decryptPassword`)
- Test: `packages/electron/src/ipc/qbittorrent.spec.ts`

- [ ] **Step 1: Add success/failure logging to `qbLogin`**

In `packages/electron/src/ipc/qbittorrent.ts`, replace the body of `qbLogin` (lines 147-163) with:

```typescript
const text = await res.text();
if (!res.ok || (res.status !== 204 && !/^Ok\./i.test(text.trim()))) {
  console.warn(`[BitButler][qbittorrent] Login failed for server ${id} (status ${res.status}).`);
  throw new Error('Login failed. Check username/password and WebUI settings.');
}

const cookie = extractSidCookie(res);
if (!cookie) {
  console.error(
    `[BitButler][qbittorrent] Login succeeded for server ${id} but no SID cookie was returned.`,
  );
  throw new Error(
    'Login succeeded but SID cookie was not returned (check proxy/HTTPS/WebUI config).',
  );
}

cookieJar.set(id, cookie);
console.info(`[BitButler][qbittorrent] Logged in to server ${id}.`);
ipcMain.emit('server:set-active', null, id);
rebuildMenu();
rebuildTrayMenu();
return { loggedIn: true };
```

- [ ] **Step 2: Add a submission-count log to `qbTorrentsAdd`**

Immediately after the `if (!appended) throw new Error('No torrent or URL attached to form-data.');` line (line 84), add:

```typescript
console.debug(
  `[BitButler][qbittorrent] Adding torrents for server ${id}: ${(torrents ?? []).length} file(s), ${(urls ?? []).length} url(s).`,
);
```

- [ ] **Step 3: Log `qbRequest` HTTP failures before throwing**

Replace the `if (!res.ok) { ... }` block (lines 241-250) with:

```typescript
if (!res.ok) {
  const errText = await res.text();
  console.warn(
    `[BitButler][qbittorrent] ${method} ${path} failed for server ${id} (status ${res.status}).`,
  );
  throw JSON.stringify({
    name: 'QbHttpError',
    status: res.status,
    statusText: res.statusText,
    body: errText,
    path,
  });
}
```

- [ ] **Step 4: Log and rethrow `decryptPassword` failures**

Replace `decryptPassword` (lines 277-281) with:

```typescript
function decryptPassword(passwordBlob: Buffer | Uint8Array | null): string {
  if (!passwordBlob) return '';
  const buf = Buffer.isBuffer(passwordBlob) ? passwordBlob : Buffer.from(passwordBlob);
  try {
    return safeStorage.decryptString(buf);
  } catch (error) {
    console.error('[BitButler][qbittorrent] Failed to decrypt stored password.', error);
    throw error;
  }
}
```

- [ ] **Step 5: Extend existing tests with console spy assertions**

In `packages/electron/src/ipc/qbittorrent.spec.ts`, in the `describe('qb:login IPC handler', ...)` block:

Replace the `'succeeds with qBittorrent <5 response (200 + Ok. + SID cookie)'` test (lines 191-205) with:

```typescript
it('succeeds with qBittorrent <5 response (200 + Ok. + SID cookie)', async () => {
  mockGet.mockReturnValue(fakeServerRow);
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve('Ok.'),
    headers: {
      getSetCookie: () => ['SID=abc123; HttpOnly'],
      get: () => null,
    },
  });
  const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  const { handler, getCookieJar } = await setup();
  await expect(handler(null, { id: 'srv-1' })).resolves.toEqual({ loggedIn: true });
  expect(getCookieJar().get('srv-1')).toBe('SID=abc123');
  expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('Logged in to server srv-1'));
});
```

Extend the `'throws on qBittorrent 5+ bad credentials (401)'` test (around line 235) by adding a spy and assertion:

```typescript
it('throws on qBittorrent 5+ bad credentials (401)', async () => {
  mockGet.mockReturnValue(fakeServerRow);
  mockFetch.mockResolvedValue({
    ok: false,
    status: 401,
    text: () => Promise.resolve('Unauthorized'),
    headers: { getSetCookie: () => [], get: () => null },
  });
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { handler } = await setup();
  await expect(handler(null, { id: 'srv-1' })).rejects.toThrow('Login failed');
  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Login failed for server srv-1'));
});
```

In the `describe('qbRequest', ...)` block, extend `'throws a serialized error object on non-ok response'` (around line 449):

```typescript
it('throws a serialized error object on non-ok response', async () => {
  mockGet.mockReturnValue(fakeServer);
  mockFetch.mockResolvedValue({
    ok: false,
    status: 403,
    statusText: 'Forbidden',
    text: () => Promise.resolve('Access denied'),
    headers: { get: () => null },
  });
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { qbRequest, getCookieJar } = await import('./qbittorrent.js');
  getCookieJar().set('srv-1', 'SID=tok');
  await expect(qbRequest({ id: 'srv-1', path: '/api/v2/test' })).rejects.toThrow();
  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('GET /api/v2/test failed'));
});
```

- [ ] **Step 6: Run tests**

Run: `npm test --workspace=@bitbutler/electron -- qbittorrent`
Expected: all tests in `qbittorrent.spec.ts` pass.

- [ ] **Step 7: Lint and commit**

```bash
npm run lint
git add packages/electron/src/ipc/qbittorrent.ts packages/electron/src/ipc/qbittorrent.spec.ts
git commit -m "$(cat <<'EOF'
#263: log qbLogin, qbRequest, qbTorrentsAdd, and decryptPassword outcomes
EOF
)"
```

---

### Task 2: `server.ts` - add/update/delete and encrypt-failure logging

**Files:**

- Modify: `packages/electron/src/ipc/server.ts:176-249` (`serverDelete`, `serverAdd`, `serverUpdate`), `:333-339` (`encryptPassword`)
- Test: `packages/electron/src/ipc/server.spec.ts`

- [ ] **Step 1: Log server delete**

Replace `serverDelete` (lines 176-185) with:

```typescript
function serverDelete(payload: unknown): { deleted: boolean } {
  const id = requireString((payload as Record<string, unknown>)?.id, 'id');
  const info = stmtDelete.run(id);
  const deleted = info.changes > 0;
  if (deleted) {
    console.info(`[BitButler][server] Deleted server ${id}.`);
    getCookieJar().delete(id);
    rebuildMenu();
  }
  return { deleted };
}
```

- [ ] **Step 2: Log server add**

In `serverAdd` (lines 187-209), replace the `try { ... }` block with:

```typescript
try {
  txInsertWithAutoLogin(row);
  console.info(`[BitButler][server] Added server ${row.id} (${row.host}).`);
  rebuildMenu();
  return { id: row.id };
} catch (err) {
  throw new Error(toUserDbError(err));
}
```

- [ ] **Step 3: Log server update**

In `serverUpdate` (lines 211-249), replace the final `try { ... }` block with:

```typescript
try {
  const updated = tx();
  if (updated) {
    console.info(`[BitButler][server] Updated server ${id}.`);
    rebuildMenu();
  }
  return { updated };
} catch (err) {
  throw new Error(toUserDbError(err));
}
```

- [ ] **Step 4: Log encrypt-unavailable failures**

Replace `encryptPassword` (lines 333-339) with:

```typescript
function encryptPassword(plain: unknown): Buffer | null {
  if (!plain || (typeof plain === 'string' && plain.length === 0)) return null;
  if (!safeStorage.isEncryptionAvailable()) {
    console.error('[BitButler][server] Cannot save password: OS encryption is unavailable.');
    throw new Error('Encryption is not available on this system (safeStorage).');
  }
  return safeStorage.encryptString(plain as string);
}
```

- [ ] **Step 5: Extend existing tests with console spy assertions**

In `packages/electron/src/ipc/server.spec.ts`:

Extend `'succeeds with empty username'` in the `server:add` describe block (around line 341) with an info-spy assertion:

```typescript
it('succeeds with empty username', async () => {
  const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
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
  expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('Added server'));
});
```

Extend `'throws when safeStorage encryption is unavailable'` (around line 354) with a warn/error-spy assertion:

```typescript
it('throws when safeStorage encryption is unavailable', async () => {
  const electronMock = (await import('electron')) as any;
  electronMock.safeStorage.isEncryptionAvailable.mockReturnValueOnce(false);
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const handler = await getAddHandler();
  await expect(
    handler(null, {
      name: 'L',
      host: 'localhost',
      port: 8080,
      username: 'u',
      password: 'pass',
      protocol: 'http',
    }),
  ).rejects.toThrow('Encryption is not available');
  expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('OS encryption is unavailable'));
});
```

Extend `'calls rebuildMenu when a row was deleted'` in `server:delete` (around line 438):

```typescript
it('calls rebuildMenu when a row was deleted', async () => {
  mockRun.mockReturnValue({ changes: 1 });
  const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  const handler = await getDeleteHandler();
  await handler(null, { id: 'srv-1' });
  expect(mockRebuildMenu).toHaveBeenCalled();
  expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('Deleted server srv-1'));
});
```

Extend `'returns { updated: true } when row was changed'` in `server:update` (around line 584):

```typescript
it('returns { updated: true } when row was changed', async () => {
  mockRun.mockReturnValue({ changes: 1 });
  const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  const handler = await getHandler();
  const result = await handler(null, { id: 'srv-1', changes: { name: 'New Name' } });
  expect(result).toEqual({ updated: true });
  expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('Updated server srv-1'));
});
```

- [ ] **Step 6: Run tests**

Run: `npm test --workspace=@bitbutler/electron -- server`
Expected: all tests in `server.spec.ts` pass.

- [ ] **Step 7: Lint and commit**

```bash
npm run lint
git add packages/electron/src/ipc/server.ts packages/electron/src/ipc/server.spec.ts
git commit -m "$(cat <<'EOF'
#263: log server add/update/delete and encrypt-unavailable failures
EOF
)"
```

---

### Task 3: `main.ts` - app lifecycle logging

**Files:**

- Modify: `packages/electron/src/main.ts`

**Notes:** `main.ts` has no existing spec file (it wires up Electron's `app` singleton directly and isn't unit-tested elsewhere in this codebase) - this task has no test step; verify manually by running the app (`npm start`) and confirming the new log lines appear via the app's log viewer / `logs` table.

- [ ] **Step 1: Move `initLogger()` before the single-instance-lock check**

In `packages/electron/src/main.ts`, move the `initLogger()` call from inside `app.whenReady().then(...)` (line 90) to immediately after the imports, before `const gotLock = app.requestSingleInstanceLock();` (line 79). Update the import line and the lock branch:

```typescript
import { hookRenderer, initLogger } from './logger.js';
```

(already imported - no change needed to the import line itself)

Replace lines 79-114 with:

```typescript
initLogger();
console.info(`[BitButler] Starting (platform=${process.platform}).`);

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  console.info('[BitButler] Another instance is already running; quitting.');
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    console.info('[BitButler] Second instance launched; focusing existing window.');
    createOrRestoreMainWindow();
    handleSecondInstanceArgv(argv);
  });

  app.whenReady().then(() => {
    loadTranslations(getInitialLanguage());
    registerI18nIpcHandlers();

    const { openAtLogin, startMinimized } = getStartupSettings();
    app.setLoginItemSettings({ openAtLogin });
    const mainWindow = createOrRestoreMainWindow(startMinimized);
    hookRenderer(mainWindow);
    if (!startMinimized) {
      mainWindow.once('ready-to-show', () => {
        mainWindow.maximize();
        mainWindow.show();
      });
    }

    app.on('activate', () => {
      createOrRestoreMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      console.info('[BitButler] All windows closed; quitting.');
      app.quit();
    }
  });
}
```

- [ ] **Step 2: Build check**

Run: `npm run build:electron`
Expected: compiles with no TypeScript errors.

- [ ] **Step 3: Lint and commit**

```bash
npm run lint
git add packages/electron/src/main.ts
git commit -m "$(cat <<'EOF'
#263: log app startup/quit lifecycle and init the logger before the single-instance-lock check
EOF
)"
```

---

### Task 4: `export.ts` - import/export failure logging

**Files:**

- Modify: `packages/electron/src/ipc/export.ts:125-160` (`restoreCategoriesAndTags`), `:445-452` (`buildExportEntry`), `:627-760` (`applyTorrentSettings`)
- Test: `packages/electron/src/ipc/export.spec.ts`

- [ ] **Step 1: Log `restoreCategoriesAndTags` catches**

Replace the body of `restoreCategoriesAndTags` (lines 125-159) with:

```typescript
if (restoreTags && metadata.tags?.length) {
  await qbRequest({
    id: serverId,
    method: 'POST',
    path: '/api/v2/torrents/createTags',
    form: { tags: metadata.tags.join(',') },
  }).catch((err) => {
    console.warn('[BitButler][export] Failed to restore tags during import.', err);
  });
}

if (restoreCategories && metadata.categories) {
  const existing = (await qbRequest({
    id: serverId,
    path: '/api/v2/torrents/categories',
  }).catch(() => ({}))) as Record<string, { name: string; savePath: string }>;

  for (const [name, category] of Object.entries(metadata.categories)) {
    const mappedPath = applyPathMappings(category.savePath, categoryPathMappings);

    if (!(name in existing)) {
      await qbRequest({
        id: serverId,
        method: 'POST',
        path: '/api/v2/torrents/createCategory',
        form: { category: name, savePath: mappedPath },
      }).catch((err) => {
        console.warn(`[BitButler][export] Failed to create category '${name}' during import.`, err);
      });
    } else if (overwriteCategories) {
      await qbRequest({
        id: serverId,
        method: 'POST',
        path: '/api/v2/torrents/editCategory',
        form: { category: name, savePath: mappedPath },
      }).catch((err) => {
        console.warn(`[BitButler][export] Failed to edit category '${name}' during import.`, err);
      });
    }
  }
}
```

- [ ] **Step 2: Log `buildExportEntry` failures**

Replace the `catch (err) { ... }` block in `buildExportEntry` (lines 445-452) with:

```typescript
  } catch (err) {
    console.warn(`[BitButler][export] Failed to export torrent ${hash}.`, err);
    return {
      hash,
      name: hash,
      failed: true,
      error: (err as Error)?.message ?? String(err),
    };
  }
```

- [ ] **Step 3: Log `applyTorrentSettings` catches**

In `applyTorrentSettings` (lines 617-761), replace each of the following `.catch(() => {})` call sites with a version that logs the entry hash and the field being restored:

```typescript
if (has('save_path') && entry.save_path) {
  await qbRequest({
    id: serverId,
    method: 'POST',
    path: '/api/v2/torrents/setLocation',
    form: { hashes: entry.hash, location: applyPathMappings(entry.save_path, pathMappings) },
  }).catch((err) => {
    console.warn(`[BitButler][export] Failed to restore save_path for ${entry.hash}.`, err);
  });
}

if (has('categories') && entry.category) {
  await qbRequest({
    id: serverId,
    method: 'POST',
    path: '/api/v2/torrents/setCategory',
    form: { hashes: entry.hash, category: entry.category },
  }).catch((err) => {
    console.warn(`[BitButler][export] Failed to restore category for ${entry.hash}.`, err);
  });
}

if (has('tags')) {
  await qbRequest({
    id: serverId,
    method: 'POST',
    path: '/api/v2/torrents/removeTags',
    form: { hashes: entry.hash },
  }).catch((err) => {
    console.warn(`[BitButler][export] Failed to clear tags for ${entry.hash}.`, err);
  });
  if (entry.tags?.length) {
    await qbRequest({
      id: serverId,
      method: 'POST',
      path: '/api/v2/torrents/addTags',
      form: { hashes: entry.hash, tags: entry.tags.join(',') },
    }).catch((err) => {
      console.warn(`[BitButler][export] Failed to restore tags for ${entry.hash}.`, err);
    });
  }
}
```

```typescript
if (has('renames') && entry.files?.length && baseFiles.length) {
  for (const saved of entry.files) {
    const base = baseFiles.find((f) => f.index === saved.index);
    if (base && base.name !== saved.name) {
      await qbRequest({
        id: serverId,
        method: 'POST',
        path: '/api/v2/torrents/renameFile',
        form: { hash: entry.hash, oldPath: base.name, newPath: saved.name },
      }).catch((err) => {
        console.warn(`[BitButler][export] Failed to rename file for ${entry.hash}.`, err);
      });
    }
  }
}

if (has('priorities') && entry.files?.length) {
  const byPriority = new Map<number, number[]>();
  for (const f of entry.files) {
    const list = byPriority.get(f.priority) ?? [];
    list.push(f.index);
    byPriority.set(f.priority, list);
  }
  for (const [priority, indices] of byPriority) {
    await qbRequest({
      id: serverId,
      method: 'POST',
      path: '/api/v2/torrents/filePrio',
      form: { hash: entry.hash, id: indices.join('|'), priority: String(priority) },
    }).catch((err) => {
      console.warn(`[BitButler][export] Failed to restore file priorities for ${entry.hash}.`, err);
    });
  }
}

if (has('speed_limits')) {
  if (entry.up_limit !== undefined) {
    await qbRequest({
      id: serverId,
      method: 'POST',
      path: '/api/v2/torrents/setUploadLimit',
      form: { hashes: entry.hash, limit: String(entry.up_limit) },
    }).catch((err) => {
      console.warn(`[BitButler][export] Failed to restore upload limit for ${entry.hash}.`, err);
    });
  }
  if (entry.dl_limit !== undefined) {
    await qbRequest({
      id: serverId,
      method: 'POST',
      path: '/api/v2/torrents/setDownloadLimit',
      form: { hashes: entry.hash, limit: String(entry.dl_limit) },
    }).catch((err) => {
      console.warn(`[BitButler][export] Failed to restore download limit for ${entry.hash}.`, err);
    });
  }
}

if (has('share_limits')) {
  await qbRequest({
    id: serverId,
    method: 'POST',
    path: '/api/v2/torrents/setShareLimits',
    form: {
      hashes: entry.hash,
      ratioLimit: String(entry.ratio_limit ?? -1),
      seedingTimeLimit: String(entry.seeding_time_limit ?? -1),
      inactiveSeedingTimeLimit: String(entry.inactive_seeding_time_limit ?? -1),
    },
  }).catch((err) => {
    console.warn(`[BitButler][export] Failed to restore share limits for ${entry.hash}.`, err);
  });
}

if (has('super_seeding') && entry.super_seeding !== undefined) {
  await qbRequest({
    id: serverId,
    method: 'POST',
    path: '/api/v2/torrents/setSuperSeeding',
    form: { hashes: entry.hash, value: String(entry.super_seeding) },
  }).catch((err) => {
    console.warn(`[BitButler][export] Failed to restore super-seeding for ${entry.hash}.`, err);
  });
}

const shouldResume = startMode === 'all' || (startMode === 'active' && isActiveState(entry.state));
if (shouldResume) {
  await qbRequest({
    id: serverId,
    method: 'POST',
    path: '/api/v2/torrents/resume',
    form: { hashes: entry.hash },
  }).catch((err) => {
    console.warn(`[BitButler][export] Failed to resume ${entry.hash} after import.`, err);
  });
}
```

- [ ] **Step 4: Extend existing test with a console spy assertion**

In `packages/electron/src/ipc/export.spec.ts`, add a new test to the `describe('restoreCategoriesAndTags', ...)` block (after the `'creates tags via createTags when restoreTags is true'` test, around line 840):

```typescript
it('logs a warning and does not throw when createTags fails', async () => {
  mockQbRequestRestore.mockRejectedValue(new Error('network error'));
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { restoreCategoriesAndTags } = await setup();
  await expect(
    restoreCategoriesAndTags(
      'server-1',
      { categories: {}, tags: ['linux'] },
      false,
      true,
      [],
      false,
    ),
  ).resolves.toBeUndefined();
  expect(warnSpy).toHaveBeenCalledWith(
    expect.stringContaining('Failed to restore tags'),
    expect.any(Error),
  );
});
```

- [ ] **Step 5: Run tests**

Run: `npm test --workspace=@bitbutler/electron -- export`
Expected: all tests in `export.spec.ts` pass, including the new one.

- [ ] **Step 6: Lint and commit**

```bash
npm run lint
git add packages/electron/src/ipc/export.ts packages/electron/src/ipc/export.spec.ts
git commit -m "$(cat <<'EOF'
#263: log silent import/export failures instead of swallowing them
EOF
)"
```

---

### Task 5: `torrent.ts` - skipped-subdirectory logging

**Files:**

- Modify: `packages/electron/src/ipc/torrent.ts:115-121`
- Test: `packages/electron/src/ipc/torrent.spec.ts`

- [ ] **Step 1: Log skipped subdirectories**

Replace `walkSubdirectory` (lines 115-121) with:

```typescript
async function walkSubdirectory(dir: string, recursive: boolean): Promise<string[]> {
  try {
    return await walkForTorrentFiles(dir, recursive);
  } catch (err) {
    console.debug(`[BitButler][torrent] Skipped unreadable subdirectory: ${dir}.`, err);
    return [];
  }
}
```

- [ ] **Step 2: Run tests**

Run: `npm test --workspace=@bitbutler/electron -- torrent`
Expected: all tests in `torrent.spec.ts` pass (no assertions on the new log line needed - none of the existing tests exercise an unreadable subdirectory).

- [ ] **Step 3: Lint and commit**

```bash
npm run lint
git add packages/electron/src/ipc/torrent.ts
git commit -m "$(cat <<'EOF'
#263: log skipped unreadable subdirectories during folder-scan-add
EOF
)"
```

---

### Task 6: `login.ts` - log connect() failures

**Files:**

- Modify: `packages/app/src/app/pages/login/login.ts:249-255`
- Test: `packages/app/src/app/pages/login/login.spec.ts`

- [ ] **Step 1: Log the connect() failure before toasting**

Replace the `.catch((error) => { ... })` block (lines 249-255) with:

```typescript
      .catch((error) => {
        console.error(Login.name, 'connect', error);
        loadingModalRef.close();
        this.toastService.danger(
          error.message,
          this.translateService.instant('pages.login.error.connection-failed'),
        );
      })
```

- [ ] **Step 2: Add a failing-login test with a console spy assertion**

In `packages/app/src/app/pages/login/login.spec.ts`, add a new test inside `describe('connect', ...)` (after the `'does not probe when login did not succeed'` test, around line 467). This follows the same `TestBed.inject(ToastService)` pattern already used by the `'shows the connection-failed toast and does not proceed when persisting credentials fails'` test at line 534, and the outer-scope `translateMock` (a `mockTranslateService()`, whose `instant` stub returns `''`) declared at line 41:

```typescript
it('logs the error and shows the connection-failed toast when login rejects', async () => {
  setCurrentServer({ export_available: null });
  qbServiceMock.login.mockRejectedValue(new Error('ECONNREFUSED'));
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const toastServiceMock = TestBed.inject(ToastService) as any;

  await component.connect();

  expect(errorSpy).toHaveBeenCalledWith(Login.name, 'connect', expect.any(Error));
  expect(toastServiceMock.danger).toHaveBeenCalledWith('ECONNREFUSED', '');
  expect(translateMock.instant).toHaveBeenCalledWith('pages.login.error.connection-failed');
});
```

- [ ] **Step 3: Run tests**

Run: `npm test --workspace=@bitbutler/app -- login`
Expected: all tests in `login.spec.ts` pass, including the new one.

- [ ] **Step 4: Lint and commit**

```bash
npm run lint
git add packages/app/src/app/pages/login/login.ts packages/app/src/app/pages/login/login.spec.ts
git commit -m "$(cat <<'EOF'
#263: log connect() failures on the login page
EOF
)"
```

---

### Task 7: `manage-servers.ts` - log switchTo() failures

**Files:**

- Modify: `packages/app/src/app/modals/manage-servers/manage-servers.ts:133-139`
- Test: `packages/app/src/app/modals/manage-servers/manage-servers.spec.ts`

- [ ] **Step 1: Log the switchTo() failure before toasting**

Replace the `catch (err) { ... }` block (lines 133-139) with:

```typescript
    } catch (err) {
      console.error(ManageServers.name, 'switchTo', err);
      this.toastService.danger(
        `"${server.name || server.host}"`,
        this.translateService.instant(
          'services.menu-bar-command-handler.error.failed-to-connect-title',
        ),
      );
    } finally {
```

- [ ] **Step 2: Extend the existing failure test with a console spy assertion**

In `packages/app/src/app/modals/manage-servers/manage-servers.spec.ts`, in the `'should show a danger toast with the quoted server name and the failed-to-connect-title key when login fails'` test (lines 83-107), add one line - `const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});` - right before the `const toastServiceMock = TestBed.inject(ToastService) as any;` line (line 98), and one assertion after the existing `await component.switchTo(server);` call. The full test becomes:

```typescript
it('should show a danger toast with the quoted server name and the failed-to-connect-title key when login fails', async () => {
  const server = {
    id: 'srv-1',
    name: 'My Server',
    host: 'localhost',
    port: 8080,
    protocol: 'http',
    username: 'admin',
    has_password: true,
  } as any;

  const qbServiceMock = TestBed.inject(QbService) as any;
  qbServiceMock.auth.hasCookie.mockResolvedValue(false);
  qbServiceMock.auth.login.mockResolvedValue({ loggedIn: false });

  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const toastServiceMock = TestBed.inject(ToastService) as any;
  const translateServiceMock = TestBed.inject(TranslateService) as any;

  await component.switchTo(server);

  expect(errorSpy).toHaveBeenCalledWith(ManageServers.name, 'switchTo', expect.any(Error));
  expect(toastServiceMock.danger).toHaveBeenCalledWith('"My Server"', '');
  expect(translateServiceMock.instant).toHaveBeenCalledWith(
    'services.menu-bar-command-handler.error.failed-to-connect-title',
  );
});
```

- [ ] **Step 3: Run tests**

Run: `npm test --workspace=@bitbutler/app -- manage-servers`
Expected: all tests in `manage-servers.spec.ts` pass.

- [ ] **Step 4: Lint and commit**

```bash
npm run lint
git add packages/app/src/app/modals/manage-servers/manage-servers.ts packages/app/src/app/modals/manage-servers/manage-servers.spec.ts
git commit -m "$(cat <<'EOF'
#263: log switchTo() failures in the manage-servers modal
EOF
)"
```

---

### Task 8: `ui-command-handler.service.ts` - log UI_OPEN_DESTINATION failures

**Files:**

- Modify: `packages/app/src/app/services/ui-command-handler.service.ts:335-337`
- Test: `packages/app/src/app/services/ui-command-handler.service.spec.ts`

- [ ] **Step 1: Log the failure before toasting**

Replace:

```typescript
              .catch((error: any) => {
                this.toastService.danger(error);
              });
```

with:

```typescript
              .catch((error: any) => {
                console.error(UiCommandHandlerService.name, 'UI_OPEN_DESTINATION', error);
                this.toastService.danger(error);
              });
```

- [ ] **Step 2: Add a new test with a console spy assertion**

There is no existing test for `UI_OPEN_DESTINATION` in `packages/app/src/app/services/ui-command-handler.service.spec.ts`. The `QbService` mock is provided in `beforeEach` (around line 102) as `{ torrents: { files: vi.fn().mockResolvedValue([{ name: 'file.mkv' }]) }, auth: {...} }`, and `ToastService` is provided as `{ danger: vi.fn(), info: vi.fn() }` (around line 99). Add a new test after the `'should open ImportTorrents modal at xl size for UI_IMPORT_TORRENTS'` test (around line 233):

```typescript
it('logs the error and shows a danger toast when opening the destination fails', async () => {
  const qbServiceMock = TestBed.inject(QbService) as any;
  qbServiceMock.torrents.files.mockRejectedValue(new Error('files lookup failed'));
  const toastServiceMock = TestBed.inject(ToastService) as any;
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  commands$.next({ type: 'UI_OPEN_DESTINATION', hash: 'hash1', remotePath: '/data/movies' });
  await flushPromises();

  expect(errorSpy).toHaveBeenCalledWith(
    UiCommandHandlerService.name,
    'UI_OPEN_DESTINATION',
    expect.any(Error),
  );
  expect(toastServiceMock.danger).toHaveBeenCalledWith(expect.any(Error));
});
```

- [ ] **Step 3: Run tests**

Run: `npm test --workspace=@bitbutler/app -- ui-command-handler`
Expected: all tests pass.

- [ ] **Step 4: Lint and commit**

```bash
npm run lint
git add packages/app/src/app/services/ui-command-handler.service.ts packages/app/src/app/services/ui-command-handler.service.spec.ts
git commit -m "$(cat <<'EOF'
#263: log UI_OPEN_DESTINATION failures
EOF
)"
```

---

### Task 9: `torrent-command-handler.service.ts` - bring two handlers in line with their siblings

**Files:**

- Modify: `packages/app/src/app/services/torrent-command-handler.service.ts:109-137`
- Test: `packages/app/src/app/services/torrent-command-handler.service.spec.ts`

- [ ] **Step 1: Add the missing `console.error` calls**

Replace `handleToggleSequentialDownload` and `handleToggleFirstLastPiecePrio` (lines 109-137) with:

```typescript
  private async handleToggleSequentialDownload(): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      await this.qbService.torrents.toggleSequentialDownload(ctx.serverId, ctx.hashes);
    } catch (e: any) {
      console.error(
        TorrentCommandHandlerService.name,
        'handleToggleSequentialDownload',
        'Toggle sequential download failed!',
        e,
      );
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant(
          'services.torrent-command-handler.toast.toggle-sequential-download-failed-title',
        ),
      );
    }
  }

  private async handleToggleFirstLastPiecePrio(): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      await this.qbService.torrents.toggleFirstLastPiecePrio(ctx.serverId, ctx.hashes);
    } catch (e: any) {
      console.error(
        TorrentCommandHandlerService.name,
        'handleToggleFirstLastPiecePrio',
        'Toggle first/last piece priority failed!',
        e,
      );
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant(
          'services.torrent-command-handler.toast.toggle-first-last-piece-prio-failed-title',
        ),
      );
    }
  }
```

- [ ] **Step 2: Extend the existing failure tests with console spy assertions**

In `packages/app/src/app/services/torrent-command-handler.service.spec.ts`, replace the `'shows danger toast when toggleSequentialDownload fails'` test (lines 445-453) with:

```typescript
it('shows danger toast when toggleSequentialDownload fails', async () => {
  qbService.torrents.toggleSequentialDownload.mockRejectedValueOnce(new Error('network error'));
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  commands$.next({ type: 'TORRENT_TOGGLE_SEQUENTIAL_DOWNLOAD' });
  await flushPromises();
  expect(errorSpy).toHaveBeenCalledWith(
    TorrentCommandHandlerService.name,
    'handleToggleSequentialDownload',
    'Toggle sequential download failed!',
    expect.any(Error),
  );
  expect(toastDanger).toHaveBeenCalledWith(
    'network error',
    'services.torrent-command-handler.toast.toggle-sequential-download-failed-title',
  );
});
```

Replace the `'shows danger toast when toggleFirstLastPiecePrio fails'` test (lines 466-474) with:

```typescript
it('shows danger toast when toggleFirstLastPiecePrio fails', async () => {
  qbService.torrents.toggleFirstLastPiecePrio.mockRejectedValueOnce(new Error('network error'));
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  commands$.next({ type: 'TORRENT_TOGGLE_FIRST_LAST_PIECE_PRIO' });
  await flushPromises();
  expect(errorSpy).toHaveBeenCalledWith(
    TorrentCommandHandlerService.name,
    'handleToggleFirstLastPiecePrio',
    'Toggle first/last piece priority failed!',
    expect.any(Error),
  );
  expect(toastDanger).toHaveBeenCalledWith(
    'network error',
    'services.torrent-command-handler.toast.toggle-first-last-piece-prio-failed-title',
  );
});
```

- [ ] **Step 3: Run tests**

Run: `npm test --workspace=@bitbutler/app -- torrent-command-handler`
Expected: all tests pass.

- [ ] **Step 4: Lint and commit**

```bash
npm run lint
git add packages/app/src/app/services/torrent-command-handler.service.ts packages/app/src/app/services/torrent-command-handler.service.spec.ts
git commit -m "$(cat <<'EOF'
#263: log toggle-sequential-download and toggle-first-last-piece-prio failures
EOF
)"
```

---

### Task 10: `qb-polling.service.ts` - distinguish session-expired background-poll failures

**Files:**

- Modify: `packages/app/src/app/services/qb-polling.service.ts:139-145`
- Test: `packages/app/src/app/services/qb-polling.service.spec.ts`

- [ ] **Step 1: Log a distinct message for 401/403**

Replace the `catchError` block (lines 139-145) with:

```typescript
              catchError((err) => {
                if (err?.status === 401 || err?.status === 403) {
                  console.warn(
                    '[maindata] background poll stopped: session expired (status ' +
                      err.status +
                      ').',
                  );
                  this.stopPolling();
                } else {
                  console.error('[maindata] background poll failed', err);
                }
                return EMPTY;
              }),
```

- [ ] **Step 2: Check for an existing test on the 401/403 branch**

Search `packages/app/src/app/services/qb-polling.service.spec.ts` for a test that sets `err.status` to `401` or `403` on the background poll. If one exists, extend it with a `console.warn` spy assertion (matching the pattern used in prior tasks); if none exists, skip adding a new test - don't invent new RxJS marble-testing scaffolding for this low-priority item.

- [ ] **Step 3: Run tests**

Run: `npm test --workspace=@bitbutler/app -- qb-polling`
Expected: all tests pass.

- [ ] **Step 4: Lint and commit**

```bash
npm run lint
git add packages/app/src/app/services/qb-polling.service.ts
git add packages/app/src/app/services/qb-polling.service.spec.ts 2>/dev/null || true
git commit -m "$(cat <<'EOF'
#263: distinguish session-expired from other background-poll failures in logs
EOF
)"
```

---

## Final verification (after all tasks)

- [ ] Run the full test suite: `npm test`
- [ ] Run lint: `npm run lint`
- [ ] Run a full build: `npm run build:electron && npm run build`
- [ ] Manually smoke-test in the running app (`npm start`): log in to a server, add a torrent, trigger a login failure (wrong password), and confirm the corresponding log rows appear (via the in-app log viewer or by inspecting the `logs` table).
