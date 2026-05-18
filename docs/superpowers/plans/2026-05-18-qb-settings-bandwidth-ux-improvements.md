# qB Settings – Bandwidth Tab UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tab descriptions, legend popovers on the bandwidth tab, reorder the scheduler fields, and replace native `<select>` with `<ng-select>` for the time pickers.

**Architecture:** All changes are HTML template updates and i18n key additions. No new components, services, or TypeScript logic are needed. The existing `BbPopover` component and `NgSelectComponent` are already imported in `Bandwidth`.

**Tech Stack:** Angular 20 (zoneless), `@ng-select/ng-select`, `@ngx-translate`, Bootstrap grid.

---

## File Map

| File                                                                        | Change                                                                                     |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `public/i18n/us.json`                                                       | Add `description` keys for all 4 tabs and `popover` keys for the 3 bandwidth legends       |
| `public/i18n/hu.json`                                                       | Same keys in Hungarian                                                                     |
| `packages/app/src/app/pages/qb-settings/bandwidth/bandwidth.html`           | Description row; popovers on legends; reorder scheduler fields; `<select>` → `<ng-select>` |
| `packages/app/src/app/pages/qb-settings/storage/storage.html`               | Description row                                                                            |
| `packages/app/src/app/pages/qb-settings/queue-limits/queue-limits.html`     | Description row                                                                            |
| `packages/app/src/app/pages/qb-settings/seeding-ratios/seeding-ratios.html` | Description row                                                                            |

---

## Task 1: Add i18n keys to both locale files

**Files:**

- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

- [ ] **Step 1: Verify tests pass before starting**

```bash
npm test
```

Expected: 166 tests pass.

- [ ] **Step 2: Add English keys to `public/i18n/us.json`**

Inside `pages.qb-settings.tab.bandwidth`, add after the existing `"title"` key:

```json
"description": "Configure download and upload speed limits, alternative rate limits for Turtle Mode, and a time-based speed scheduler.",
"popover": {
  "global-rate-limits": {
    "title": "Global Rate Limits",
    "description": "Sets the maximum combined download and upload speed across all torrents. Enter 0 for unlimited."
  },
  "alt-rate-limits": {
    "title": "Alternative Rate Limits",
    "description": "Throttled speed limits used when Turtle Mode is manually enabled or activated by the scheduler."
  },
  "scheduler": {
    "title": "Speed Scheduler",
    "description": "Automatically switches to alternative rate limits during a configured time window on selected days."
  }
},
```

Inside `pages.qb-settings.tab.storage`, add after `"title"`:

```json
"description": "Manage where torrents are saved, how temporary files are handled, and file naming options.",
```

Inside `pages.qb-settings.tab.queue-limits`, add after `"title"`:

```json
"description": "Control how many torrents can be active at once and configure queuing behavior.",
```

Inside `pages.qb-settings.tab.seeding-ratios`, add after `"title"`:

```json
"description": "Set automatic limits to stop seeding based on share ratio targets or time thresholds.",
```

- [ ] **Step 3: Add Hungarian keys to `public/i18n/hu.json`**

Inside `pages.qb-settings.tab.bandwidth`, add after `"title"`:

```json
"description": "Konfigurálja a le- és feltöltési sebességkorlátokat, a Teknős Módhoz tartozó alternatív korlátokat és az időalapú sebességütemezőt.",
"popover": {
  "global-rate-limits": {
    "title": "Globális Sebességkorlátok",
    "description": "Beállítja az összes torrent kombinált maximális le- és feltöltési sebességét. 0 értéke korlátlan."
  },
  "alt-rate-limits": {
    "title": "Alternatív Sebességkorlátok",
    "description": "Csökkentett sebességkorlátok, amelyek manuálisan (Teknős Mód) vagy az ütemező által aktiválhatók."
  },
  "scheduler": {
    "title": "Sebességütemező",
    "description": "Automatikusan az alternatív sebességkorlátokra vált egy beállított időablakban, a kiválasztott napokon."
  }
},
```

Inside `pages.qb-settings.tab.storage`, add after `"title"`:

```json
"description": "Kezelje a torrentek mentési helyét, az ideiglenes fájlok kezelését és a fájlelnevezési lehetőségeket.",
```

Inside `pages.qb-settings.tab.queue-limits`, add after `"title"`:

```json
"description": "Szabályozza, hány torrent lehet egyszerre aktív, és konfigurálja a sorba állítási viselkedést.",
```

Inside `pages.qb-settings.tab.seeding-ratios`, add after `"title"`:

```json
"description": "Állítson be automatikus korlátokat a feltöltési arány vagy az idő alapján a terjesztés leállításához.",
```

- [ ] **Step 4: Validate JSON is still valid**

```bash
python3 -c "import json; json.load(open('public/i18n/us.json')); print('us.json OK')"
python3 -c "import json; json.load(open('public/i18n/hu.json')); print('hu.json OK')"
```

Expected: both print `OK` with no errors.

- [ ] **Step 5: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "#86: add description and popover i18n keys to qb-settings tabs"
```

---

## Task 2: Add description row to all four tab HTML templates

**Files:**

- Modify: `packages/app/src/app/pages/qb-settings/bandwidth/bandwidth.html`
- Modify: `packages/app/src/app/pages/qb-settings/storage/storage.html`
- Modify: `packages/app/src/app/pages/qb-settings/queue-limits/queue-limits.html`
- Modify: `packages/app/src/app/pages/qb-settings/seeding-ratios/seeding-ratios.html`

The pattern comes from `packages/app/src/app/pages/settings/general/general.html` lines 4–6:

```html
<div class="row">
  <div class="col-12">{{ 'pages.settings.tab.general.description' | translate }}</div>
</div>
```

- [ ] **Step 1: Add description row to `bandwidth.html`**

In `packages/app/src/app/pages/qb-settings/bandwidth/bandwidth.html`, after `<div class="container-fluid">` (line 2) and before the first `<fieldset` (line 3), insert:

```html
<div class="row mb-3">
  <div class="col-12">{{ 'pages.qb-settings.tab.bandwidth.description' | translate }}</div>
</div>
```

- [ ] **Step 2: Add description row to `storage.html`**

In `packages/app/src/app/pages/qb-settings/storage/storage.html`, after `<div class="container-fluid">` and before the first `<fieldset`, insert:

```html
<div class="row mb-3">
  <div class="col-12">{{ 'pages.qb-settings.tab.storage.description' | translate }}</div>
</div>
```

- [ ] **Step 3: Add description row to `queue-limits.html`**

In `packages/app/src/app/pages/qb-settings/queue-limits/queue-limits.html`, after `<div class="container-fluid">` and before the first `<fieldset`, insert:

```html
<div class="row mb-3">
  <div class="col-12">{{ 'pages.qb-settings.tab.queue-limits.description' | translate }}</div>
</div>
```

- [ ] **Step 4: Add description row to `seeding-ratios.html`**

In `packages/app/src/app/pages/qb-settings/seeding-ratios/seeding-ratios.html`, after `<div class="container-fluid">` and before the first `<fieldset`, insert:

```html
<div class="row mb-3">
  <div class="col-12">{{ 'pages.qb-settings.tab.seeding-ratios.description' | translate }}</div>
</div>
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: 166 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/pages/qb-settings/bandwidth/bandwidth.html \
        packages/app/src/app/pages/qb-settings/storage/storage.html \
        packages/app/src/app/pages/qb-settings/queue-limits/queue-limits.html \
        packages/app/src/app/pages/qb-settings/seeding-ratios/seeding-ratios.html
git commit -m "#86: add description text above first fieldset in all qb-settings tabs"
```

---

## Task 3: Add popovers to bandwidth legend elements

**Files:**

- Modify: `packages/app/src/app/pages/qb-settings/bandwidth/bandwidth.html`

`BbPopover` is already imported in `Bandwidth`. The pattern from `general.html` uses bound `[subject]` and `[description]` inputs with translated strings.

- [ ] **Step 1: Add popover to the Global Rate Limits legend**

Replace the current Global Rate Limits `<legend>` in `bandwidth.html`:

```html
<legend>
  {{ 'pages.qb-settings.tab.bandwidth.label.global-rate-limits' | translate }}
  <bb-popover subject="lowfast" description="decc"></bb-popover>
</legend>
```

with:

```html
<legend>
  {{ 'pages.qb-settings.tab.bandwidth.label.global-rate-limits' | translate }}
  <bb-popover
    [subject]="'pages.qb-settings.tab.bandwidth.popover.global-rate-limits.title' | translate"
    [description]="'pages.qb-settings.tab.bandwidth.popover.global-rate-limits.description' | translate"
  ></bb-popover>
</legend>
```

- [ ] **Step 2: Add popover to the Alternative Rate Limits legend**

Replace:

```html
<legend>{{ 'pages.qb-settings.tab.bandwidth.label.alt-rate-limits' | translate }}</legend>
```

with:

```html
<legend>
  {{ 'pages.qb-settings.tab.bandwidth.label.alt-rate-limits' | translate }}
  <bb-popover
    [subject]="'pages.qb-settings.tab.bandwidth.popover.alt-rate-limits.title' | translate"
    [description]="'pages.qb-settings.tab.bandwidth.popover.alt-rate-limits.description' | translate"
  ></bb-popover>
</legend>
```

- [ ] **Step 3: Add popover to the Scheduler legend**

Replace:

```html
<legend>{{ 'pages.qb-settings.tab.bandwidth.label.scheduler' | translate }}</legend>
```

with:

```html
<legend>
  {{ 'pages.qb-settings.tab.bandwidth.label.scheduler' | translate }}
  <bb-popover
    [subject]="'pages.qb-settings.tab.bandwidth.popover.scheduler.title' | translate"
    [description]="'pages.qb-settings.tab.bandwidth.popover.scheduler.description' | translate"
  ></bb-popover>
</legend>
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: 166 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/pages/qb-settings/bandwidth/bandwidth.html
git commit -m "#86: add popovers to bandwidth fieldset legends"
```

---

## Task 4: Reorder scheduler fields and replace native selects with ng-select

**Files:**

- Modify: `packages/app/src/app/pages/qb-settings/bandwidth/bandwidth.html`

The four native `<select class="form-select">` elements for hours and minutes are replaced with `<ng-select>`. Display is zero-padded via `ng-label-tmp` / `ng-option-tmp` templates using the `number` pipe (already available via `CommonModule`). The "Active on" (`scheduler_days`) row moves above "From".

- [ ] **Step 1: Replace the entire scheduler fieldset content with reordered fields and ng-selects**

In `bandwidth.html`, replace the entire scheduler fieldset body (the `<div class="container">` block inside the scheduler fieldset) with the following. The fieldset `<legend>` is unchanged from Task 3 — only the `<div class="container">` block changes:

```html
<div class="container">
  <div class="row mb-3">
    <div class="col-12">
      <div class="form-check form-switch">
        <input
          class="form-check-input"
          type="checkbox"
          role="switch"
          id="scheduler-enabled"
          formControlName="scheduler_enabled"
        />
        <label class="form-check-label" for="scheduler-enabled">
          {{ 'pages.qb-settings.tab.bandwidth.field.scheduler-enabled' | translate }}
        </label>
      </div>
    </div>
  </div>
  <div class="row mb-3">
    <div class="col-6 d-flex align-items-center">
      {{ 'pages.qb-settings.tab.bandwidth.field.scheduler-days' | translate }}
    </div>
    <div class="col-6">
      <ng-select
        [items]="schedulerDays"
        [clearable]="false"
        [searchable]="false"
        bindLabel="label"
        bindValue="value"
        formControlName="scheduler_days"
        appendTo="ngb-modal-window"
      ></ng-select>
    </div>
  </div>
  <div class="row mb-3">
    <div class="col-6 d-flex align-items-center">
      {{ 'pages.qb-settings.tab.bandwidth.field.schedule-from' | translate }}
    </div>
    <div class="col-6 d-flex gap-2">
      <ng-select
        [items]="hours"
        [clearable]="false"
        [searchable]="false"
        formControlName="schedule_from_hour"
        appendTo="ngb-modal-window"
      >
        <ng-template ng-label-tmp let-item="item">{{ item | number: '2.0-0' }}</ng-template>
        <ng-template ng-option-tmp let-item="item">{{ item | number: '2.0-0' }}</ng-template>
      </ng-select>
      <ng-select
        [items]="minutes"
        [clearable]="false"
        [searchable]="false"
        formControlName="schedule_from_min"
        appendTo="ngb-modal-window"
      >
        <ng-template ng-label-tmp let-item="item">{{ item | number: '2.0-0' }}</ng-template>
        <ng-template ng-option-tmp let-item="item">{{ item | number: '2.0-0' }}</ng-template>
      </ng-select>
    </div>
  </div>
  <div class="row mb-3">
    <div class="col-6 d-flex align-items-center">
      {{ 'pages.qb-settings.tab.bandwidth.field.schedule-to' | translate }}
    </div>
    <div class="col-6 d-flex gap-2">
      <ng-select
        [items]="hours"
        [clearable]="false"
        [searchable]="false"
        formControlName="schedule_to_hour"
        appendTo="ngb-modal-window"
      >
        <ng-template ng-label-tmp let-item="item">{{ item | number: '2.0-0' }}</ng-template>
        <ng-template ng-option-tmp let-item="item">{{ item | number: '2.0-0' }}</ng-template>
      </ng-select>
      <ng-select
        [items]="minutes"
        [clearable]="false"
        [searchable]="false"
        formControlName="schedule_to_min"
        appendTo="ngb-modal-window"
      >
        <ng-template ng-label-tmp let-item="item">{{ item | number: '2.0-0' }}</ng-template>
        <ng-template ng-option-tmp let-item="item">{{ item | number: '2.0-0' }}</ng-template>
      </ng-select>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: 166 tests pass.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: 0 warnings, 0 errors.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/pages/qb-settings/bandwidth/bandwidth.html
git commit -m "#86: reorder scheduler fields and replace native selects with ng-select"
```
