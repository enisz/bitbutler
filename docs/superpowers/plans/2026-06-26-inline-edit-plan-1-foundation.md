# Inline Cell Edit - Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the `RowDoubleClickAction` type with `'INLINE_EDIT'` and add four missing qBittorrent API methods to `QbService`.

**Architecture:** Purely additive layer changes - no behaviour changes, just new type member and new service methods following existing patterns in `qb.service.ts`.

**Tech Stack:** Angular 20, TypeScript, Vitest

## Global Constraints

- Commit format: `#192: short description`
- Zero ESLint warnings: `npm run lint` must pass with exit 0
- Tests run via `npm test` (Vitest across all workspaces)
- All new qb.service methods follow the exact shape of existing ones: `cleanHashList`, `this.request`, throw `HttpError` on `!res.ok`
- Issue: #192

---

### Task 1: Extend RowDoubleClickAction type

**Files:**

- Modify: `packages/app/src/app/models/torrent-list-grid.model.ts`

**Interfaces:**

- Produces: `RowDoubleClickAction` union now includes `'INLINE_EDIT'` — used by Plans 2 and 3

- [ ] **Step 1: Add `'INLINE_EDIT'` to the union type**

Open `packages/app/src/app/models/torrent-list-grid.model.ts`. Change line 3 from:

```typescript
export type RowDoubleClickAction = 'SAVE_PATH' | 'DETAILS' | 'NONE';
```

to:

```typescript
export type RowDoubleClickAction = 'SAVE_PATH' | 'DETAILS' | 'NONE' | 'INLINE_EDIT';
```

No other changes to this file.

- [ ] **Step 2: Verify lint passes**

```bash
npm run lint
```

Expected: exits 0, no warnings.

- [ ] **Step 3: Commit**

```bash
git add packages/app/src/app/models/torrent-list-grid.model.ts
git commit -m "#192: add INLINE_EDIT to RowDoubleClickAction type"
```

---

### Task 2: Add four new methods to QbService

**Files:**

- Modify: `packages/app/src/app/services/qb.service.ts`
- Test: `packages/app/src/app/services/qb.service.spec.ts`

**Interfaces:**

- Consumes: existing `this.request`, `this.cleanHashList`, `HttpError` — all already in `qb.service.ts`
- Produces:
  - `qb.torrents.setDownloadPath(serverId: string, hashes: string[], path: string): Promise<void>`
  - `qb.torrents.toggleSequentialDownload(serverId: string, hashes: string[]): Promise<void>`
  - `qb.torrents.toggleFirstLastPiecePrio(serverId: string, hashes: string[]): Promise<void>`
  - `qb.torrents.removeAllTags(serverId: string, hashes: string[]): Promise<void>`

- [ ] **Step 1: Write failing tests**

Add to the end of `packages/app/src/app/services/qb.service.spec.ts` (before the final closing `}`):

```typescript
describe('torrents.setDownloadPath()', () => {
  it('sends hashes and path to /api/v2/torrents/setDownloadPath', async () => {
    vi.spyOn(service, 'request').mockResolvedValue({ ok: true } as any);
    await service.torrents.setDownloadPath('server-1', ['abc', 'def'], '/mnt/data');
    expect(service.request).toHaveBeenCalledWith(
      'server-1',
      expect.objectContaining({
        path: '/api/v2/torrents/setDownloadPath',
        method: 'POST',
        form: { hashes: 'abc|def', path: '/mnt/data' },
      }),
    );
  });

  it('throws HttpError when request fails', async () => {
    vi.spyOn(service, 'request').mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
    } as any);
    await expect(
      service.torrents.setDownloadPath('server-1', ['abc'], '/mnt/data'),
    ).rejects.toThrow('Failed to set download path');
  });

  it('rejects when no hashes are provided', async () => {
    await expect(service.torrents.setDownloadPath('server-1', [], '/mnt/data')).rejects.toThrow(
      'No hashes provided',
    );
  });

  it('rejects when path is empty', async () => {
    await expect(service.torrents.setDownloadPath('server-1', ['abc'], '  ')).rejects.toThrow(
      'path is required',
    );
  });
});

describe('torrents.toggleSequentialDownload()', () => {
  it('sends hashes to /api/v2/torrents/toggleSequentialDownload', async () => {
    vi.spyOn(service, 'request').mockResolvedValue({ ok: true } as any);
    await service.torrents.toggleSequentialDownload('server-1', ['abc']);
    expect(service.request).toHaveBeenCalledWith(
      'server-1',
      expect.objectContaining({
        path: '/api/v2/torrents/toggleSequentialDownload',
        method: 'POST',
        form: { hashes: 'abc' },
      }),
    );
  });

  it('throws HttpError when request fails', async () => {
    vi.spyOn(service, 'request').mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    } as any);
    await expect(service.torrents.toggleSequentialDownload('server-1', ['abc'])).rejects.toThrow(
      'Failed to toggle sequential download',
    );
  });

  it('returns early when hashes list is empty', async () => {
    const spy = vi.spyOn(service, 'request');
    await service.torrents.toggleSequentialDownload('server-1', []);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('torrents.toggleFirstLastPiecePrio()', () => {
  it('sends hashes to /api/v2/torrents/toggleFirstLastPiecePrio', async () => {
    vi.spyOn(service, 'request').mockResolvedValue({ ok: true } as any);
    await service.torrents.toggleFirstLastPiecePrio('server-1', ['abc']);
    expect(service.request).toHaveBeenCalledWith(
      'server-1',
      expect.objectContaining({
        path: '/api/v2/torrents/toggleFirstLastPiecePrio',
        method: 'POST',
        form: { hashes: 'abc' },
      }),
    );
  });

  it('throws HttpError when request fails', async () => {
    vi.spyOn(service, 'request').mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    } as any);
    await expect(service.torrents.toggleFirstLastPiecePrio('server-1', ['abc'])).rejects.toThrow(
      'Failed to toggle first/last piece priority',
    );
  });

  it('returns early when hashes list is empty', async () => {
    const spy = vi.spyOn(service, 'request');
    await service.torrents.toggleFirstLastPiecePrio('server-1', []);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('torrents.removeAllTags()', () => {
  it('sends hashes with no tags field to /api/v2/torrents/removeTags', async () => {
    vi.spyOn(service, 'request').mockResolvedValue({ ok: true } as any);
    await service.torrents.removeAllTags('server-1', ['abc', 'def']);
    expect(service.request).toHaveBeenCalledWith(
      'server-1',
      expect.objectContaining({
        path: '/api/v2/torrents/removeTags',
        method: 'POST',
        form: { hashes: 'abc|def' },
      }),
    );
  });

  it('throws HttpError when request fails', async () => {
    vi.spyOn(service, 'request').mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    } as any);
    await expect(service.torrents.removeAllTags('server-1', ['abc'])).rejects.toThrow(
      'Failed to remove all tags',
    );
  });

  it('returns early when hashes list is empty', async () => {
    const spy = vi.spyOn(service, 'request');
    await service.torrents.removeAllTags('server-1', []);
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A 2 "setDownloadPath\|toggleSequentialDownload\|toggleFirstLastPiecePrio\|removeAllTags"
```

Expected: tests fail with "service.torrents.setDownloadPath is not a function" (or similar).

- [ ] **Step 3: Implement the four methods in qb.service.ts**

In `packages/app/src/app/services/qb.service.ts`, insert the four methods inside the `torrents` object, after the existing `setUploadLimit` method (around line 658). Place them before the closing `};` of the `torrents` block:

```typescript
    setDownloadPath: async (serverId: string, hashes: string[], path: string): Promise<void> => {
      const clean = this.cleanHashList(hashes);
      const p = (path ?? '').trim();
      if (clean.length === 0) return Promise.reject(new Error('No hashes provided'));
      if (!p) return Promise.reject(new Error('path is required'));
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/setDownloadPath',
        method: 'POST',
        form: { hashes: clean.join('|'), path: p },
      });
      if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to set download path`);
    },

    toggleSequentialDownload: async (serverId: string, hashes: string[]): Promise<void> => {
      const clean = this.cleanHashList(hashes);
      if (clean.length === 0) return;
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/toggleSequentialDownload',
        method: 'POST',
        form: { hashes: clean.join('|') },
      });
      if (!res.ok)
        throw new HttpError(res.status, res.statusText, `Failed to toggle sequential download`);
    },

    toggleFirstLastPiecePrio: async (serverId: string, hashes: string[]): Promise<void> => {
      const clean = this.cleanHashList(hashes);
      if (clean.length === 0) return;
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/toggleFirstLastPiecePrio',
        method: 'POST',
        form: { hashes: clean.join('|') },
      });
      if (!res.ok)
        throw new HttpError(
          res.status,
          res.statusText,
          `Failed to toggle first/last piece priority`,
        );
    },

    removeAllTags: async (serverId: string, hashes: string[]): Promise<void> => {
      const clean = this.cleanHashList(hashes);
      if (clean.length === 0) return;
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/removeTags',
        method: 'POST',
        form: { hashes: clean.join('|') },
      });
      if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to remove all tags`);
    },
```

- [ ] **Step 4: Run all tests to verify they pass**

```bash
npm test
```

Expected: all tests pass, no failures.

- [ ] **Step 5: Verify lint passes**

```bash
npm run lint
```

Expected: exits 0, no warnings.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/services/qb.service.ts \
        packages/app/src/app/services/qb.service.spec.ts
git commit -m "#192: add setDownloadPath, toggleSequentialDownload, toggleFirstLastPiecePrio, removeAllTags to QbService"
```
