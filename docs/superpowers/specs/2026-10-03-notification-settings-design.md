# Notification settings

Issue: #343

## Goal

Let the user decide which notifications they see, per channel (OS level and app level) and per event category. Today the only OS notification is "torrent finished", shown only while the app is minimized, and neither channel can be turned off.

## Settings UI

A new **Notifications** fieldset in the general settings (`packages/app/src/app/modals/settings/general/general.html`), using the existing `bb-option` pattern. It has two sections. Each section's master switch has a description under its label and acts as the section header.

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

## Dispatcher

`NotificationDispatcher` is a root service in the renderer. The decision is made there because it already has the window state and the settings.

```
notify({ category, title, body, toastType })
```

- Categories: `finished`, `errors`, `updates`, `confirmations`.
- **OS channel** fires when `os.enabled`, the category switch is on, and either `onlyWhenMinimized` is false or the window is minimized. `confirmations` never goes to the OS channel.
- **App channel** fires when `app.enabled` and the category switch is on.
- The channels are independent: with both on and a visible window, the user gets an OS notification and a toast.
- OS delivery goes through the existing `NotificationService.send`.

**Dedupe.** An identical OS notification (same title and body) within a short window (5 s) is shown once. The window is a named constant. Dedupe applies to the OS channel only.

## ToastService integration

The 126 existing toast call sites stay unchanged. `ToastService` derives the category from the toast type and routes through the dispatcher:

- `danger`, `warning` -> `errors`
- all other types -> `confirmations`

Only the torrent-finished and update-available events pass an explicit category.

`ToastService` reads the toast position from `notifications.app.position`.

## app.ts

The `finished$` handler collapses to a single `notify({ category: 'finished', ... })` call. The `isMinimized` branching moves into the dispatcher.

## Testing

- Dispatcher unit tests: the matrix of channel, category, master switch, `onlyWhenMinimized` and minimized state; `confirmations` never reaching the OS; dedupe within and after the window.
- Settings tests: defaults, migration of a stored settings object without `notifications`, and `toastPosition` carry-over.
- `ToastService` tests: type to category mapping, and drop when the app category is off.
- `app.ts` test: the finished handler makes one dispatcher call.
- General settings component: child controls disable with their master switch.

## Out of scope

- Per-toast granularity.
- User guide and screenshots, updated near PR time.
