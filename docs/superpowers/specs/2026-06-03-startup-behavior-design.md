# Startup Behavior Settings Redesign

**Date:** 2026-06-03
**Branch:** 122-optional-server-credentials

## Background

The general settings page has a "Startup" fieldset with two switches:

- **Start with system** (`openAtLogin`) - registers the app as a login item via Electron
- **Start minimized** (`startMinimized`) - starts the app in the system tray instead of showing the window

Since server password is now optional, the concept of a "default server" (a server with `auto_login: true`) no longer needs to be a hard prerequisite for enabling startup options. The existing gate (`hasDefaultServer()` must be true before `openAtLogin` can be enabled) is unnecessarily restrictive.

## Goal

Allow users to enable "Start with system" and "Start minimized" independently of whether any server is marked as the default (auto-login) host. When no default host exists and the user enables "Start with system", show a contextual hint explaining that the app will start but won't log in automatically.

## What Does NOT Change

- The `GeneralSettings` model shape - `startup.openAtLogin` and `startup.startMinimized` are unchanged.
- The `ServerRecord.auto_login` flag - still the single source of truth for which server gets auto-connected on the login page.
- The login page auto-connect logic - if a server has `auto_login: true`, the login page still auto-connects to it unconditionally (unless suppressed after logout).
- The `startMinimized` dependency on `openAtLogin` - starting minimized only makes sense when starting automatically, so `startMinimized` remains disabled when `openAtLogin` is false.

## Changes

### `general.ts`

**Remove `hasDefaultServer()` from the enable/disable effect:**

Current logic enables `openAtLogin` only when `hasDefaultServer()` is true. New logic always enables `openAtLogin`. The effect simplifies to:

```
effect(() => {
  const openAtLoginCtrl = startupGroup.controls.openAtLogin;
  openAtLoginCtrl.enable({ emitEvent: false });

  const startMinimizedCtrl = startupGroup.controls.startMinimized;
  if (openAtLoginCtrl.value) {
    startMinimizedCtrl.enable({ emitEvent: false });
  } else {
    startMinimizedCtrl.disable({ emitEvent: false });
  }
});
```

**Remove the default-server guard in `save()`:**

The line `if (!this.hasDefaultServer()) settings.startup.openAtLogin = false;` is removed. The user's explicit choice is persisted as-is.

**`hasDefaultServer` stays** as a `computed()` signal - it drives the hint text visibility in the template.

### `general.html`

After the `startMinimized` switch row, inside the startup fieldset, add a conditional hint row:

```html
@if (generalSettingsForm.controls.startup.controls.openAtLogin.value && !hasDefaultServer()) {
<div class="row mb-3">
  <div class="col-12">
    <small class="text-warning">
      {{ 'pages.settings.tab.general.startup.no-default-host-hint' | translate }}
    </small>
  </div>
</div>
}
```

Visibility condition: `openAtLogin` switch is ON **and** no server has `auto_login: true`.

### i18n

One new translation key added to both `public/i18n/us.json` and `public/i18n/hu.json`:

```
"pages.settings.tab.general.startup.no-default-host-hint"
```

- English: `"No default host configured. The app will start but won't log in automatically."`
- Hungarian: `"Nincs alapértelmezett kiszolgáló beállítva. Az alkalmazás elindul, de nem fog automatikusan bejelentkezni."`

## Acceptance Criteria

- "Start with system" can be toggled regardless of whether any server has `auto_login: true`.
- "Start minimized" remains disabled when "Start with system" is off.
- When "Start with system" is on and no server has `auto_login: true`, the hint text is visible below the switches.
- When "Start with system" is on and at least one server has `auto_login: true`, no hint is shown.
- When "Start with system" is off, no hint is shown regardless of server state.
- Setting is persisted correctly and `setLoginItem` is called on save.
