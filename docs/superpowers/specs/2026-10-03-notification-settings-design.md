# Notification settings

Issue: #343

## Goal

Let the user decide which notifications they see, per channel (OS level and app level) and per event category. Today the only OS notification is "torrent finished", shown only while the app is minimized, and neither channel can be turned off.

## Settings UI

A new **Notifications** fieldset in the general settings, placed directly below Startup (`packages/app/src/app/modals/settings/general/general.html`), using the existing `bb-option` pattern. It has two sections. Each section's master switch has a description under its label and acts as the section header.

**OS level notifications**

- Master switch: "Enable OS level notifications"
- "Show only when the app is minimized" (full-width switch)
- Category switches: Torrent finished, Errors, Update available

**App level notifications**

- Master switch: "Enable app level notifications"
- Toast position dropdown (moved from the Appearance fieldset)
- Category switches: Torrent finished, Errors, Update available, Action confirmations

Child controls are disabled while their master switch is off. Labels and descriptions go in `us.json` and `hu.json`.

## Settings model

`GeneralSettings.notifications` is a new block. `behavior.toastPosition` moves to `notifications.app.position`.

```
notifications: {
  os:  { enabled, onlyWhenMinimized, finished, errors, updates }
  app: { enabled, position, finished, errors, updates, confirmations }
}
```

Defaults:

| Setting                                                | Default          |
| ------------------------------------------------------ | ---------------- |
| `os.enabled`, `os.finished`, `os.errors`, `os.updates` | `true`           |
| `os.onlyWhenMinimized`                                 | `false`          |
| `app.*` switches                                       | `true`           |
| `app.position`                                         | `'bottom-right'` |

**Migration.** Stored settings without a `notifications` block get the defaults above, with `position` taken from the old `behavior.toastPosition`. Existing users therefore start receiving OS notifications while the window is visible. This is an intentional change from the previous minimized-only behavior and can be turned off with "Show only when the app is minimized" or the master switch.

## Policy service

`NotificationPolicyService` is a root service in the renderer. It holds the current notification settings (from `GeneralSettingsService`, defaults until loaded) and reads the window state from `WindowService`. It has no dependency on `ToastService`, which avoids a circular dependency.

- `allowApp(category)`: `app.enabled` and the category switch.
- `allowOs(category, title, body)`: false for `confirmations`; otherwise `os.enabled`, the category switch, and either `onlyWhenMinimized` is false or the window is minimized; finally the dedupe check.
- **Dedupe.** An identical OS notification (same title and body) within 5 s (`OS_DEDUPE_WINDOW_MS`) is shown once. Only a call that would otherwise be allowed is recorded. Dedupe applies to the OS channel only.
- The channels are independent: with both on and a visible window, the user gets an OS notification and a toast.

## ToastService routing

`ToastService.showHtml` is the single routing point; the 126 existing call sites do not change.

- The category is `opts.category`, else derived from the toast type: `danger`, `warning` -> `errors`; all other types -> `confirmations`.
- If `allowOs(category, title, plainText)` is true it sends an OS notification through `NotificationService.send` (the message HTML is reduced to plain text, `<br>` becoming a newline).
- If `allowApp(category)` is false the toast is not shown and `showHtml` returns `''`.
- The toast position is read from `notifications.app.position`.

Explicit categories: the torrent-finished event (`finished`) and a new info toast "Update Available" shown on top of the update modal whenever an update is found (`updates`).

## app.ts

The `finished$` handler becomes a single `toastService.showText(name, { title, type: 'success', category: 'finished' })` call. The `isMinimized` branching moves into the policy service.

## Testing

- Policy service unit tests: the matrix of channel, category, master switch, `onlyWhenMinimized` and minimized state; `confirmations` never reaching the OS; dedupe within and after the window.
- Settings tests: defaults, migration of a stored settings object without `notifications`, and `toastPosition` carry-over.
- `ToastService` tests: category derivation and override, gating, OS send with plain text, `dismiss('')` safety.
- `app.ts` test: the finished handler passes the `finished` category.
- Update handler test: the info toast is shown with the `updates` category when an update is found, and not for a skipped version.
- General settings component: child controls disable with their master switch.

## Out of scope

- Per-toast granularity.
- User guide and screenshots, updated near PR time.
