# Pause Polling Design

**Date:** 2026-06-26

## Summary

Allow the user to manually pause and resume background maindata polling by clicking the polling-indicator widget in the status bar. When paused, no network requests are made, the ring animation stops, and the center icon switches from play to pause. The rid (revision id) is preserved across pause/resume so no incremental updates are lost. The pause mechanism is designed to support multiple independent pause sources (user action, future modal auto-pause, etc.).

---

## 1. `QbPollingService` changes

### Reason-set based pause state

Replace a hypothetical boolean toggle with a `Set<string>` of active pause reasons. Polling is paused whenever the set is non-empty. This allows multiple independent consumers to pause/resume without interfering with each other.

```typescript
private readonly _pauseReasons$ = new BehaviorSubject<Set<string>>(new Set());
public readonly isPaused$: Observable<boolean> = this._pauseReasons$.pipe(
  map(reasons => reasons.size > 0),
  distinctUntilChanged(),
);

public pause(reason: string): void {
  const next = new Set(this._pauseReasons$.value);
  next.add(reason);
  this._pauseReasons$.next(next);
}

public resume(reason: string): void {
  const next = new Set(this._pauseReasons$.value);
  next.delete(reason);
  this._pauseReasons$.next(next);
}
```

Known pause reasons (string constants to avoid typos):

- `'user'` - manual toggle from the status bar widget
- Future: `'modal'` - automatic pause while any modal is open (separate issue)

### `createBackgroundPoll` changes

Add `isPaused$` to the existing `combineLatest`. When paused, `switchMap` returns `EMPTY` - the interval stops, no network calls are made, and `maindataRid$` retains its last value. On resume, `combineLatest` emits again; `startWith(0)` inside the new interval causes an immediate fetch using the preserved rid, so the server sends only the delta since the last response.

```typescript
const isPaused$ = this.isPaused$;

return combineLatest([settings$, windowState$, isPaused$]).pipe(
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

`stopPolling()` calls `this._pauseReasons$.next(new Set())` to clear all pause reasons, in addition to its existing behavior - so navigating away or logging out never leaves stale pause state.

### Peers polling

`startPeersPolling` is unaffected. It continues using `pollingInterval$` independently and has no pause awareness. When main polling is paused, the torrent details peers tab keeps updating. This is intentional for this issue.

---

## 2. `ServerState` component changes

### New signal and method

```typescript
public isPaused = toSignal(this.pollingService.isPaused$, { initialValue: false });

public togglePolling(): void {
  if (this.isPaused()) {
    this.pollingService.resume('user');
  } else {
    this.pollingService.pause('user');
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

Any service can pause/resume polling independently using named reasons:

```typescript
// In a modal service or command handler:
pollingService.pause('modal'); // on open
pollingService.resume('modal'); // on close
```

Polling resumes only when all reasons are cleared. The `isPaused$` observable (boolean) remains the public contract - consumers do not need to know about the internal set.
