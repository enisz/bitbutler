# Pause Polling Design

**Date:** 2026-06-26

## Summary

Allow the user to manually pause and resume background maindata polling by clicking the polling-indicator widget in the status bar. When paused, no network requests are made, the ring animation stops, and the center icon switches from play to pause. The rid (revision id) is preserved across pause/resume so no incremental updates are lost. The pause mechanism uses opaque tokens so any number of independent consumers can pause/resume without coordinating or naming anything.

---

## 1. `QbPollingService` changes

### Token-set based pause state

`pause()` returns a unique `symbol` token. `resume(token)` removes it. Polling is paused whenever any token is held. Callers need no knowledge of each other - they just hold their token and return it when done.

```typescript
private readonly _pauseTokens$ = new BehaviorSubject<Set<symbol>>(new Set());
public readonly isPaused$: Observable<boolean> = this._pauseTokens$.pipe(
  map(tokens => tokens.size > 0),
  distinctUntilChanged(),
);

public pause(): symbol {
  const token = Symbol();
  const next = new Set(this._pauseTokens$.value);
  next.add(token);
  this._pauseTokens$.next(next);
  return token;
}

public resume(token: symbol): void {
  const next = new Set(this._pauseTokens$.value);
  next.delete(token);
  this._pauseTokens$.next(next);
}
```

`stopPolling()` calls `this._pauseTokens$.next(new Set())` to clear all tokens, so navigating away or logging out never leaves stale pause state.

### `createBackgroundPoll` changes

Add `isPaused$` to the existing `combineLatest`. When paused, `switchMap` returns `EMPTY` - the interval stops, no network calls are made, and `maindataRid$` retains its last value. On resume, `combineLatest` emits again; `startWith(0)` inside the new interval causes an immediate fetch using the preserved rid, so the server sends only the delta since the last response.

```typescript
return combineLatest([settings$, windowState$, this.isPaused$]).pipe(
  takeUntil(this.stopPolling$),
  map(([settings, windowState, isPaused]) => ({
    pollMs: (windowState?.isMinimized ? settings?.polling?.background : settings?.polling?.foreground) ?? 2000,
    isPaused,
  })),
  distinctUntilChanged((a, b) => a.pollMs === b.pollMs && a.isPaused === b.isPaused),
  tap(({ pollMs, isPaused }) => { if (!isPaused) this._pollingInterval$.next(pollMs); }),
  switchMap(({ pollMs, isPaused }) => {
    if (isPaused) return EMPTY;
    return interval(pollMs).pipe(
      startWith(0),
      tap(() => this._onPoll$.next()),
      exhaustMap(() => from(this.qb.sync.maindata(serverId, this.maindataRid$.value)).pipe(...)),
    );
  }),
);
```

The `tap` only updates `_pollingInterval$` when not paused to avoid spuriously restarting peers polling on toggle (the interval value hasn't changed, only `isPaused` did).

### Peers polling

`startPeersPolling` is unaffected. It continues using `pollingInterval$` independently and has no pause awareness. When main polling is paused, the torrent details peers tab keeps updating. This is intentional for this issue.

---

## 2. `ServerState` component changes

### New signal and toggle method

The component holds a `_pauseToken` field. On pause it stores the token returned by `pollingService.pause()`; on resume it passes it back.

```typescript
public isPaused = toSignal(this.pollingService.isPaused$, { initialValue: false });

private _pauseToken: symbol | null = null;

public togglePolling(): void {
  if (this.isPaused()) {
    if (this._pauseToken) this.pollingService.resume(this._pauseToken);
    this._pauseToken = null;
  } else {
    this._pauseToken = this.pollingService.pause();
  }
}
```

### Animation reset on pause

An `effect()` watches `isPaused`. When it becomes `true`, `pollProgress` is reset to `0` immediately so the ring appears empty rather than staying at whatever progress it reached before the interval stopped.

```typescript
effect(() => {
  if (this.isPaused()) this.pollProgress.set(0);
});
```

### Icon replacement

The `.poll-dot` div is replaced with a `<fa-icon>` that shows `faPlay` when running and `faPause` when paused. Both icons are imported from `@fortawesome/free-solid-svg-icons`.

---

## 3. Template changes

The `polling-indicator` widget case gets:

- `cursor-pointer` class on the outer `.bb-widget` div
- `(click)="togglePolling()"` handler
- Tooltip switches between running and paused text
- `<fa-icon>` inside `.poll-container` replaces the `.poll-dot` div

```html
@case ('polling-indicator') {
<div
  class="bb-widget cursor-pointer"
  [ngbTooltip]="isPaused()
      ? ('pages.main.server-state.polling-paused' | translate)
      : ('pages.main.server-state.server-polling' | translate: { interval: pollingInterval() })"
  placement="top"
  container="body"
  (click)="togglePolling()"
>
  <div class="poll-container" [style.--p]="pollProgress()">
    <fa-icon class="poll-icon" [icon]="isPaused() ? icons.faPause : icons.faPlay"></fa-icon>
  </div>
</div>
}
```

---

## 4. SCSS changes

- Remove `.poll-dot` rule
- Add `.poll-icon` rule to size the fa-icon to fit in the ~10px clear center of the ring (approximately `0.45rem` font-size, muted color)

```scss
.poll-icon {
  font-size: 0.45rem;
  color: var(--bs-primary);
  opacity: 0.7;
}
```

---

## 5. i18n changes

Add to both `us.json` and `hu.json` under the `pages.main.server-state` namespace:

- `server-polling` updated: `"Server Polling ({{interval}}s) - Click to Pause"`
- `polling-paused` added: `"Polling Paused - Click to Resume"`

---

## 6. Future extensibility

Any code can pause polling without coordinating with other consumers:

```typescript
// anywhere in the app:
const token = pollingService.pause(); // polling pauses
// ... do work ...
pollingService.resume(token); // polling resumes (if no other token is held)
```

Polling resumes only when all tokens are returned. The `isPaused$` observable (boolean) remains the public contract - consumers do not interact with the internal set.
