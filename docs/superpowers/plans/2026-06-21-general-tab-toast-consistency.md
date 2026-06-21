# General tab toast consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all 11 mutating action handlers in the Torrent Details "General" tab show an info toast when an action starts and a danger toast if it fails, with friendlier wording, and fix a qBittorrent-service bug that would otherwise let one of those failures pass silently.

**Architecture:** No new abstractions. Each handler in `general.ts` keeps its existing "fire an info toast, then call `qbService.torrents.*`" shape, but the call is now `await`ed inside a `try/catch` that shows a `toastService.danger(...)` with a translated title on failure - the same shape `TorrentCommandHandlerService.handleDelete` already uses. One qBittorrent service method (`clearCategory`) gets a one-line fix so its failures actually surface instead of being swallowed.

**Tech Stack:** Angular 20 (zoneless/signals), `@ngx-translate/core`, Vitest (via `@angular/build:unit-test` + `@analogjs/vitest-angular`), `vi.fn()` mocking.

## Global Constraints

- Commit format: `#178: short description` (this is a feature branch for issue #178).
- Use `-` (hyphen), never `—` (em dash), in any commit message or written text.
- ESLint must pass with zero warnings (`npm run lint`); Husky + lint-staged run automatically on commit, so don't bypass with `--no-verify`.
- Every new/changed user-facing string needs a matching key in both `public/i18n/us.json` and `public/i18n/hu.json`.
- Translation keys in this file live under `components.modals.torrent-details.general.toast.*`.
- Test runner invocation (from repo root): `npm run test --workspace=packages/app -- --include='<spec-glob>' --watch=false`.

---

## Task 1: Fix `clearCategory` to throw on a failed request (`qb.service.ts`)

**Files:**

- Modify: `packages/app/src/app/services/qb.service.ts:534-542`
- Test: `packages/app/src/app/services/qb.service.spec.ts`

**Interfaces:**

- Produces: `QbService.torrents.clearCategory(serverId: string, hashes: string[]): Promise<void>` now rejects with `HttpError` when the underlying request fails (previously it always resolved). Task 3 relies on this being a real rejection path being mockable at the `QbService` boundary - it does not call through to this real implementation, so this task has no hard runtime dependency from Task 3, but is a documented prerequisite per the design doc.

- [ ] **Step 1: Write the failing test**

Open `packages/app/src/app/services/qb.service.spec.ts` and add this test as the last item inside the `describe('QbService', ...)` block (right before the closing `});` that ends the describe block):

```ts
it('should throw HttpError when clearing the category fails', async () => {
  vi.spyOn(service, 'request').mockResolvedValue({
    ok: false,
    status: 409,
    statusText: 'Conflict',
  } as any);

  await expect(service.torrents.clearCategory('server-1', ['hash1'])).rejects.toThrow(
    'Failed to clear category',
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=packages/app -- --include='src/app/services/qb.service.spec.ts' --watch=false`
Expected: FAIL - the new test fails because the promise resolves instead of rejecting (no error thrown).

- [ ] **Step 3: Apply the fix**

In `packages/app/src/app/services/qb.service.ts`, replace:

```ts
    clearCategory: async (serverId: string, hashes: string[]): Promise<void> => {
      const cleanHashes = this.cleanHashList(hashes);
      if (cleanHashes.length === 0) return;
      await this.request<void>(serverId, {
        path: '/api/v2/torrents/setCategory',
        method: 'POST',
        form: { hashes: cleanHashes.join('|'), category: '' },
      });
    },
```

with:

```ts
    clearCategory: async (serverId: string, hashes: string[]): Promise<void> => {
      const cleanHashes = this.cleanHashList(hashes);
      if (cleanHashes.length === 0) return;
      const res = await this.request<void>(serverId, {
        path: '/api/v2/torrents/setCategory',
        method: 'POST',
        form: { hashes: cleanHashes.join('|'), category: '' },
      });
      if (!res.ok) throw new HttpError(res.status, res.statusText, `Failed to clear category`);
    },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=packages/app -- --include='src/app/services/qb.service.spec.ts' --watch=false`
Expected: PASS (9 tests passed).

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/services/qb.service.ts packages/app/src/app/services/qb.service.spec.ts
git commit -m "#178: throw on failed clearCategory request"
```

---

## Task 2: Revise and add toast translation keys

**Files:**

- Modify: `public/i18n/us.json:486-495`
- Modify: `public/i18n/hu.json:486-495`

**Interfaces:**

- Produces: translation keys consumed by Task 3 - `resuming`, `resume-failed`, `pausing`, `pause-failed`, `force-resuming`, `force-resume-failed`, `clearing-download-limit`, `clear-download-limit-failed`, `clearing-upload-limit`, `clear-upload-limit-failed`, `clearing-ratio-limit`, `clear-ratio-limit-failed`, `clearing-seeding-time-limit`, `clear-seeding-time-limit-failed`, `clearing-inactive-seeding-time-limit`, `clear-inactive-seeding-time-limit-failed`, `reannouncing`, `reannounce-failed`, `removing-category`, `remove-category-failed`, `removing-all-tags`, `remove-all-tags-failed` - all under `components.modals.torrent-details.general.toast.*`.

This task is data-only (no code), so there's no red/green cycle - just make the edits and commit. Tests for the new keys live in Task 3.

- [ ] **Step 1: Update `public/i18n/us.json`**

Replace:

```json
            "resuming": "Resuming.",
            "pausing": "Pausing.",
            "force-resuming": "Forcing resume.",
            "clearing-download-limit": "Clearing download limit.",
            "clearing-upload-limit": "Clearing upload limit.",
            "reannouncing": "Reannouncing.",
            "removing-category": "Removing category.",
            "removing-all-tags": "Removing all tags.",
            "local-path-failed": "Failed to resolve local path!",
            "copied-to-clipboard": "Copied {{field}} to clipboard."
```

with:

```json
            "resuming": "Resuming the torrent…",
            "resume-failed": "Failed to resume torrent",
            "pausing": "Pausing the torrent…",
            "pause-failed": "Failed to pause torrent",
            "force-resuming": "Force resuming the torrent…",
            "force-resume-failed": "Failed to force resume torrent",
            "clearing-download-limit": "Clearing the download limit…",
            "clear-download-limit-failed": "Failed to clear download limit",
            "clearing-upload-limit": "Clearing the upload limit…",
            "clear-upload-limit-failed": "Failed to clear upload limit",
            "clearing-ratio-limit": "Clearing the ratio limit…",
            "clear-ratio-limit-failed": "Failed to clear ratio limit",
            "clearing-seeding-time-limit": "Clearing the seeding time limit…",
            "clear-seeding-time-limit-failed": "Failed to clear seeding time limit",
            "clearing-inactive-seeding-time-limit": "Clearing the inactive seeding time limit…",
            "clear-inactive-seeding-time-limit-failed": "Failed to clear inactive seeding time limit",
            "reannouncing": "Reannouncing to trackers…",
            "reannounce-failed": "Failed to reannounce torrent",
            "removing-category": "Removing the category…",
            "remove-category-failed": "Failed to remove category",
            "removing-all-tags": "Removing all tags…",
            "remove-all-tags-failed": "Failed to remove all tags",
            "local-path-failed": "Failed to resolve local path!",
            "copied-to-clipboard": "Copied {{field}} to clipboard."
```

- [ ] **Step 2: Update `public/i18n/hu.json`**

Replace:

```json
            "resuming": "Folytatás.",
            "pausing": "Felfüggesztés.",
            "force-resuming": "Kényszerített folytatás.",
            "clearing-download-limit": "Letöltési korlát törlése.",
            "clearing-upload-limit": "Feltöltési korlát törlése.",
            "reannouncing": "Újrajelentkezés.",
            "removing-category": "Kategória eltávolítása.",
            "removing-all-tags": "Összes címke eltávolítása.",
            "local-path-failed": "A helyi elérési út feloldása sikertelen!",
            "copied-to-clipboard": "{{field}} a vágólapra másolva."
```

with:

```json
            "resuming": "A torrent folytatása…",
            "resume-failed": "Nem sikerült folytatni a torrentet",
            "pausing": "A torrent szüneteltetése…",
            "pause-failed": "Nem sikerült szüneteltetni a torrentet",
            "force-resuming": "A torrent kényszerített folytatása…",
            "force-resume-failed": "Nem sikerült kényszerítve folytatni a torrentet",
            "clearing-download-limit": "Letöltési korlát törlése…",
            "clear-download-limit-failed": "Nem sikerült törölni a letöltési korlátot",
            "clearing-upload-limit": "Feltöltési korlát törlése…",
            "clear-upload-limit-failed": "Nem sikerült törölni a feltöltési korlátot",
            "clearing-ratio-limit": "Megosztási arány korlát törlése…",
            "clear-ratio-limit-failed": "Nem sikerült törölni a megosztási arány korlátot",
            "clearing-seeding-time-limit": "Seedelési idő korlát törlése…",
            "clear-seeding-time-limit-failed": "Nem sikerült törölni a seedelési idő korlátot",
            "clearing-inactive-seeding-time-limit": "Inaktív seedelési idő korlát törlése…",
            "clear-inactive-seeding-time-limit-failed": "Nem sikerült törölni az inaktív seedelési idő korlátot",
            "reannouncing": "Újrajelentkezés a trackereknél…",
            "reannounce-failed": "Nem sikerült újrajelentkezni a trackereknél",
            "removing-category": "Kategória eltávolítása…",
            "remove-category-failed": "Nem sikerült eltávolítani a kategóriát",
            "removing-all-tags": "Az összes címke eltávolítása…",
            "remove-all-tags-failed": "Nem sikerült eltávolítani az összes címkét",
            "local-path-failed": "A helyi elérési út feloldása sikertelen!",
            "copied-to-clipboard": "{{field}} a vágólapra másolva."
```

- [ ] **Step 3: Validate both files are well-formed JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('public/i18n/us.json','utf8')); JSON.parse(require('fs').readFileSync('public/i18n/hu.json','utf8')); console.log('OK')"`
Expected: prints `OK` (no parse errors).

- [ ] **Step 4: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "#178: revise general tab toast wording and add missing keys"
```

---

## Task 3: Apply the uniform info/try-catch-danger pattern to all 11 handlers

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-details/general/general.ts:254-398`
- Test: `packages/app/src/app/components/modals/torrent-details/general/general.spec.ts`

**Interfaces:**

- Consumes: `QbService.torrents.{resume,pause,setForceStart,setDownloadLimit,setUploadLimit,setShareLimits,clearCategory,removeTags,reannounce}` (all already exist; `clearCategory`'s failure behavior was fixed in Task 1, but this task's tests mock `QbService` directly so they don't exercise that real implementation). Translation keys produced by Task 2.
- Produces: `resume`, `pause`, `forceResume`, `clearDownloadLimit`, `clearUploadLimit`, `clearRatioLimit`, `clearSeedingTimeLimit`, `clearInactiveSeedingTimeLimit`, `removeCategory`, `removeAllTags`, `forceReannounce` all become `public async <name>(): Promise<void>`. Template bindings (`(click)="resume()"` etc. in `general.html`) are unaffected - Angular event bindings don't care whether the bound method returns `void` or `Promise<void>`.

This is one task (not 11) because the 11 handlers are not independently reviewable - the whole point is that they end up with one uniform shape, so they're written and tested together.

- [ ] **Step 1: Update test scaffolding and write the failing tests**

Open `packages/app/src/app/components/modals/torrent-details/general/general.spec.ts`.

Replace the `describe('General', ...)` block's variable declarations and `beforeEach` (lines 125-187) with:

```ts
describe('General', () => {
  let component: General;
  let fixture: ComponentFixture<General>;
  let torrentsMap: WritableSignal<Map<string, Torrent>>;
  let mockLogMain: ReturnType<typeof vi.fn>;
  let qbTorrents: {
    properties: ReturnType<typeof vi.fn>;
    files: ReturnType<typeof vi.fn>;
    rename: ReturnType<typeof vi.fn>;
    renameFile: ReturnType<typeof vi.fn>;
    renameFolder: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    setForceStart: ReturnType<typeof vi.fn>;
    setDownloadLimit: ReturnType<typeof vi.fn>;
    setUploadLimit: ReturnType<typeof vi.fn>;
    setShareLimits: ReturnType<typeof vi.fn>;
    setCategory: ReturnType<typeof vi.fn>;
    clearCategory: ReturnType<typeof vi.fn>;
    addTags: ReturnType<typeof vi.fn>;
    removeTags: ReturnType<typeof vi.fn>;
    reannounce: ReturnType<typeof vi.fn>;
  };
  let toastInfo: ReturnType<typeof vi.fn>;
  let toastDanger: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    torrentsMap = signal(new Map());
    mockLogMain = vi.fn().mockResolvedValue([]);
    toastInfo = vi.fn();
    toastDanger = vi.fn();
    qbTorrents = {
      properties: vi.fn().mockResolvedValue({}),
      files: vi.fn().mockResolvedValue([]),
      rename: vi.fn(),
      renameFile: vi.fn(),
      renameFolder: vi.fn(),
      resume: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockResolvedValue(undefined),
      setForceStart: vi.fn().mockResolvedValue(undefined),
      setDownloadLimit: vi.fn().mockResolvedValue(undefined),
      setUploadLimit: vi.fn().mockResolvedValue(undefined),
      setShareLimits: vi.fn().mockResolvedValue(undefined),
      setCategory: vi.fn(),
      clearCategory: vi.fn().mockResolvedValue(undefined),
      addTags: vi.fn(),
      removeTags: vi.fn().mockResolvedValue(undefined),
      reannounce: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [General],
      providers: [
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        {
          provide: TorrentStoreService,
          useValue: { torrentsMap },
        },
        {
          provide: QbService,
          useValue: {
            torrents: qbTorrents,
            log: {
              main: mockLogMain,
            },
          },
        },
        {
          provide: CommandBusService,
          useValue: { commands$: new Subject<any>().asObservable(), emit: vi.fn() },
        },
        {
          provide: GeneralSettingsService,
          useValue: {
            load: vi.fn().mockResolvedValue({ behavior: {} }),
            asObservable: vi.fn().mockReturnValue(of({ behavior: {} })),
          },
        },
        { provide: PathService, useValue: { resolveLocalPath: vi.fn().mockResolvedValue(null) } },
        { provide: Clipboard, useValue: { copy: vi.fn() } },
        {
          provide: ToastService,
          useValue: { success: vi.fn(), info: toastInfo, danger: toastDanger },
        },
        provideTimeago({ intl: { provide: TimeagoIntl, useClass: TimeagoIntl } }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(General);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('hash', 'abc123');
    fixture.detectChanges();
  });
```

Then add this new `describe` block right after the `errorLog effect` describe block closes (i.e. after the `});` that closes `describe('errorLog effect', ...)`, before `describe('toggleErrorLog', ...)`):

```ts
describe('action handlers', () => {
  beforeEach(() => {
    torrentsMap.set(
      new Map([
        [
          'abc123',
          makeTorrent({
            ratio_limit: 1.5,
            seeding_time_limit: 60,
            inactive_seeding_time_limit: 30,
            tags: 'a, b',
          }),
        ],
      ]),
    );
    component.properties.set(makeProperties());
    fixture.detectChanges();
  });

  describe('resume', () => {
    it('shows an info toast and resumes the torrent', async () => {
      await component.resume();

      expect(toastInfo).toHaveBeenCalledWith(
        'components.modals.torrent-details.general.toast.resuming',
      );
      expect(qbTorrents.resume).toHaveBeenCalledWith('server-1', ['abc123']);
    });

    it('shows a danger toast when resuming fails', async () => {
      qbTorrents.resume.mockRejectedValueOnce(new Error('boom'));

      await component.resume();

      expect(toastDanger).toHaveBeenCalledWith(
        'boom',
        'components.modals.torrent-details.general.toast.resume-failed',
      );
    });
  });

  describe('pause', () => {
    it('shows an info toast and pauses the torrent', async () => {
      await component.pause();

      expect(toastInfo).toHaveBeenCalledWith(
        'components.modals.torrent-details.general.toast.pausing',
      );
      expect(qbTorrents.pause).toHaveBeenCalledWith('server-1', ['abc123']);
    });

    it('shows a danger toast when pausing fails', async () => {
      qbTorrents.pause.mockRejectedValueOnce(new Error('boom'));

      await component.pause();

      expect(toastDanger).toHaveBeenCalledWith(
        'boom',
        'components.modals.torrent-details.general.toast.pause-failed',
      );
    });
  });

  describe('forceResume', () => {
    it('shows an info toast and force-resumes the torrent', async () => {
      await component.forceResume();

      expect(toastInfo).toHaveBeenCalledWith(
        'components.modals.torrent-details.general.toast.force-resuming',
      );
      expect(qbTorrents.setForceStart).toHaveBeenCalledWith('server-1', ['abc123'], true);
    });

    it('shows a danger toast when force-resuming fails', async () => {
      qbTorrents.setForceStart.mockRejectedValueOnce(new Error('boom'));

      await component.forceResume();

      expect(toastDanger).toHaveBeenCalledWith(
        'boom',
        'components.modals.torrent-details.general.toast.force-resume-failed',
      );
    });
  });

  describe('clearDownloadLimit', () => {
    it('shows an info toast and clears the download limit', async () => {
      await component.clearDownloadLimit();

      expect(toastInfo).toHaveBeenCalledWith(
        'components.modals.torrent-details.general.toast.clearing-download-limit',
      );
      expect(qbTorrents.setDownloadLimit).toHaveBeenCalledWith('server-1', 0, ['abc123']);
    });

    it('shows a danger toast when clearing the download limit fails', async () => {
      qbTorrents.setDownloadLimit.mockRejectedValueOnce(new Error('boom'));

      await component.clearDownloadLimit();

      expect(toastDanger).toHaveBeenCalledWith(
        'boom',
        'components.modals.torrent-details.general.toast.clear-download-limit-failed',
      );
    });
  });

  describe('clearUploadLimit', () => {
    it('shows an info toast and clears the upload limit', async () => {
      await component.clearUploadLimit();

      expect(toastInfo).toHaveBeenCalledWith(
        'components.modals.torrent-details.general.toast.clearing-upload-limit',
      );
      expect(qbTorrents.setUploadLimit).toHaveBeenCalledWith('server-1', 0, ['abc123']);
    });

    it('shows a danger toast when clearing the upload limit fails', async () => {
      qbTorrents.setUploadLimit.mockRejectedValueOnce(new Error('boom'));

      await component.clearUploadLimit();

      expect(toastDanger).toHaveBeenCalledWith(
        'boom',
        'components.modals.torrent-details.general.toast.clear-upload-limit-failed',
      );
    });
  });

  describe('clearRatioLimit', () => {
    it('shows an info toast and clears the ratio limit, keeping the other share limits', async () => {
      await component.clearRatioLimit();

      expect(toastInfo).toHaveBeenCalledWith(
        'components.modals.torrent-details.general.toast.clearing-ratio-limit',
      );
      expect(qbTorrents.setShareLimits).toHaveBeenCalledWith('server-1', ['abc123'], -1, 60, 30);
    });

    it('shows a danger toast when clearing the ratio limit fails', async () => {
      qbTorrents.setShareLimits.mockRejectedValueOnce(new Error('boom'));

      await component.clearRatioLimit();

      expect(toastDanger).toHaveBeenCalledWith(
        'boom',
        'components.modals.torrent-details.general.toast.clear-ratio-limit-failed',
      );
    });
  });

  describe('clearSeedingTimeLimit', () => {
    it('shows an info toast and clears the seeding time limit, keeping the other share limits', async () => {
      await component.clearSeedingTimeLimit();

      expect(toastInfo).toHaveBeenCalledWith(
        'components.modals.torrent-details.general.toast.clearing-seeding-time-limit',
      );
      expect(qbTorrents.setShareLimits).toHaveBeenCalledWith('server-1', ['abc123'], 1.5, -1, 30);
    });

    it('shows a danger toast when clearing the seeding time limit fails', async () => {
      qbTorrents.setShareLimits.mockRejectedValueOnce(new Error('boom'));

      await component.clearSeedingTimeLimit();

      expect(toastDanger).toHaveBeenCalledWith(
        'boom',
        'components.modals.torrent-details.general.toast.clear-seeding-time-limit-failed',
      );
    });
  });

  describe('clearInactiveSeedingTimeLimit', () => {
    it('shows an info toast and clears the inactive seeding time limit, keeping the other share limits', async () => {
      await component.clearInactiveSeedingTimeLimit();

      expect(toastInfo).toHaveBeenCalledWith(
        'components.modals.torrent-details.general.toast.clearing-inactive-seeding-time-limit',
      );
      expect(qbTorrents.setShareLimits).toHaveBeenCalledWith('server-1', ['abc123'], 1.5, 60, -1);
    });

    it('shows a danger toast when clearing the inactive seeding time limit fails', async () => {
      qbTorrents.setShareLimits.mockRejectedValueOnce(new Error('boom'));

      await component.clearInactiveSeedingTimeLimit();

      expect(toastDanger).toHaveBeenCalledWith(
        'boom',
        'components.modals.torrent-details.general.toast.clear-inactive-seeding-time-limit-failed',
      );
    });
  });

  describe('removeCategory', () => {
    it('shows an info toast and clears the category', async () => {
      await component.removeCategory();

      expect(toastInfo).toHaveBeenCalledWith(
        'components.modals.torrent-details.general.toast.removing-category',
      );
      expect(qbTorrents.clearCategory).toHaveBeenCalledWith('server-1', ['abc123']);
    });

    it('shows a danger toast when removing the category fails', async () => {
      qbTorrents.clearCategory.mockRejectedValueOnce(new Error('boom'));

      await component.removeCategory();

      expect(toastDanger).toHaveBeenCalledWith(
        'boom',
        'components.modals.torrent-details.general.toast.remove-category-failed',
      );
    });
  });

  describe('removeAllTags', () => {
    it('shows an info toast and removes the parsed tag list', async () => {
      await component.removeAllTags();

      expect(toastInfo).toHaveBeenCalledWith(
        'components.modals.torrent-details.general.toast.removing-all-tags',
      );
      expect(qbTorrents.removeTags).toHaveBeenCalledWith('server-1', ['abc123'], ['a', 'b']);
    });

    it('shows a danger toast when removing all tags fails', async () => {
      qbTorrents.removeTags.mockRejectedValueOnce(new Error('boom'));

      await component.removeAllTags();

      expect(toastDanger).toHaveBeenCalledWith(
        'boom',
        'components.modals.torrent-details.general.toast.remove-all-tags-failed',
      );
    });
  });

  describe('forceReannounce', () => {
    it('shows an info toast and reannounces the torrent', async () => {
      await component.forceReannounce();

      expect(toastInfo).toHaveBeenCalledWith(
        'components.modals.torrent-details.general.toast.reannouncing',
      );
      expect(qbTorrents.reannounce).toHaveBeenCalledWith('server-1', ['abc123']);
    });

    it('shows a danger toast when reannouncing fails', async () => {
      qbTorrents.reannounce.mockRejectedValueOnce(new Error('boom'));

      await component.forceReannounce();

      expect(toastDanger).toHaveBeenCalledWith(
        'boom',
        'components.modals.torrent-details.general.toast.reannounce-failed',
      );
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=packages/app -- --include='src/app/components/modals/torrent-details/general/general.spec.ts' --watch=false`
Expected: FAIL. The 11 "shows a danger toast when X fails" tests all fail (current code never calls `toastService.danger` from any of these handlers). The "shows an info toast" tests for `clearRatioLimit`, `clearSeedingTimeLimit`, and `clearInactiveSeedingTimeLimit` also fail (those three currently show no toast at all). The remaining info-toast/call-args assertions may already pass since that wiring is unchanged - that's expected, not a problem; the failing tests above are the meaningful red signal for this step.

- [ ] **Step 3: Implement the uniform pattern in `general.ts`**

Replace the block from `public resume(): void {` through the end of `removeAllTags()`'s closing brace (`packages/app/src/app/components/modals/torrent-details/general/general.ts:254-398`) with:

```ts
  public async resume(): Promise<void> {
    this.toastService.info(
      this.translateService.instant('components.modals.torrent-details.general.toast.resuming'),
    );
    try {
      await this.qbService.torrents.resume(this.serverStoreService.currentServerId() as string, [
        this.hash(),
      ]);
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.resume-failed',
        ),
      );
    }
  }

  public async pause(): Promise<void> {
    this.toastService.info(
      this.translateService.instant('components.modals.torrent-details.general.toast.pausing'),
    );
    try {
      await this.qbService.torrents.pause(this.serverStoreService.currentServerId() as string, [
        this.hash(),
      ]);
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.pause-failed',
        ),
      );
    }
  }

  public async forceResume(): Promise<void> {
    this.toastService.info(
      this.translateService.instant(
        'components.modals.torrent-details.general.toast.force-resuming',
      ),
    );
    try {
      await this.qbService.torrents.setForceStart(
        this.serverStoreService.currentServerId() as string,
        [this.hash()],
        true,
      );
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.force-resume-failed',
        ),
      );
    }
  }

  public async clearDownloadLimit(): Promise<void> {
    this.toastService.info(
      this.translateService.instant(
        'components.modals.torrent-details.general.toast.clearing-download-limit',
      ),
    );
    try {
      await this.qbService.torrents.setDownloadLimit(
        this.serverStoreService.currentServerId() as string,
        0,
        [this.hash()],
      );
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.clear-download-limit-failed',
        ),
      );
    }
  }

  public async clearUploadLimit(): Promise<void> {
    this.toastService.info(
      this.translateService.instant(
        'components.modals.torrent-details.general.toast.clearing-upload-limit',
      ),
    );
    try {
      await this.qbService.torrents.setUploadLimit(
        this.serverStoreService.currentServerId() as string,
        0,
        [this.hash()],
      );
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.clear-upload-limit-failed',
        ),
      );
    }
  }

  public openShareLimitsModal(): void {
    this.commandBusService.emit({
      type: 'UI_LIMIT_SHARE',
      target: 'torrent',
      hashes: [this.hash()],
    });
  }

  public async clearRatioLimit(): Promise<void> {
    this.toastService.info(
      this.translateService.instant(
        'components.modals.torrent-details.general.toast.clearing-ratio-limit',
      ),
    );
    const t = this.torrent()!.data;
    try {
      await this.qbService.torrents.setShareLimits(
        this.serverStoreService.currentServerId() as string,
        [this.hash()],
        -1,
        t.seeding_time_limit,
        t.inactive_seeding_time_limit,
      );
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.clear-ratio-limit-failed',
        ),
      );
    }
  }

  public async clearSeedingTimeLimit(): Promise<void> {
    this.toastService.info(
      this.translateService.instant(
        'components.modals.torrent-details.general.toast.clearing-seeding-time-limit',
      ),
    );
    const t = this.torrent()!.data;
    try {
      await this.qbService.torrents.setShareLimits(
        this.serverStoreService.currentServerId() as string,
        [this.hash()],
        t.ratio_limit,
        -1,
        t.inactive_seeding_time_limit,
      );
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.clear-seeding-time-limit-failed',
        ),
      );
    }
  }

  public async clearInactiveSeedingTimeLimit(): Promise<void> {
    this.toastService.info(
      this.translateService.instant(
        'components.modals.torrent-details.general.toast.clearing-inactive-seeding-time-limit',
      ),
    );
    const t = this.torrent()!.data;
    try {
      await this.qbService.torrents.setShareLimits(
        this.serverStoreService.currentServerId() as string,
        [this.hash()],
        t.ratio_limit,
        t.seeding_time_limit,
        -1,
      );
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.clear-inactive-seeding-time-limit-failed',
        ),
      );
    }
  }

  public async forceReannounce(): Promise<void> {
    this.toastService.info(
      this.translateService.instant(
        'components.modals.torrent-details.general.toast.reannouncing',
      ),
    );
    try {
      await this.qbService.torrents.reannounce(
        this.serverStoreService.currentServerId() as string,
        [this.hash()],
      );
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.reannounce-failed',
        ),
      );
    }
  }

  public changeCategory(): void {
    this.commandBusService.emit({
      type: 'UI_SET_TORRENT_CATEGORY',
      torrent: this.torrent()!.data,
      hashes: [this.hash()],
    });
  }

  public async removeCategory(): Promise<void> {
    this.toastService.info(
      this.translateService.instant(
        'components.modals.torrent-details.general.toast.removing-category',
      ),
    );
    try {
      await this.qbService.torrents.clearCategory(
        this.serverStoreService.currentServerId() as string,
        [this.hash()],
      );
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.remove-category-failed',
        ),
      );
    }
  }

  public changeTags(): void {
    this.commandBusService.emit({
      type: 'UI_SET_TORRENT_TAGS',
      torrent: this.torrent()!.data,
      hashes: [this.hash()],
    });
  }

  public async removeAllTags(): Promise<void> {
    this.toastService.info(
      this.translateService.instant(
        'components.modals.torrent-details.general.toast.removing-all-tags',
      ),
    );
    try {
      await this.qbService.torrents.removeTags(
        this.serverStoreService.currentServerId() as string,
        [this.hash()],
        this.torrent()!
          .data.tags.split(',')
          .map((t) => t.trim()),
      );
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.remove-all-tags-failed',
        ),
      );
    }
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=packages/app -- --include='src/app/components/modals/torrent-details/general/general.spec.ts' --watch=false`
Expected: PASS (all existing tests plus the 22 new action-handler tests pass).

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/modals/torrent-details/general/general.ts packages/app/src/app/components/modals/torrent-details/general/general.spec.ts
git commit -m "#178: make general tab toasts uniform across action handlers"
```

---

## Task 4: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Lint the whole app**

Run: `npm run lint`
Expected: exits 0, no warnings or errors.

- [ ] **Step 2: Run the full app test suite**

Run: `npm run test --workspace=packages/app -- --watch=false`
Expected: all test files pass (no regressions outside the files touched in Tasks 1-3).

- [ ] **Step 3: Manually sanity-check in the running app (optional but recommended)**

Run: `npm start`, open a torrent's details modal, General tab, and click resume/pause/force-resume/clear download limit/clear upload limit/clear ratio limit/clear seeding time limit/clear inactive seeding time limit/remove category/remove all tags/force reannounce. Confirm each shows the new info toast wording and that the buttons remain responsive (no thrown errors in the devtools console).
