# Options Toggle Feedback

## Context

The General tab's Options card (added earlier this session) has 5 clickable
split buttons that call qBittorrent-backed toggle methods on
`TorrentDetailsActionsService`. Those calls take 1-2 seconds. Right now a
click gives no feedback until the button's color flips (on the next
maindata poll) or a danger toast appears on failure - there's no
indication the click registered, and nothing stops a second click before
the first finishes.

## Goal

Give immediate feedback on click and prevent double-submission, using the
patterns already established in this same service for other
qBittorrent-backed actions (`resume()`, `pause()`, `forceRecheck()`,
`forceReannounce()`).

## Design

`TorrentDetailsActionsService` gets one new signal:

```typescript
private readonly _pendingOptions = signal<ReadonlySet<string>>(new Set());
public readonly pendingOptions = this._pendingOptions.asReadonly();

public isOptionPending(key: string): boolean {
  return this._pendingOptions().has(key);
}
```

Each of the 5 toggle methods (`toggleAutoTmm`, `toggleForceStart`,
`toggleSequentialDownload`, `toggleFirstLastPiecePrio`,
`toggleSuperSeeding`) is restructured to:

1. Add its own key (`'auto-tmm'`, `'force-start'`, `'sequential-download'`,
   `'first-last-piece-prio'`, `'super-seeding'`) to `_pendingOptions`
   synchronously, before anything async happens.
2. Show an info toast in the same style as `resume()`/`pause()` -
   present-continuous verb phrase + ellipsis, default title, e.g.
   "Toggling Auto TMM…" - one new translation key per action (5 keys x
   2 locales), following the existing `toast.resuming` /
   `toast.rechecking` naming convention.
3. Call the qBittorrent API exactly as today; the existing danger toast
   on failure is unchanged.
4. Remove its key from `_pendingOptions` in a `finally` block, so the
   button re-enables whether the call succeeds or fails.

`general.html`'s 5 Options buttons each get
`[disabled]="actionsService.isOptionPending('<key>')"` - each button's
pending state is independent, so clicking one never blocks the others.

## Non-goals

- No change to the danger-toast-on-failure behavior, already correct.
- No change to any other action in `TorrentDetailsActionsService`
  (`resume`, `pause`, `forceResume`, `forceRecheck`, `forceReannounce`,
  etc.) - they already have their own in-progress toasts and don't route
  through per-button disabled state since they aren't dedicated toggle
  buttons.
- Disabling a button while its own action is pending is a legitimate,
  temporary loading state - distinct from the earlier design decision
  that these buttons must never look permanently non-interactive. Normal
  Bootstrap `:disabled` styling (dimmed, no pointer) during the 1-2s
  window is expected and desired here.

## Testing

- `torrent-details-actions.service.spec.ts`: each toggle method's pending
  key is set before the API call and cleared after, both on success and
  on failure (the `finally` path).
- `general.spec.ts`: each Options button's `[disabled]` binding reflects
  `actionsService.isOptionPending(...)` for its own key only.
