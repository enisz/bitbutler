# Modal Deactivation Guard — Design Spec

**Date:** 2026-04-21
**Status:** Approved

## Overview

Prevent users from accidentally discarding unsaved changes when closing a modal or navigating between tabs. The guard intercepts every exit path (close button, dismiss button, Escape key, backdrop click, tab switch) and shows a confirmation dialog when unsaved changes are present.

The implementation is opt-in and reusable: any modal component can join the system by providing `ModalGuardService` and implementing the `GuardableModal` interface.

The initial participant is the **Content tab** (`content.ts`) inside `TorrentDetails`, where the `BbFileTree` component has an edit mode that produces unsaved renames and priority changes.

---

## New Files

### `src/app/services/modal-guard.service.ts`

```
@Injectable()   // NOT providedIn: 'root'
export class ModalGuardService {
  isDirty = signal(false);
}
```

A plain signal holder. No close/confirm logic lives here — the modal component owns that. Provided in each participating modal's `providers` array so that one instance is created per modal lifetime and destroyed with it.

### `src/app/models/guardable-modal.interface.ts`

```
export interface GuardableModal {
  canDeactivate(): Promise<boolean>;
}
```

Implemented by any modal component that wants the guard. Used for the duck-type check in `ui-command-handler.service.ts`.

---

## Modified Files

### `src/app/components/modals/torrent-details/torrent-details.ts`

- Add `ModalGuardService` to `providers`.
- Implement `GuardableModal`.
- Inject `ConfirmService`.
- Add `canDeactivate()`:
  - If `guardService.isDirty()` is false → return `true`.
  - Otherwise call `confirmService.confirm(title, message)` with i18n keys for "Unsaved changes" and "You have unsaved changes. Leave anyway?" and return the result.
- Add `onDismiss()` and `onClose()` methods:
  ```
  async onDismiss() { if (await this.canDeactivate()) this.activeModal.dismiss(); }
  async onClose()   { if (await this.canDeactivate()) this.activeModal.close(); }
  ```
- Update `selectTab(tabId)`: call `canDeactivate()` before switching; abort if it returns `false`.

### `src/app/components/modals/torrent-details/torrent-details.html`

- Replace `(click)="activeModal.dismiss()"` on the X button with `(click)="onDismiss()"`.
- Replace `(click)="activeModal.close()"` on the footer Close button with `(click)="onClose()"`.

### `src/app/components/modals/torrent-details/content/content.ts`

- Inject `ModalGuardService`.
- Add `(editModeChange)` binding in the template (or handle in `onSaved` / `cancelEdit` callbacks):
  - When `BbFileTree` emits `editModeChange: true` → `guardService.isDirty.set(true)`.
  - When it emits `editModeChange: false` (save or cancel) → `guardService.isDirty.set(false)`.

### `src/app/components/modals/torrent-details/content/content.html`

- Add `(editModeChange)="onEditModeChange($event)"` to `<app-bb-file-tree>`.

### `src/app/services/ui-command-handler.service.ts`

After every `modalService.open()` call, add a duck-type guard check:

```typescript
if (typeof modalRef.componentInstance.canDeactivate === 'function') {
  modalRef.update({
    beforeDismiss: () => modalRef.componentInstance.canDeactivate(),
  });
}
```

This single pattern covers Escape and backdrop click for all current and future guarded modals without touching each call site individually.

> **Note:** `NgbModalRef.update()` is available in NgBootstrap 14+. The project uses NgBootstrap — confirm the version supports `update()`. If not, pass `beforeDismiss` inline at the open site for `TorrentDetails` only.

---

## i18n Keys

Add to both `us.json` and `hu.json` under an appropriate namespace (e.g. `components.modals.guard`):

| Key                                       | EN                                      | HU                                                  |
| ----------------------------------------- | --------------------------------------- | --------------------------------------------------- |
| `components.modals.guard.unsaved-title`   | Unsaved changes                         | Mentetlen változtatások                             |
| `components.modals.guard.unsaved-message` | You have unsaved changes. Leave anyway? | Mentetlen változtatásaid vannak. Biztosan elhagyod? |
| `components.modals.guard.btn-leave`       | Leave                                   | Elhagyás                                            |
| `components.modals.guard.btn-stay`        | Stay                                    | Maradás                                             |

---

## Data Flow

```
BbFileTree (editModeChange) → content.ts → ModalGuardService.isDirty

User triggers exit:
  Escape / backdrop      → beforeDismiss → TorrentDetails.canDeactivate()
  X button               → onDismiss()   → TorrentDetails.canDeactivate()
  Footer Close button    → onClose()     → TorrentDetails.canDeactivate()
  Tab click              → selectTab()   → TorrentDetails.canDeactivate()

canDeactivate():
  isDirty = false  →  return true  (exit proceeds)
  isDirty = true   →  confirmService.confirm()  →  user picks Leave/Stay
                       true  →  guardService.isDirty.set(false), return true
                       false →  return false (exit blocked)
```

---

## Scope

- No changes to `BbFileTree` itself.
- No changes to other existing modals (they are unaffected and can opt in later by following the same pattern).
- No new modal components.
- `ModalGuardService` is intentionally minimal — it holds only `isDirty`. The confirm UX and routing logic live in the modal component.
