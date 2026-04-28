# Toast Position-Aware Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make toast enter/exit animations and alignment correct for all four corner positions (`top-left`, `top-right`, `bottom-left`, `bottom-right`).

**Architecture:** `ToastOverlay` gains a writable `position` signal. `ToastService` sets it when the position changes. The template binds an additional CSS class from that signal (Angular merges static and dynamic class bindings, so the element keeps `bb-toast-container` and gains `bb-toast-pos-*`). SCSS handles all animation differences via position-class overrides — no runtime JS animation logic.

**Tech Stack:** Angular 20 (signals, zoneless), Angular CDK Overlay, SCSS, Vitest

---

## File Map

| File | Action | What changes |
|---|---|---|
| `src/app/components/toast-overlay/toast-overlay.ts` | Modify | Add `position` writable signal, import `ToastPosition` |
| `src/app/components/toast-overlay/toast-overlay.spec.ts` | Modify | Add two tests for `position` signal |
| `src/app/components/toast-overlay/toast-overlay.html` | Modify | Add position class binding on container |
| `src/app/components/toast-overlay/toast-overlay.scss` | Modify | Add position-specific overrides and new keyframes |
| `src/app/services/toast.service.ts` | Modify | Set `container.position` in `updatePosition()` and `ensureContainer()` |

---

### Task 1: Add `position` signal to `ToastOverlay`

**Files:**
- Modify: `src/app/components/toast-overlay/toast-overlay.ts`
- Modify: `src/app/components/toast-overlay/toast-overlay.spec.ts`

- [ ] **Step 1: Add the import and signal to `toast-overlay.ts`**

Open `src/app/components/toast-overlay/toast-overlay.ts`. Add `ToastPosition` to the imports and add the `position` signal after `toasts`:

```ts
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faCircleCheck,
  faCircleInfo,
  faCircleXmark,
  faTriangleExclamation,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { Toast, ToastType } from '../../models/toast.model';
import { ToastPosition } from '../../models/general-settings.model';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'bb-toast-container',
  standalone: true,
  imports: [FontAwesomeModule],
  templateUrl: './toast-overlay.html',
  styleUrls: ['./toast-overlay.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastOverlay {
  private readonly toastService = inject(ToastService);

  readonly toasts = signal<Toast[]>([]);
  readonly position = signal<ToastPosition>('bottom-right');
  readonly xmark = faXmark;
  readonly icons: Record<ToastType, any> = {
    primary: faCircleInfo,
    secondary: faCircleInfo,
    success: faCircleCheck,
    danger: faCircleXmark,
    warning: faTriangleExclamation,
    info: faCircleInfo,
    light: faCircleInfo,
    dark: faCircleInfo,
  };

  add(toast: Toast) {
    this.toasts.update((t) => [...t, toast]);
  }

  beginDismiss(id: string) {
    this.toasts.update((t) =>
      t.map((toast) => (toast.id === id ? { ...toast, isClosing: true } : toast)),
    );
  }

  remove(id: string) {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }

  dismiss(id: string) {
    this.toastService.dismiss(id);
  }

  iconFor(type: ToastType) {
    return this.icons[type];
  }

  onEnter(id: string) {
    this.toastService.pause(id);
  }

  onLeave(id: string) {
    this.toastService.resume(id);
  }
}
```

- [ ] **Step 2: Add tests for the `position` signal**

In `src/app/components/toast-overlay/toast-overlay.spec.ts`, add a `describe('position', ...)` block after the closing `});` of the `describe('iconFor', ...)` block (before the final closing `});`):

```ts
describe('position', () => {
  it('should default to bottom-right', () => {
    expect(component.position()).toBe('bottom-right');
  });

  it('should update when set directly', () => {
    component.position.set('top-left');
    expect(component.position()).toBe('top-left');
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
npm test
```

Expected: all existing tests pass plus the two new `position` tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/toast-overlay/toast-overlay.ts \
        src/app/components/toast-overlay/toast-overlay.spec.ts
git commit -m "#53: add position signal to ToastOverlay"
```

---

### Task 2: Bind position class in template

**Files:**
- Modify: `src/app/components/toast-overlay/toast-overlay.html`

- [ ] **Step 1: Add the position class binding to the container**

Open `src/app/components/toast-overlay/toast-overlay.html`. Angular merges a static `class` attribute with `[class.foo]` bindings — but `[class]="expr"` (setting the whole class string) would replace the static value. Use `[class.bb-toast-pos-bottom-right]`, `[class.bb-toast-pos-bottom-left]`, etc. to avoid that. However, since the value is dynamic, the cleanest approach is a computed host class via `ngClass`. Instead, keep it simple with a single expression using both the static name and the dynamic one via string template — use `[ngClass]`:

Actually the simplest correct approach: keep the static `class` and add a second attribute `[class]` for just the position. In Angular, if the static `class` attribute is present alongside `[class]="expr"`, Angular concatenates both. Use it:

Replace:

```html
<div class="bb-toast-container">
```

With:

```html
<div class="bb-toast-container" [class]="'bb-toast-pos-' + position()">
```

Angular's class reconciliation will apply **both** `bb-toast-container` (static) and `bb-toast-pos-{value}` (dynamic) to the element simultaneously. The full file becomes:

```html
<div class="bb-toast-container" [class]="'bb-toast-pos-' + position()">
  @for (toast of toasts(); track toast.id) {
    <div class="bb-toast-wrapper" [class.bb-toast-closing]="toast.isClosing">
      <div
        class="bb-toast"
        [class]="'bb-toast-' + toast.type"
        (mouseenter)="onEnter(toast.id)"
        (mouseleave)="onLeave(toast.id)"
      >
        <div class="bb-toast-header">
          <fa-icon class="bb-toast-type-icon" [icon]="iconFor(toast.type)" />
          <div class="bb-toast-title">{{ toast.title }}</div>
          <button type="button" class="bb-toast-close" (click)="dismiss(toast.id)">
            <fa-icon [icon]="xmark" />
          </button>
        </div>
        <div class="bb-toast-body" [innerHTML]="toast.html"></div>
      </div>
    </div>
  }
</div>
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: exits 0, no warnings.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/toast-overlay/toast-overlay.html
git commit -m "#53: bind position class on toast container"
```

---

### Task 3: Wire position from `ToastService`

**Files:**
- Modify: `src/app/services/toast.service.ts`

- [ ] **Step 1: Update `ensureContainer()` to apply the initial position**

Open `src/app/services/toast.service.ts`. Find `ensureContainer()` and add one line after attaching the portal so the initial position is reflected if the container is created after settings have already loaded:

```ts
private ensureContainer() {
  if (this.container) return;

  this.overlayRef = this.overlay.create({
    positionStrategy: this.getPositionStrategy(),
    scrollStrategy: this.overlay.scrollStrategies.noop(),
    hasBackdrop: false,
  });

  const ref = this.overlayRef.attach(new ComponentPortal(ToastOverlay));
  this.container = ref.instance;
  this.container.position.set(this.settings?.behavior.toastPosition ?? 'bottom-right');
}
```

- [ ] **Step 2: Update `updatePosition()` to also set the container signal**

Find `updatePosition()` and add the signal update:

```ts
private updatePosition(position: ToastPosition) {
  if (!this.overlayRef) {
    return;
  }
  this.overlayRef.updatePositionStrategy(this.getPositionStrategy(position));
  this.container?.position.set(position);
}
```

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: exits 0, no warnings.

- [ ] **Step 4: Commit**

```bash
git add src/app/services/toast.service.ts
git commit -m "#53: wire position signal from ToastService to ToastOverlay"
```

---

### Task 4: Add position-aware SCSS overrides

**Files:**
- Modify: `src/app/components/toast-overlay/toast-overlay.scss`

The existing SCSS already correctly handles `bottom-right`. Three overrides are needed for the other positions:

1. **Left positions** (`bottom-left`, `top-left`): `align-items: flex-start` + exit-to-left keyframe
2. **Top positions** (`top-right`, `top-left`): `flex-direction: column-reverse` + enter-from-above keyframe

Append the following to the **end** of `src/app/components/toast-overlay/toast-overlay.scss` (do not modify existing rules):

```scss
// ─── Left positions: align to left edge ────────────────────────────────────

.bb-toast-pos-bottom-left,
.bb-toast-pos-top-left {
  align-items: flex-start;
}

// ─── Left positions: exit to the left ──────────────────────────────────────

.bb-toast-pos-bottom-left,
.bb-toast-pos-top-left {
  .bb-toast-wrapper.bb-toast-closing {
    animation: slide-out-left-and-collapse 350ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }
}

@keyframes slide-out-left-and-collapse {
  0% {
    grid-template-rows: 1fr;
    margin-top: 8px;
    opacity: 1;
    transform: translateX(0);
  }
  50% {
    grid-template-rows: 1fr;
    margin-top: 8px;
    opacity: 0;
    transform: translateX(-50px);
  }
  100% {
    grid-template-rows: 0fr;
    margin-top: 0;
    opacity: 0;
    transform: translateX(-50px);
  }
}

// ─── Top positions: newest at top (column-reverse) ─────────────────────────

.bb-toast-pos-top-right,
.bb-toast-pos-top-left {
  flex-direction: column-reverse;
}

// ─── Top positions: enter from above ───────────────────────────────────────

.bb-toast-pos-top-right,
.bb-toast-pos-top-left {
  .bb-toast {
    animation: toast-fade-in-top 250ms ease-out forwards;
  }
}

@keyframes toast-fade-in-top {
  from {
    opacity: 0;
    transform: translateY(-12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: exits 0, no warnings.

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Start the app and manually verify all four positions**

```bash
npm start
```

Open Settings → General → Toast Position. For each of the four positions, trigger a toast (e.g., pause/resume a torrent or trigger any notification). Verify:

| Position | Enter direction | Exit direction | Alignment | Stack order |
|---|---|---|---|---|
| `bottom-right` | slides up from below | slides right | right-aligned | newest at bottom |
| `bottom-left` | slides up from below | slides left | left-aligned | newest at bottom |
| `top-right` | slides down from above | slides right | right-aligned | newest at top |
| `top-left` | slides down from above | slides left | left-aligned | newest at top |

- [ ] **Step 5: Commit**

```bash
git add src/app/components/toast-overlay/toast-overlay.scss
git commit -m "#53: add position-aware toast animations for all four corners"
```
