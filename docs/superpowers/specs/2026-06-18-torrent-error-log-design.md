# Torrent error log in the General tab

## Problem

When a torrent is in the `error` state, qBittorrent records the underlying reason (e.g. a file permission error) in its main log (`/api/v2/log/main`), but BitButler has no way to surface that reason to the user. The torrent-details modal's General tab currently only shows the bare state name (e.g. "Error") with no further detail.

## Goal

Add qBittorrent log API support to `QbService`, and surface the most relevant error log entry for an errored torrent directly in the General tab, in a collapsed-by-default row styled to stand out as an error.

## Non-goals

- `/api/v2/log/peers` is implemented in the service layer (nice-to-have, explicitly requested) but is not wired into any UI in this change.
- No persistence/dismissal of seen errors - the row simply reflects current log state.
- No handling of log types other than `Warning` (4) and `Critical` (8).

## Service layer (`packages/app/src/app/services/qb.service.ts`)

Add a new `log` namespace, consistent with the existing namespace-per-qBittorrent-API grouping (`auth`, `app`, `sync`, `torrents`, `transfer`):

```typescript
readonly log = {
  main: async (
    serverId: string,
    options: {
      normal?: boolean;
      info?: boolean;
      warning?: boolean;
      critical?: boolean;
      last_known_id?: number;
    } = {},
  ): Promise<QbLogEntry[]> => {
    const res = await this.request<QbLogEntry[]>(serverId, {
      path: '/api/v2/log/main',
      method: 'GET',
      query: { ...options },
    });
    if (res.ok) return res.body;
    throw new HttpError(res.status, res.statusText, `Failed to get main log`);
  },

  peers: async (
    serverId: string,
    options: { last_known_id?: number } = {},
  ): Promise<QbLogPeerEntry[]> => {
    const res = await this.request<QbLogPeerEntry[]>(serverId, {
      path: '/api/v2/log/peers',
      method: 'GET',
      query: { ...options },
    });
    if (res.ok) return res.body;
    throw new HttpError(res.status, res.statusText, `Failed to get peer log`);
  },
};
```

Option keys intentionally match qBittorrent's actual API parameter names (`last_known_id` is snake_case in the real API, unlike most other BitButler option objects) rather than translating to camelCase, to avoid a silent mismatch between the option key and the query param actually sent.

No Electron-side changes are required: `qbRequest` in `packages/electron/src/ipc/qbittorrent.ts` is a generic path/query/method passthrough with no path allowlist.

## Models (`packages/app/src/app/models/qbittorrent.model.ts`)

```typescript
export enum QbLogMessageType {
  Normal = 1,
  Info = 2,
  Warning = 4,
  Critical = 8,
}

export interface QbLogEntry {
  id: number;
  message: string;
  timestamp: number;
  type: QbLogMessageType;
}

export interface QbLogPeerEntry {
  id: number;
  ip: string;
  timestamp: number;
  blocked: boolean;
  reason: string;
}
```

Enum names match qBittorrent's own WebUI API documentation bit values (`Normal=1, Info=2, Warning=4, Critical=8`).

## Component logic (`packages/app/src/app/components/modals/torrent-details/general/general.ts`)

### Fetch trigger

A reactive `effect()` (added alongside the existing local-path-resolution effect in the constructor) watches `this.torrent()?.data?.state`. When state transitions into `'error'`, it fetches `/log/main` once for this "error episode" and stores the most relevant match. When state leaves `'error'`, the stored match is cleared and the one-time guard resets. This avoids re-fetching the log on every 2s `load()` poll tick (and on every other torrent-map update, which can fire much more often) while the torrent sits in the error state.

The one-time guard is tracked via a plain closure variable rather than `errorLog() !== null`, because "no match found" is a valid outcome that must still suppress further attempts for the same episode - otherwise an errored torrent whose log has no matching entry would re-trigger a fetch on every signal change while it remains errored.

```typescript
public errorLog: WritableSignal<QbLogEntry | null> = signal(null);
public errorLogExpanded = signal(false);

// in constructor, alongside the existing localPath effect:
let hasAttemptedErrorLogFetch = false;

effect(async () => {
  const state = this.torrent()?.data?.state;
  const serverId = this.serverStoreService.currentServerId();
  const name = this.torrent()?.data?.name;

  if (state !== 'error') {
    hasAttemptedErrorLogFetch = false;
    this.errorLog.set(null);
    return;
  }

  if (hasAttemptedErrorLogFetch || !serverId || !name) return;
  hasAttemptedErrorLogFetch = true;

  try {
    const entries = await this.qbService.log.main(serverId, {
      normal: false,
      info: false,
      warning: true,
      critical: true,
    });

    const matches = entries.filter(
      (e) =>
        (e.type === QbLogMessageType.Warning || e.type === QbLogMessageType.Critical) &&
        e.message.includes(name),
    );

    if (matches.length > 0) {
      this.errorLog.set(matches.reduce((a, b) => (b.id > a.id ? b : a)));
    }
  } catch (error: any) {
    console.error(General.name, 'errorLog effect', 'Failed to fetch log entries', error);
  }
});
```

### Matching rule

A log entry is considered relevant to the current torrent when:

- `type` is `Warning` (4) or `Critical` (8) (matches the `warning: true, critical: true` query params), AND
- `message` contains the torrent's name as a substring.

When multiple entries match, the one with the highest `id` (most recent) is used.

### Message parsing

```typescript
public parseFileErrorReason(message: string): { reason: string; short: string } {
  const match = message.match(/Reason:\s*"(.*)"\s*$/);
  const reason = match ? match[1] : message;
  const errorMatch = reason.match(/error:\s*(.+)$/i);
  const short = errorMatch ? errorMatch[1] : reason;
  return { reason, short };
}

public rawLogJson(entry: QbLogEntry): string {
  return JSON.stringify(entry, null, 4);
}

public toggleErrorLog(): void {
  this.errorLogExpanded.update((v) => !v);
}
```

`parseFileErrorReason` extracts:

- `short` - the part after `error:` inside the Reason text (e.g. `"Permission denied"`), shown in the collapsed row.
- `reason` - the full Reason text, shown when expanded.

Both fall back gracefully to the raw message if the expected `Reason: "..."` / `error: ...` pattern isn't found (e.g. a Critical-type entry that isn't a file-error-alert shape).

## Template (`general.html`)

New block inserted immediately after the existing "State" row, inside the same `row gy-2` of the "Torrent" fieldset:

```html
@if (errorLog(); as entry) {
<div class="col-12 bb-section bb-section--danger">
  <button type="button" class="error-toggle" (click)="toggleErrorLog()">
    <span class="section-header"
      >{{ 'components.modals.torrent-details.general.error' | translate }}</span
    >
    <span class="section-value">{{ parseFileErrorReason(entry.message).short }}</span>
    <span
      class="error-toggle__icon"
      [class.error-toggle__icon--expanded]="errorLogExpanded()"
    ></span>
  </button>

  <div [ngbCollapse]="!errorLogExpanded()">
    <div class="error-toggle__detail">
      <span class="section-header"
        >{{ 'components.modals.torrent-details.general.reason' | translate }}</span
      >
      <span class="section-value">{{ parseFileErrorReason(entry.message).reason }}</span>
      <pre>{{ rawLogJson(entry) }}</pre>
    </div>
  </div>
</div>
}
```

`NgbCollapse` is added to the component's `imports` array (it's already an app dependency via `@ng-bootstrap/ng-bootstrap`, used elsewhere via `NgbAccordionModule`/`NgbTooltip`).

## Styling (`general.scss`)

```scss
div.bb-section.bb-section--danger {
  background-color: var(--bs-danger);

  span.section-header,
  span.section-value {
    color: var(--bb-danger-ink);
  }

  &:hover,
  &:focus-within {
    background-color: color-mix(in srgb, var(--bs-danger) 85%, black);
  }

  .error-toggle {
    display: block;
    width: 100%;
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .error-toggle__icon {
    position: absolute;
    right: 15px;
    top: 50%;
    width: 1.25rem;
    height: 1.25rem;
    transform: translateY(-50%);
    background-color: var(--bb-danger-ink);
    mask-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill-rule='evenodd' d='M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z'/%3e%3c/svg%3e");
    mask-repeat: no-repeat;
    mask-size: contain;
    transition: transform 0.2s ease-in-out;

    &--expanded {
      transform: translateY(-50%) rotate(-180deg);
    }
  }

  .error-toggle__detail {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid color-mix(in srgb, var(--bb-danger-ink) 30%, transparent);

    pre {
      margin: 8px 0 0;
      white-space: pre-wrap;
      word-break: break-word;
      background: color-mix(in srgb, black 20%, transparent);
      color: var(--bb-danger-ink);
      padding: 8px;
      border-radius: 4px;
      font-size: 0.8rem;
    }
  }
}
```

This reuses the existing `--bs-danger` / `--bb-danger-ink` theme tokens (defined per-theme in `packages/app/src/styles/themes/*`), so it renders correctly across every theme and both light/dark variants without new theme-level variables.

The chevron reuses the same SVG mask technique already used for the global `.accordion-button` chevron in `packages/app/src/styles.scss:1148-1155`, scoped locally to this component and colored with `--bb-danger-ink` instead of `--bs-primary`, since this toggle is a plain button (not an `ngbAccordion`) styled to match the surrounding `bb-section` rows rather than Bootstrap's accordion chrome.

## i18n

Add to both `public/i18n/us.json` and `public/i18n/hu.json` under `modals.torrent-details.general`:

```json
"error": "Error",
"reason": "Reason",
```

(Hungarian equivalents added at implementation time.) The existing `section-header` CSS already uppercases the text, so the label renders as "ERROR" consistent with every other label on the page.

## Testing

- Unit tests for `QbService.log.main` / `QbService.log.peers` (request shape, query params, error handling) following the existing `qb.service.spec.ts` patterns for other namespaces.
- Unit tests for `General`'s `parseFileErrorReason` covering: the documented Reason/error pattern, a message with `Reason: "..."` but no `error:` substring, and a message with no `Reason:` section at all.
- Unit tests for the error-log effect: verifies it fetches on transition into `'error'`, does not re-fetch while remaining in `'error'` (including when no match was found), clears `errorLog` and resets the guard on leaving `'error'`, and picks the highest-`id` match when multiple entries match.
- Component test asserting the danger row only renders when `errorLog()` is set, and that `toggleErrorLog()` flips `errorLogExpanded()`.
