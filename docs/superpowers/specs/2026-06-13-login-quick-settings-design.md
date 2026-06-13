# Login screen quick settings

## Goal

Add three quick-access settings buttons to the login screen, below the "Manage
Servers" button: **Language**, **Theme Family**, and **Theme Mode**. Each is an
icon-only `btn-link` with a dropdown listing all available values. Selecting a
value applies it immediately and persists it to the database, mirroring the
equivalent controls on the Settings > General page.

## UI & Layout

A new row is added inside `.form-wrapper` (login.html), directly below the
existing `d-flex flex-column gap-3` block containing the Connect / Manage
Servers buttons:

```html
<div class="d-flex justify-content-end gap-2 mt-3">
  <!-- Language -->
  <div ngbDropdown container="body" placement="top-end">
    <button
      class="btn btn-link bb-quick-setting"
      ngbDropdownToggle
      [ngbTooltip]="'pages.settings.tab.general.label.language' | translate"
      [attr.aria-label]="'pages.settings.tab.general.label.language' | translate"
    >
      <fa-icon [icon]="icons.faLanguage" />
    </button>
    <div ngbDropdownMenu class="bb-toolbar-dropdown">...</div>
  </div>

  <!-- Theme Family -->
  <div ngbDropdown container="body" placement="top-end">
    <button
      class="btn btn-link bb-quick-setting"
      ngbDropdownToggle
      [ngbTooltip]="'pages.settings.tab.general.general-settings-form.appearance.family' | translate"
      [attr.aria-label]="'pages.settings.tab.general.general-settings-form.appearance.family' | translate"
    >
      <fa-icon [icon]="icons.faPalette" />
    </button>
    <div ngbDropdownMenu class="bb-toolbar-dropdown">...</div>
  </div>

  <!-- Theme Mode -->
  <div ngbDropdown container="body" placement="top-end">
    <button
      class="btn btn-link bb-quick-setting"
      ngbDropdownToggle
      [ngbTooltip]="'pages.settings.tab.general.general-settings-form.appearance.mode' | translate"
      [attr.aria-label]="'pages.settings.tab.general.general-settings-form.appearance.mode' | translate"
    >
      <fa-icon [icon]="icons.faCircleHalfStroke" />
    </button>
    <div ngbDropdownMenu class="bb-toolbar-dropdown">...</div>
  </div>
</div>
```

- The row is right-aligned (`justify-content-end`) with a small gap between
  buttons.
- `placement="top-end"` opens each dropdown menu upward (these are the last
  elements in the form) with its right edge aligned to the toggle button,
  preventing horizontal overflow.
- Each toggle is icon-only: `faLanguage`, `faPalette`, `faCircleHalfStroke`
  (all from `@fortawesome/free-solid-svg-icons`, already available in the
  project).
- `[ngbTooltip]` provides the hover popup explaining the button's purpose, and
  `[attr.aria-label]` provides the same text for accessibility. Both reuse
  existing translation keys - no new i18n strings are needed:
  - Language: `pages.settings.tab.general.label.language`
  - Theme Family: `pages.settings.tab.general.general-settings-form.appearance.family`
  - Theme Mode: `pages.settings.tab.general.general-settings-form.appearance.mode`
- Dropdown menus reuse the existing global `.bb-toolbar-dropdown` class
  (blurred, rounded panel already used by the main toolbar dropdowns) for
  visual consistency.
- A new `login.scss` rule removes the default Bootstrap caret:
  ```scss
  .bb-quick-setting.dropdown-toggle::after {
    display: none;
  }
  ```

## Dropdown content & data

Each dropdown lists **all available values** with a rich preview, matching the
Settings > General page conventions, and highlights the **currently active
value** using Bootstrap's `.dropdown-item.active`:

- **Language**: country flag (`<span class="fi fi-{{value}}">`) + translated
  name (`language.us` / `language.hu`), sorted alphabetically by label. Active
  = `translateService.getCurrentLang()`. Built via a `languages` computed
  signal in `login.ts`, mirroring `general.ts`'s existing `languages` computed
  (re-evaluates on `onLangChange`).
- **Theme Family**: small logo image (via the new shared `getFamilyLogoUrl()`
  helper, see below) + family display name, using the new shared
  `THEME_FAMILIES` constant. Active = `themeService.family()`.
- **Theme Mode**: light/dark/system color swatch (reusing the `.mode-indicator`
  element/classes, see below) + translated name
  (`pages.settings.tab.general.mode.light/dark/system`). Active =
  `themeService.mode()`. Built via a `modes` computed signal in `login.ts`,
  mirroring `general.ts`'s existing `modes` computed.

## Persistence & behavior

- **Theme Family / Theme Mode**: clicking a dropdown item calls the existing
  `ThemeService.setFamily(family)` / `setMode(mode)`. These already update the
  live signal (instant visual change across the whole app, including the
  login screen's logo) and persist to the database via `GeneralSettingsService`
  - no new persistence code needed, just wiring the click handlers.

- **Language**: no existing single method persists + switches the UI language,
  so `Login` gets a small new method:

  ```ts
  public async setLanguage(lang: string): Promise<void> {
    if (this.translateService.getCurrentLang() === lang) return;

    const settings = await this.generalSettingsService.load();
    settings.language.language = lang;
    await this.generalSettingsService.save(settings);
    await firstValueFrom(this.translateService.use(lang));
  }
  ```

  This mirrors the save logic already in `general.ts`. Calling
  `translateService.use(lang)` triggers the existing `onLangChange`
  subscription in `app.ts`, which already notifies Electron
  (`window.bitbutler.i18n.languageChanged`) to rebuild the tray/menu and
  updates the timeago locale - everything stays in sync automatically.

  `GeneralSettingsService` becomes a new direct dependency of `Login`
  (alongside the already-injected `ThemeService`).

## Shared code refactors

To avoid duplicating data that both the Settings page and the new login
dropdowns need:

- **`THEME_FAMILIES` constant**: move the static 8-entry `{ value, label }`
  array (currently inlined in `general.ts` as `families`) into
  `theme.service.ts`, exported alongside the `ThemeFamily` type. Both
  `general.ts` and `login.ts` import it.
- **`getFamilyLogoUrl(family)` helper**: extract the
  `assets/images/bitbutler-logo-${family}.png` template (currently duplicated
  as `general.ts`'s `getFamilyLogo()` method and `login.ts`'s `logoUrl`
  computed) into a single exported function in `theme.service.ts`. Both
  components use it.
- **`.mode-indicator` CSS**: move this block from `general.scss` to global
  `styles.scss` so the login page's mode dropdown can render the same
  light/dark/system swatches. `general.scss` drops the now-duplicated rules.

**Accepted duplication**: the `languages()` and `modes()` computed signals
(translated label lists that re-derive on language change, ~10 lines each) are
duplicated into `login.ts` following the same pattern as `general.ts`. They're
small and tightly coupled to each component's own `languageChanged` signal -
not worth a shared service for two consumers.

## Testing

- **`login.spec.ts`**: add `GeneralSettingsService` to the TestBed providers
  (mocked, consistent with how `ThemeService`'s dependencies are currently
  handled) and add unit tests covering:
  - all three dropdowns render their full list of options,
  - the currently active option is marked `active`,
  - clicking a language/family/mode item calls `setLanguage` /
    `themeService.setFamily` / `themeService.setMode` with the right value.
- **`theme.service.spec.ts`** and **`general.spec.ts`**: update for the
  `THEME_FAMILIES` / `getFamilyLogoUrl` extraction - existing tests should keep
  passing, just adjust imports/mocks if they reference the old inline array or
  method.
- **Manual verification**: run the app and confirm:
  - each dropdown opens without a caret, aligned to the right/top,
  - hovering each button shows the correct tooltip,
  - selecting a value applies instantly (theme/mode/language change visibly)
    and persists (re-open the app or check the Settings page reflects the new
    value).

## Out of scope

- No new translation strings.
- No changes to the Settings > General page's behavior or layout beyond the
  shared-code refactors described above.
- No changes to how language changes are propagated to Electron (existing
  `onLangChange` -> `window.bitbutler.i18n.languageChanged` flow is reused
  as-is).
