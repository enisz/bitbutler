# Split Buttons - Phase 0: CSS Primitive & Shared Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the theme-aware `.btn-split` CSS primitive and the shared `bb-btn-content` Angular component. No template in the app uses either yet - this phase produces zero visible UI change. Later phases (separate plans) retrofit real buttons on top of this.

**Architecture:** Extend the existing per-variant `--bs-btn-*` custom-property mixins in `packages/app/src/styles/themes/_theme-utils.scss` with one additional `--bs-btn-split-icon-bg` token each, add global structural `.btn-split`/`.btn-icon`/`.btn-text` CSS in `packages/app/src/styles.scss`, and add a new standalone `BbBtnContent` component at `packages/app/src/app/components/bb-btn-content/` that renders the inner icon+text markup for any host element (`<button>`, `<a>`, or toggle-group `<label>`).

**Tech Stack:** Angular 20 (signals, standalone components, OnPush), SCSS (`color-mix`), `@fortawesome/angular-fontawesome`, Vitest (via `@angular/build:unit-test`).

## Global Constraints

- Solid button variants: `--bs-btn-split-icon-bg: color-mix(in srgb, #{$c} 85%, var(--bb-black) 15%);`
- Outline/dashed button variants: `--bs-btn-split-icon-bg: color-mix(in srgb, #{$c} 12%, transparent);`
- `.btn-link` (not covered by any variant mixin): no new custom property is set for it; the structural `.btn-icon` rule falls back to `color-mix(in srgb, currentColor 10%, transparent)` via the CSS `var()` second argument, so it needs no separate override rule.
- No per-theme file (`_dark.scss`/`_light.scss`) changes - everything derives from tokens the themes already define (`--bs-{variant}`, `--bb-black`).
- Component selector: `bb-btn-content`. Files: `bb-btn-content.ts`, `bb-btn-content.html`, `bb-btn-content.spec.ts` (no `.scss` file - it has no component-owned styles; `.btn-icon`/`.btn-text` are global classes defined in `styles.scss`).
- `host: { style: 'display: contents' }` on the component so `.btn-icon`/`.btn-text` remain direct flex children of whatever element hosts `bb-btn-content`.
- Inputs: `icon = input.required<IconDefinition>()` (type from `@fortawesome/fontawesome-svg-core`), `text = input.required<string>()`, `position = input<'start' | 'end'>('start')`.
- No `standalone: true` on the `@Component` decorator - omit it, matching this codebase's existing components (standalone is the implicit default in this Angular version).
- Class name matches filename without suffix: `BbBtnContent` (not `BbBtnContentComponent`), matching `BbPopover`, `BbSpinner`.

---

### Task 1: CSS primitive - `.btn-split` theming

**Files:**

- Modify: `packages/app/src/styles/themes/_theme-utils.scss:17-91` (the `bb-solid-button`, `bb-outline-button`, `bb-dashed-button` mixins)
- Modify: `packages/app/src/styles.scss:13-22` (right after the existing base `.btn` rule)

**Interfaces:**

- Produces: CSS custom property `--bs-btn-split-icon-bg` (set per-variant by the three mixins above), and classes `.btn-split`, `.btn-icon`, `.btn-text` consumed by Task 2's component output and by every later retrofit phase.

- [ ] **Step 1: Add `--bs-btn-split-icon-bg` to the three button-variant mixins**

In `packages/app/src/styles/themes/_theme-utils.scss`, add one line to each of the three mixins. The file currently reads (relevant excerpts):

```scss
@mixin bb-solid-button($variant) {
  $c: bb-bs-var($variant);

  .btn-#{$variant} {
    --bs-btn-color: var(--bb-#{$variant}-ink);
    --bs-btn-bg: #{$c};
    --bs-btn-border-color: #{$c};
    // ...
```

Change the `bb-solid-button` mixin's opening lines to:

```scss
@mixin bb-solid-button($variant) {
  $c: bb-bs-var($variant);

  .btn-#{$variant} {
    --bs-btn-color: var(--bb-#{$variant}-ink);
    --bs-btn-bg: #{$c};
    --bs-btn-border-color: #{$c};
    --bs-btn-split-icon-bg: color-mix(in srgb, #{$c} 85%, var(--bb-black) 15%);
```

Change the `bb-outline-button` mixin's opening lines to:

```scss
@mixin bb-outline-button($variant) {
  $c: bb-bs-var($variant);

  .btn-outline-#{$variant} {
    --bs-btn-color: #{$c};
    --bs-btn-border-color: #{$c};
    --bs-btn-split-icon-bg: color-mix(in srgb, #{$c} 12%, transparent);
```

Change the `bb-dashed-button` mixin's opening lines to:

```scss
@mixin bb-dashed-button($variant) {
  $c: bb-bs-var($variant);

  .btn-dashed-#{$variant} {
    --bs-btn-color: #{$c};
    --bs-btn-bg: transparent;
    --bs-btn-border-color: #{$c};
    --bs-btn-split-icon-bg: color-mix(in srgb, #{$c} 12%, transparent);
```

Everything else in the three mixins (hover/active/disabled custom properties, `border-style: dashed;`) stays exactly as-is - only the one new line is added to each.

- [ ] **Step 2: Add the structural `.btn-split` CSS**

In `packages/app/src/styles.scss`, the file currently has this `.btn` rule near the top:

```scss
.btn {
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: none;

  &:focus,
  &:active:focus {
    box-shadow: 0 0 0 0.2rem var(--bb-control-focus-ring) !important;
  }
}
```

Immediately after that closing `}` (before the `.card` rule), add:

```scss
.btn-split {
  display: inline-flex;
  align-items: stretch;
  padding: 0 !important;
  overflow: hidden;

  .btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--bs-btn-padding-y) calc(var(--bs-btn-padding-x) * 0.75);
    background-color: var(
      --bs-btn-split-icon-bg,
      color-mix(in srgb, currentColor 10%, transparent)
    );
  }

  .btn-text {
    display: inline-flex;
    align-items: center;
    padding: var(--bs-btn-padding-y) var(--bs-btn-padding-x);
  }
}
```

- [ ] **Step 3: Verify the SCSS compiles**

There's no automated test for SCSS in this repo (lint-staged only runs Prettier on `.scss` files, not a style linter). Verify by compiling `styles.scss` standalone with the `sass` CLI already present in `node_modules` - this exercises every file `styles.scss` pulls in via `@use`, including `_theme-utils.scss` and all 8 theme files, in a few seconds instead of a full Angular build:

Run (from the repo root):

```bash
npx sass --load-path=node_modules --quiet packages/app/src/styles.scss /dev/null
```

Expected: exits with status 0 and prints nothing. Any typo (e.g. a stray `#{}` or unmatched brace) prints a Sass error with a file/line pointer instead.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/styles/themes/_theme-utils.scss packages/app/src/styles.scss
git commit -m "#180: add btn-split CSS primitive"
```

---

### Task 2: `BbBtnContent` shared component

**Files:**

- Create: `packages/app/src/app/components/bb-btn-content/bb-btn-content.ts`
- Create: `packages/app/src/app/components/bb-btn-content/bb-btn-content.html`
- Create: `packages/app/src/app/components/bb-btn-content/bb-btn-content.spec.ts`

**Interfaces:**

- Consumes: the `.btn-icon`/`.btn-text` classes from Task 1 (no TypeScript dependency - this task's tests pass independently of Task 1, since jsdom doesn't apply real CSS layout).
- Produces: `BbBtnContent` class, selector `bb-btn-content`, with `icon = input.required<IconDefinition>()`, `text = input.required<string>()`, `position = input<'start' | 'end'>('start')`. Every later retrofit phase imports this component and passes these three inputs.

- [ ] **Step 1: Write the failing test**

Create `packages/app/src/app/components/bb-btn-content/bb-btn-content.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { BbBtnContent } from './bb-btn-content';

describe('BbBtnContent', () => {
  let component: BbBtnContent;
  let fixture: ComponentFixture<BbBtnContent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BbBtnContent],
    }).compileComponents();

    fixture = TestBed.createComponent(BbBtnContent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('icon', faCheck);
    fixture.componentRef.setInput('text', 'Save');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default position to start', () => {
    expect(component.position()).toBe('start');
  });

  it('should render the given text', () => {
    const textEl: HTMLElement = fixture.nativeElement.querySelector('.btn-text');
    expect(textEl.textContent?.trim()).toBe('Save');
  });

  it('should mark the icon span as aria-hidden', () => {
    const iconEl: HTMLElement = fixture.nativeElement.querySelector('.btn-icon');
    expect(iconEl.getAttribute('aria-hidden')).toBe('true');
  });

  it('should render icon before text when position is start', () => {
    const children = Array.from(fixture.nativeElement.children) as HTMLElement[];
    expect(children.map((el) => el.className)).toEqual(['btn-icon', 'btn-text']);
  });

  it('should render icon after text when position is end', () => {
    fixture.componentRef.setInput('position', 'end');
    fixture.detectChanges();
    const children = Array.from(fixture.nativeElement.children) as HTMLElement[];
    expect(children.map((el) => el.className)).toEqual(['btn-text', 'btn-icon']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `packages/app`):

```bash
npx ng test --include="**/bb-btn-content.spec.ts" --watch=false
```

Expected: build fails with `Cannot find module './bb-btn-content'` (or similar) since `bb-btn-content.ts` doesn't exist yet.

- [ ] **Step 3: Write the minimal implementation**

Create `packages/app/src/app/components/bb-btn-content/bb-btn-content.html`:

```html
@if (position() !== 'end') {
<span class="btn-icon" aria-hidden="true"><fa-icon [icon]="icon()" /></span>
}
<span class="btn-text">{{ text() }}</span>
@if (position() === 'end') {
<span class="btn-icon" aria-hidden="true"><fa-icon [icon]="icon()" /></span>
}
```

Create `packages/app/src/app/components/bb-btn-content/bb-btn-content.ts`:

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

@Component({
  selector: 'bb-btn-content',
  imports: [FontAwesomeModule],
  templateUrl: './bb-btn-content.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BbBtnContent {
  readonly icon = input.required<IconDefinition>();
  readonly text = input.required<string>();
  readonly position = input<'start' | 'end'>('start');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run (from `packages/app`):

```bash
npx ng test --include="**/bb-btn-content.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 6 passed (6)`.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/bb-btn-content
git commit -m "#180: add BbBtnContent shared component"
```

---

## Self-Review Notes

- **Spec coverage:** This plan covers the "CSS primitive" and "Shared inner-content component" sections of `docs/superpowers/specs/2026-06-22-split-buttons-design.md` in full (Phase 0 row of its rollout table). It deliberately does not touch any of the "Icon & translation conventions" or per-file retrofit work - those are Phases 1-6, each getting its own plan.
- **Placeholder scan:** none - both tasks contain complete, runnable code.
- **Type consistency:** `IconDefinition` (from `@fortawesome/fontawesome-svg-core`) is used consistently with how the rest of the app types icons (see `button-bar.menu.ts`, `context-menu.types.ts`). `position` is `'start' | 'end'` everywhere it appears (component, spec, spec doc).
