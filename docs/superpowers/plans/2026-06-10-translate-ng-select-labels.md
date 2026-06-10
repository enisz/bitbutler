# ng-select Label Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Localize `ng-select`'s built-in UI labels (add-tag, clear-all, loading, not-found, type-to-search) so they follow the app's active language.

**Architecture:** Add 5 new translation keys under `general.form.ng-select` in `public/i18n/us.json` and `public/i18n/hu.json`. In `packages/app/src/app/app.ts`, inject the `NgSelectConfig` singleton and add a `setNgSelectTranslations()` method that reads these keys via `TranslateService.instant()`. Call it once in the constructor (initial language) and again inside the existing `translateService.onLangChange` subscription, alongside the existing `setTimeagoLanguage()` call - mirroring the existing `TimeagoIntl` pattern.

**Tech Stack:** Angular 20 (zoneless), `@ng-select/ng-select`, `@ngx-translate/core`, Vitest (`@angular/build:unit-test` runner).

---

### Task 1: Add ng-select translation keys

**Files:**

- Modify: `public/i18n/us.json:1472-1477`
- Modify: `public/i18n/hu.json:1472-1477`

- [ ] **Step 1: Add the `ng-select` block to `general.form` in `us.json`**

Current content at lines 1472-1477:

```json
    "form": {
      "feedback": {
        "required": "This field is required.",
        "no-slash": "The name must not contain slashes."
      }
    },
```

Replace with:

```json
    "form": {
      "feedback": {
        "required": "This field is required.",
        "no-slash": "The name must not contain slashes."
      },
      "ng-select": {
        "add-tag": "Add item",
        "clear-all": "Clear all",
        "loading": "Loading...",
        "not-found": "No items found",
        "type-to-search": "Type to search"
      }
    },
```

- [ ] **Step 2: Add the matching `ng-select` block to `general.form` in `hu.json`**

Current content at lines 1472-1477:

```json
    "form": {
      "feedback": {
        "required": "Ez a mező kötelező.",
        "no-slash": "A név nem tartalmazhat perjelet (/)."
      }
    },
```

Replace with:

```json
    "form": {
      "feedback": {
        "required": "Ez a mező kötelező.",
        "no-slash": "A név nem tartalmazhat perjelet (/)."
      },
      "ng-select": {
        "add-tag": "Elem hozzáadása",
        "clear-all": "Összes törlése",
        "loading": "Betöltés...",
        "not-found": "Nem található elem",
        "type-to-search": "Gépeljen a kereséshez"
      }
    },
```

- [ ] **Step 3: Verify both files are still valid JSON**

Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('public/i18n/us.json', 'utf8')); JSON.parse(require('fs').readFileSync('public/i18n/hu.json', 'utf8')); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "#147: add ng-select label translation keys"
```

---

### Task 2: Configure NgSelectConfig in app.ts (TDD)

**Files:**

- Modify: `packages/app/src/app/app.ts`
- Test: `packages/app/src/app/app.spec.ts`

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `packages/app/src/app/app.spec.ts` with:

```typescript
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NgSelectConfig } from '@ng-select/ng-select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TimeagoIntl, provideTimeago } from 'ngx-timeago';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App, TranslateModule.forRoot()],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideTimeago({ intl: { provide: TimeagoIntl, useClass: TimeagoIntl } }),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should configure ng-select labels from translations', () => {
    TestBed.createComponent(App);

    const ngSelectConfig = TestBed.inject(NgSelectConfig);

    expect(ngSelectConfig.addTagText).toBe('general.form.ng-select.add-tag');
    expect(ngSelectConfig.clearAllText).toBe('general.form.ng-select.clear-all');
    expect(ngSelectConfig.loadingText).toBe('general.form.ng-select.loading');
    expect(ngSelectConfig.notFoundText).toBe('general.form.ng-select.not-found');
    expect(ngSelectConfig.typeToSearchText).toBe('general.form.ng-select.type-to-search');
  });

  it('should re-apply ng-select labels when the language changes', () => {
    TestBed.createComponent(App);

    const translateService = TestBed.inject(TranslateService);
    const instantSpy = vi.spyOn(translateService, 'instant');
    instantSpy.mockClear();

    translateService.use('hu');

    expect(instantSpy).toHaveBeenCalledWith('general.form.ng-select.add-tag');
    expect(instantSpy).toHaveBeenCalledWith('general.form.ng-select.clear-all');
    expect(instantSpy).toHaveBeenCalledWith('general.form.ng-select.loading');
    expect(instantSpy).toHaveBeenCalledWith('general.form.ng-select.not-found');
    expect(instantSpy).toHaveBeenCalledWith('general.form.ng-select.type-to-search');
  });
});
```

This relies on the default `TranslateModule.forRoot()` no-op loader, whose `instant()` falls back to returning the key itself when no translation is loaded - so asserting on the key string confirms the right keys are wired up without needing the real JSON files in the test.

- [ ] **Step 2: Run the tests and confirm the new ones fail**

```bash
cd packages/app && npx ng test --watch=false --include=src/app/app.spec.ts
```

Expected: `should create the app` PASSES, but `should configure ng-select labels from translations` and `should re-apply ng-select labels when the language changes` FAIL (e.g. `ngSelectConfig.addTagText` is `undefined` or the `@ng-select/ng-select` default `'Add item'`/`'No items found'`/etc., and `instantSpy` was not called with the new keys).

- [ ] **Step 3: Add the `NgSelectConfig` import**

In `packages/app/src/app/app.ts`, change line 4 from:

```typescript
import { NgbModalConfig, NgbTooltipConfig } from '@ng-bootstrap/ng-bootstrap';
import { LangChangeEvent, TranslateService } from '@ngx-translate/core';
```

to:

```typescript
import { NgbModalConfig, NgbTooltipConfig } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectConfig } from '@ng-select/ng-select';
import { LangChangeEvent, TranslateService } from '@ngx-translate/core';
```

- [ ] **Step 4: Inject `NgSelectConfig`**

In the same file, change:

```typescript
  private readonly tooltipConfigService = inject(NgbTooltipConfig);
```

to:

```typescript
  private readonly tooltipConfigService = inject(NgbTooltipConfig);
  private readonly ngSelectConfigService = inject(NgSelectConfig);
```

- [ ] **Step 5: Call `setNgSelectTranslations()` on startup**

Change:

```typescript
  constructor() {
    this.modalConfigService.keyboard = true;
    this.modalConfigService.centered = true;
    this.modalConfigService.animation = true;
    this.tooltipConfigService.container = 'body';

    this.openFilesService.start();
```

to:

```typescript
  constructor() {
    this.modalConfigService.keyboard = true;
    this.modalConfigService.centered = true;
    this.modalConfigService.animation = true;
    this.tooltipConfigService.container = 'body';
    this.setNgSelectTranslations();

    this.openFilesService.start();
```

- [ ] **Step 6: Re-apply `setNgSelectTranslations()` on language change**

Change:

```typescript
this.translateService.onLangChange
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe((event: LangChangeEvent) => {
    this.setTimeagoLanguage(event.lang);
    window.bitbutler.i18n.languageChanged(event.lang);
  });
```

to:

```typescript
this.translateService.onLangChange
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe((event: LangChangeEvent) => {
    this.setTimeagoLanguage(event.lang);
    this.setNgSelectTranslations();
    window.bitbutler.i18n.languageChanged(event.lang);
  });
```

- [ ] **Step 7: Add the `setNgSelectTranslations()` method**

Change:

```typescript
  private setTimeagoLanguage(lang: string): void {
```

to:

```typescript
  private setNgSelectTranslations(): void {
    this.ngSelectConfigService.addTagText = this.translateService.instant(
      'general.form.ng-select.add-tag',
    );
    this.ngSelectConfigService.clearAllText = this.translateService.instant(
      'general.form.ng-select.clear-all',
    );
    this.ngSelectConfigService.loadingText = this.translateService.instant(
      'general.form.ng-select.loading',
    );
    this.ngSelectConfigService.notFoundText = this.translateService.instant(
      'general.form.ng-select.not-found',
    );
    this.ngSelectConfigService.typeToSearchText = this.translateService.instant(
      'general.form.ng-select.type-to-search',
    );
  }

  private setTimeagoLanguage(lang: string): void {
```

- [ ] **Step 8: Run the tests and confirm they pass**

```bash
cd packages/app && npx ng test --watch=false --include=src/app/app.spec.ts
```

Expected: all 3 tests in `App` PASS.

- [ ] **Step 9: Run lint**

```bash
npm run lint
```

Expected: no errors or warnings.

- [ ] **Step 10: Commit**

```bash
git add packages/app/src/app/app.ts packages/app/src/app/app.spec.ts
git commit -m "#147: localize ng-select labels via NgSelectConfig"
```

---

### Task 3: Manual verification

- [ ] **Step 1: Start the app**

```bash
npm start
```

- [ ] **Step 2: Verify English labels**

Open the main torrent grid, open the tag selector (or category selector) on a torrent. Confirm:

- Typing a new tag and pressing enter shows "Add item" placeholder behavior (`addTagText`).
- With items selected, the dropdown shows a "Clear all" control.
- Opening the dropdown briefly shows "Loading..." then, if no matches, "No items found".
- The search box placeholder reads "Type to search" when applicable.

- [ ] **Step 3: Switch language to Hungarian**

In Settings > General, change the language to Hungarian. Re-open the tag/category selector dropdown and confirm the same labels now show the Hungarian translations from the table above (e.g. "Összes törlése", "Betöltés...", "Nem található elem", "Gépeljen a kereséshez", "Elem hozzáadása").

- [ ] **Step 4: Switch back to English and confirm labels revert**

---

## Spec coverage check

- All `ng-select` instances show localized text -> Task 2 (global `NgSelectConfig`) + Task 3 (manual check across components).
- Labels update on language switch without restart -> Task 2 Step 6/7 (`onLangChange` re-applies translations) + Task 3 Step 3.
- New keys in both `us.json`/`hu.json` under `general.form.ng-select.*` -> Task 1.
- Out of scope items (`placeholder`, per-instance overrides, `general.button.clear-all`) -> not touched by any task.
