# General tab toast consistency (issue #178)

## Problem

`packages/app/src/app/components/modals/torrent-details/general/general.ts` has three
different behaviors across 11 conceptually similar action handlers:

- **Pattern A** (`resume`, `pause`, `forceResume`, `clearDownloadLimit`, `clearUploadLimit`,
  `removeCategory`, `removeAllTags`, `forceReannounce`): shows an info "in progress" toast,
  then calls the qBittorrent API with no `await`/`.catch` - failures are invisible to the user.
- **Pattern B** (`clearRatioLimit`, `clearSeedingTimeLimit`, `clearInactiveSeedingTimeLimit`):
  no toast at all, success or failure.
- None of the three patterns surfaces a failure.

The toast strings themselves are also terse/robotic ("Resuming.", "Clearing download limit.").

## Scope

This change is limited to the General tab of the Torrent Details modal:
`packages/app/src/app/components/modals/torrent-details/general/general.ts` (+ its template,
unchanged) and the two i18n files (`public/i18n/us.json`, `public/i18n/hu.json`).

## Design

### Uniform handler pattern

Every one of the 11 handlers becomes:

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
```

This mirrors the existing convention in `TorrentCommandHandlerService.handleDelete`: failure
toast title is translated, failure toast body is the raw `error.message` (untranslated - it
comes from `HttpError`/qBittorrent and isn't localized anywhere else in the codebase either).

Methods change from `void` to `async Promise<void>`. Template bindings (`(click)="resume()"`)
are unaffected by this.

Affected handlers: `resume`, `pause`, `forceResume`, `clearDownloadLimit`, `clearUploadLimit`,
`clearRatioLimit`, `clearSeedingTimeLimit`, `clearInactiveSeedingTimeLimit`, `removeCategory`,
`removeAllTags`, `forceReannounce`.

### Bug fix required for the pattern to work: `qb.service.ts` `clearCategory`

`clearCategory` is the only mutating call in the `torrents` namespace that never checks
`res.ok` / throws on failure (its sibling `setCategory` does). Without fixing this,
`removeCategory()`'s new `catch` block would never fire for real qBittorrent-side failures
(only for network-level failures that throw before reaching this code). Fix:

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

### Known accepted trade-off: possible double toast on failure

`QbService.request()` already shows its own generic toast (`services.qb.warning.connection-retry-*`
or `services.qb.error.request-failed-title`) when a request ultimately fails, before the error
propagates to the caller. That means a failure in, say, `resume()` could show that generic toast
_and_ the new specific "Failed to resume torrent" toast. This duplication already exists today for
the `delete` flow (`TorrentCommandHandlerService.handleDelete` follows the same try/catch +
translated-title pattern against the same `request()` plumbing). This design follows that existing,
accepted precedent rather than redesigning `QbService`'s notification flow - that's out of scope here.

### Wording

All keys live under `components.modals.torrent-details.general.toast.*` in both
`public/i18n/us.json` and `public/i18n/hu.json`. English wording below; Hungarian gets an
equivalent natural-language revision during implementation.

| Action                        | Info key (revised/new)                       | English text                              | Failure title key (new)                    | English text                                |
| ----------------------------- | -------------------------------------------- | ----------------------------------------- | ------------------------------------------ | ------------------------------------------- |
| resume                        | `resuming`                                   | Resuming the torrent…                     | `resume-failed`                            | Failed to resume torrent                    |
| pause                         | `pausing`                                    | Pausing the torrent…                      | `pause-failed`                             | Failed to pause torrent                     |
| forceResume                   | `force-resuming`                             | Force resuming the torrent…               | `force-resume-failed`                      | Failed to force resume torrent              |
| clearDownloadLimit            | `clearing-download-limit`                    | Clearing the download limit…              | `clear-download-limit-failed`              | Failed to clear download limit              |
| clearUploadLimit              | `clearing-upload-limit`                      | Clearing the upload limit…                | `clear-upload-limit-failed`                | Failed to clear upload limit                |
| clearRatioLimit               | `clearing-ratio-limit` (new)                 | Clearing the ratio limit…                 | `clear-ratio-limit-failed`                 | Failed to clear ratio limit                 |
| clearSeedingTimeLimit         | `clearing-seeding-time-limit` (new)          | Clearing the seeding time limit…          | `clear-seeding-time-limit-failed`          | Failed to clear seeding time limit          |
| clearInactiveSeedingTimeLimit | `clearing-inactive-seeding-time-limit` (new) | Clearing the inactive seeding time limit… | `clear-inactive-seeding-time-limit-failed` | Failed to clear inactive seeding time limit |
| removeCategory                | `removing-category`                          | Removing the category…                    | `remove-category-failed`                   | Failed to remove category                   |
| removeAllTags                 | `removing-all-tags`                          | Removing all tags…                        | `remove-all-tags-failed`                   | Failed to remove all tags                   |
| forceReannounce               | `reannouncing`                               | Reannouncing to trackers…                 | `reannounce-failed`                        | Failed to reannounce torrent                |

Unrelated existing toast keys in this file (`local-path-failed`, `copied-to-clipboard`) are
untouched.

## Testing

`general.spec.ts` currently has no coverage of these handlers. Add specs covering, per handler:
the info toast fires with the expected translation key, the underlying `qbService.torrents.*`
call is invoked, and on a rejected call the danger toast fires with the expected title key and
the error's message as body. Add a spec for the `clearCategory` fix in `qb.service.spec.ts`
(rejects with `HttpError` when `res.ok` is false).

## Out of scope

- Adding success toasts (user explicitly chose option 1 + 2, not option 3's "only confirm on
  success/failure" alternative - we're keeping the "in progress" toast).
- Fixing `QbService.request()`'s double-toast-on-failure behavior.
- Any other tab/page in the Torrent Details modal, or `TorrentCommandHandlerService`'s own
  pause/resume/reannounce handlers (grid/toolbar path) - those are a separate code path not
  covered by this issue's discussion.
