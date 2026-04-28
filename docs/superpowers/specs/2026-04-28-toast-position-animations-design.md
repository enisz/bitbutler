# Toast Position-Aware Animations

**Date:** 2026-04-28  
**Branch:** 53-bugfixes  

## Problem

Toast animations are hardcoded for `bottom-right`. The app now supports four positions (`top-left`, `top-right`, `bottom-left`, `bottom-right`) but:
- The enter animation always slides from below (`translateY(+12px)`)
- The exit animation always slides to the right (`translateX(+50px)`)
- Toasts always align to the right edge (`align-items: flex-end`)

## Design Decisions

- **Stack order:** New toasts always appear closest to the corner — bottom of the stack for bottom positions, top of the stack for top positions.
- **Enter animation:** Vertical axis only — top positions slide from above, bottom positions slide from below. Left/right does not affect the enter direction.
- **Exit animation:** Horizontal axis — right positions slide out to the right, left positions slide out to the left.

## Architecture

No new services or models. Changes touch three files:

| File | Change |
|---|---|
| `toast-overlay.ts` | Add `position` writable signal |
| `toast-overlay.html` | Bind position class on container |
| `toast-overlay.scss` | Add position-specific overrides and keyframes |
| `toast.service.ts` | Set `container.position` in `updatePosition()` |

## Section 1 — State Threading

`ToastOverlay` gains a writable signal:

```ts
readonly position = signal<ToastPosition>('bottom-right');
```

`ToastService.updatePosition()` sets it after updating the overlay strategy:

```ts
private updatePosition(position: ToastPosition) {
  if (!this.overlayRef) return;
  this.overlayRef.updatePositionStrategy(this.getPositionStrategy(position));
  this.container?.position.set(position);
}
```

Template binds the class:

```html
<div class="bb-toast-container" [class]="'bb-toast-pos-' + position()">
```

## Section 2 — Stack Direction

For top positions, `flex-direction: column-reverse` is applied. Since new toasts are always appended to the array (last = newest), `column-reverse` renders the newest item at the visual top — closest to the corner. No changes to array logic or animations are needed.

```scss
.bb-toast-pos-top-right,
.bb-toast-pos-top-left {
  flex-direction: column-reverse;
}
```

The existing `wrapper-push-up` keyframe works unchanged for both bottom (container grows upward) and top (container grows downward).

## Section 3 — Animation Adjustments

### Left positions: alignment + exit left

```scss
.bb-toast-pos-bottom-left,
.bb-toast-pos-top-left {
  align-items: flex-start;

  .bb-toast-wrapper.bb-toast-closing {
    animation: slide-out-left-and-collapse 350ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }
}

@keyframes slide-out-left-and-collapse {
  0%   { grid-template-rows: 1fr; margin-top: 8px; opacity: 1; transform: translateX(0); }
  50%  { grid-template-rows: 1fr; margin-top: 8px; opacity: 0; transform: translateX(-50px); }
  100% { grid-template-rows: 0fr; margin-top: 0;   opacity: 0; transform: translateX(-50px); }
}
```

### Top positions: enter from above

```scss
.bb-toast-pos-top-right,
.bb-toast-pos-top-left {
  .bb-toast {
    animation: toast-fade-in-top 250ms ease-out forwards;
  }
}

@keyframes toast-fade-in-top {
  from { opacity: 0; transform: translateY(-12px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

### Default (bottom-right)

The existing keyframes (`toast-fade-in` with `+12px`, `slide-out-and-collapse` with `+50px`, `align-items: flex-end`) remain unchanged and serve as the default.

## What Does Not Change

- `ToastService.getPositionStrategy()` — unchanged
- `Toast` model — unchanged
- Timer, dismiss, pause/resume logic — unchanged
- Array append order — unchanged
