# Modal Deactivation Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent users from accidentally discarding unsaved `BbFileTree` edits when closing or switching tabs in the `TorrentDetails` modal, with a reusable opt-in pattern for all future modals.

**Architecture:** A minimal `ModalGuardService` (scoped to each modal via `providers`) holds one `isDirty` signal. `TorrentDetails` implements `GuardableModal` and calls `ConfirmService.confirm()` inside `canDeactivate()`. All exit paths (X button, footer Close, tab switch, Escape, backdrop click) funnel through `canDeactivate()` before proceeding.

**Tech Stack:** Angular 20 signals, NgBootstrap 19.0.1, `@ngx-translate`, existing `ConfirmService`

---

## File Map

| Action | Path                                                             |
| ------ | ---------------------------------------------------------------- |
| Create | `src/app/services/modal-guard.service.ts`                        |
| Create | `src/app/models/guardable-modal.interface.ts`                    |
| Modify | `src/app/components/modals/torrent-details/torrent-details.ts`   |
| Modify | `src/app/components/modals/torrent-details/torrent-details.html` |
| Modify | `src/app/components/modals/torrent-details/content/content.ts`   |
| Modify | `src/app/components/modals/torrent-details/content/content.html` |
| Modify | `src/app/services/ui-command-handler.service.ts`                 |
| Modify | `public/i18n/us.json`                                            |
| Modify | `public/i18n/hu.json`                                            |

---

### Task 1: Create `ModalGuardService` and `GuardableModal` interface

**Files:**

- Create: `src/app/services/modal-guard.service.ts`
- Create: `src/app/models/guardable-modal.interface.ts`

- [ ] **Step 1: Create `ModalGuardService`**

```typescript
// src/app/services/modal-guard.service.ts
import { Injectable, signal } from '@angular/core';

@Injectable()
export class ModalGuardService {
  isDirty = signal(false);
}
```

> Note: No `providedIn: 'root'`. This service is scoped via each modal's `providers` array.

- [ ] **Step 2: Create `GuardableModal` interface**

```typescript
// src/app/models/guardable-modal.interface.ts
export interface GuardableModal {
  canDeactivate(): Promise<boolean>;
}
```

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`  
Expected: no errors, no warnings

- [ ] **Step 4: Commit**

```bash
git add src/app/services/modal-guard.service.ts src/app/models/guardable-modal.interface.ts
git commit -m "$(cat <<'EOF'
#35: Add ModalGuardService and GuardableModal interface

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add i18n keys for the guard confirmation dialog

**Files:**

- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

- [ ] **Step 1: Add guard keys to `us.json`**

In `public/i18n/us.json`, inside the `"components"` → `"modals"` object, add a `"guard"` sibling alongside the existing modal keys (e.g., after `"torrent-details"`):

```json
"guard": {
  "unsaved-title": "Unsaved changes",
  "unsaved-message": "You have unsaved changes. Leave anyway?",
  "btn-leave": "Leave",
  "btn-stay": "Stay"
}
```

- [ ] **Step 2: Add guard keys to `hu.json`**

In `public/i18n/hu.json`, find the same `"components"` → `"modals"` path and add:

```json
"guard": {
  "unsaved-title": "Mentetlen változtatások",
  "unsaved-message": "Mentetlen változtatásaid vannak. Biztosan elhagyod?",
  "btn-leave": "Elhagyás",
  "btn-stay": "Maradás"
}
```

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`  
Expected: no errors, no warnings

- [ ] **Step 4: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "$(cat <<'EOF'
#35: Add i18n keys for modal deactivation guard

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Wire `content.ts` to `ModalGuardService`

**Files:**

- Modify: `src/app/components/modals/torrent-details/content/content.ts`

`Content` must inject `ModalGuardService` (provided by `TorrentDetails` — see Task 4) and set `isDirty` based on `BbFileTree`'s `editModeChange` output.

- [ ] **Step 1: Add `onEditModeChange` to `content.ts`**

Add `ModalGuardService` to imports and inject it. Add a public handler method:

```typescript
// new import at top:
import { ModalGuardService } from '../../../../services/modal-guard.service';

// inside the class body, after existing injections:
private readonly guardService = inject(ModalGuardService);

// new method:
public onEditModeChange(isEditing: boolean): void {
  this.guardService.isDirty.set(isEditing);
}
```

Full updated class signature line (no change needed — just confirm it still reads):

```typescript
export class Content implements TorrentDetailTabComponent, OnChanges, OnInit {
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`  
Expected: no errors, no warnings

- [ ] **Step 3: Commit**

```bash
git add src/app/components/modals/torrent-details/content/content.ts
git commit -m "$(cat <<'EOF'
#35: Wire Content tab to ModalGuardService for dirty tracking

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Bind `editModeChange` in `content.html`

**Files:**

- Modify: `src/app/components/modals/torrent-details/content/content.html`

- [ ] **Step 1: Add `(editModeChange)` binding to `<app-bb-file-tree>`**

Replace the existing `<app-bb-file-tree>` block:

```html
<app-bb-file-tree
  [files]="content()"
  [expandAll]="false"
  [showMeta]="true"
  [allowEdit]="true"
  [startInEditMode]="startInEditMode"
  (saved)="onSaved($event)"
  (editModeChange)="onEditModeChange($event)"
>
</app-bb-file-tree>
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`  
Expected: no errors, no warnings

- [ ] **Step 3: Commit**

```bash
git add src/app/components/modals/torrent-details/content/content.html
git commit -m "$(cat <<'EOF'
#35: Bind editModeChange output in Content tab template

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Implement the guard in `torrent-details.ts`

**Files:**

- Modify: `src/app/components/modals/torrent-details/torrent-details.ts`

This is the central task. `TorrentDetails` provides `ModalGuardService`, implements `GuardableModal`, and adds the three guarded exit methods plus a guarded `selectTab`.

**Key facts:**

- `NgbActiveModal.dismiss()` IS intercepted by `beforeDismiss` (set in Task 6). To avoid double-prompting, `canDeactivate()` must reset `isDirty` to `false` before calling `activeModal.dismiss()` so the subsequent `beforeDismiss` callback sees a clean state and returns `true` immediately.
- `NgbActiveModal.close()` is NOT intercepted by `beforeDismiss`, so `onClose()` must guard manually.
- The TORRENT_DELETED subscription calls `this.activeModal.close()` directly — intentionally unguarded (torrent no longer exists).

- [ ] **Step 1: Update `torrent-details.ts`**

Full replacement of the file:

```typescript
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { Component, Input, OnInit, Type, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';
import { AutofocusDirective } from '../../../directives/autofocus';
import { AppCommand, TorrentCommand } from '../../../models/command.model';
import { GuardableModal } from '../../../models/guardable-modal.interface';
import { Torrent } from '../../../models/torrent.model';
import { CommandBusService } from '../../../services/command-bus.service';
import { ConfirmService } from '../../../services/confirm.service';
import { ModalGuardService } from '../../../services/modal-guard.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { BbSpinner } from '../../bb-spinner/bb-spinner';
import { Tab, TorrentDetailTabComponent, TorrentDetailTabId } from './torrent-details.interface';

@Component({
  selector: 'app-torrent-details',
  standalone: true,
  imports: [
    CommonModule,
    BbSpinner,
    NgComponentOutlet,
    AutofocusDirective,
    NgbTooltip,
    TranslatePipe,
  ],
  providers: [ModalGuardService],
  templateUrl: './torrent-details.html',
  styleUrl: './torrent-details.scss',
})
export class TorrentDetails implements OnInit, GuardableModal {
  @Input() hash: string | null = null;
  @Input() public tabToOpen: TorrentDetailTabId = 'general';
  @Input() public context: Record<string, any> = {};

  public readonly activeModal = inject(NgbActiveModal);
  private readonly commandBusService = inject(CommandBusService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly confirmService = inject(ConfirmService);
  private readonly guardService = inject(ModalGuardService);

  public activeTabId = signal<TorrentDetailTabId>('general');
  public loadedComponent = signal<Type<TorrentDetailTabComponent> | null>(null);

  public torrent = computed<Torrent | null>(() => {
    if (!this.hash) return null;
    return this.torrentStoreService.torrentsMap().get(this.hash) as Torrent;
  });

  public tabs: Tab[] = [
    {
      id: 'general',
      label: 'General',
      loadComponent: () => import('./general/general').then((m) => m.General),
    },
    {
      id: 'trackers',
      label: 'Trackers',
      loadComponent: () => import('./trackers/trackers').then((m) => m.Trackers),
    },
    {
      id: 'peers',
      label: 'Peers',
      loadComponent: () => import('./peers/peers').then((m) => m.Peers),
    },
    {
      id: 'content',
      label: 'Content',
      loadComponent: () => import('./content/content').then((m) => m.Content),
    },
  ];

  constructor() {
    this.commandBusService.commands$
      .pipe(
        filter(
          (command: AppCommand): command is { type: 'TORRENT_DELETED'; hash: string } =>
            command.type === 'TORRENT_DELETED',
        ),
        filter(
          (command: TorrentCommand) =>
            command.type === 'TORRENT_DELETED' && command.hash === this.hash,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.activeModal.close());
  }

  public ngOnInit(): void {
    this.selectTab(this.tabToOpen);
  }

  public async canDeactivate(): Promise<boolean> {
    if (!this.guardService.isDirty()) return true;

    const confirmed = await this.confirmService.confirm(
      'components.modals.guard.unsaved-title',
      'components.modals.guard.unsaved-message',
      'components.modals.guard.btn-leave',
      'components.modals.guard.btn-stay',
    );

    if (confirmed) {
      this.guardService.isDirty.set(false);
    }

    return confirmed;
  }

  public async onDismiss(): Promise<void> {
    if (await this.canDeactivate()) this.activeModal.dismiss();
  }

  public async onClose(): Promise<void> {
    if (await this.canDeactivate()) this.activeModal.close();
  }

  public async selectTab(tabId: TorrentDetailTabId): Promise<void> {
    if (this.activeTabId() === tabId && this.loadedComponent() !== null) return;

    if (!(await this.canDeactivate())) return;

    this.activeTabId.set(tabId);
    this.loadedComponent.set(null);

    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) throw new Error(`Tab with id ${tabId} not found`);

    const component = await tab.loadComponent();
    this.loadedComponent.set(component);
  }
}
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`  
Expected: no errors, no warnings

- [ ] **Step 3: Commit**

```bash
git add src/app/components/modals/torrent-details/torrent-details.ts
git commit -m "$(cat <<'EOF'
#35: Implement GuardableModal in TorrentDetails with canDeactivate guard

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Update `torrent-details.html` to use guarded methods

**Files:**

- Modify: `src/app/components/modals/torrent-details/torrent-details.html`

- [ ] **Step 1: Replace direct modal calls with guarded methods**

Full replacement of the file:

```html
<div class="modal-header bb-modal-header">
  <div class="bb-modal-header__text">
    <h5
      #titleElement
      class="modal-title bb-title-clamp"
      [ngbTooltip]="titleElement.offsetWidth < titleElement.scrollWidth ? torrent()?.name : null"
      placement="bottom"
      tooltipClass="single-line-tooltip"
    >
      {{ torrent()?.name }}
    </h5>

    <div class="small text-body-secondary mt-1 bb-hash-clamp">
      {{ 'components.modals.torrent-details.hash' | translate }}: <code>{{ torrent()?.hash }}</code>
    </div>

    <ul class="nav nav-tabs bb-modal-tabs">
      @for (tab of tabs; track tab.id) {
      <li class="nav-item">
        <button
          class="nav-link"
          [class.active]="activeTabId() === tab.id"
          (click)="selectTab(tab.id)"
        >
          {{ tab.label }}
        </button>
      </li>
      }
    </ul>
  </div>

  <button type="button" class="btn-close" aria-label="Close" (click)="onDismiss()"></button>
</div>

<div class="modal-body">
  @if (loadedComponent()) {
  <ng-container
    *ngComponentOutlet="loadedComponent(); inputs: { hash: torrent()?.hash, context }"
  ></ng-container>
  } @else {
  <app-bb-spinner></app-bb-spinner>
  }
</div>

<div class="modal-footer">
  <button type="button" class="btn btn-link" (click)="onClose()" autofocus>
    {{ 'general.button.close' | translate }}
  </button>
</div>
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`  
Expected: no errors, no warnings

- [ ] **Step 3: Commit**

```bash
git add src/app/components/modals/torrent-details/torrent-details.html
git commit -m "$(cat <<'EOF'
#35: Replace direct modal dismiss/close calls with guarded methods

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Add `beforeDismiss` to `ui-command-handler.service.ts`

**Files:**

- Modify: `src/app/services/ui-command-handler.service.ts`

`beforeDismiss` is NgBootstrap's hook for Escape key and backdrop click. It must be passed **inline at `modalService.open()` time** — `NgbModalRef.update()` does not support updating `beforeDismiss` after open in NgBootstrap 19.

There are **two** places where `TorrentDetails` is opened:

1. `UI_OPEN_TORRENT_DETAILS` case (line ~84)
2. `UI_RENAME_FILES` case (line ~240)

Both need `beforeDismiss` added.

- [ ] **Step 1: Update `UI_OPEN_TORRENT_DETAILS` case**

Replace:

```typescript
const torrentDetailsModalRef = this.modalService.open(TorrentDetails, {
  size: 'xl',
  scrollable: true,
  centered: false,
});
```

With:

```typescript
const torrentDetailsModalRef = this.modalService.open(TorrentDetails, {
  size: 'xl',
  scrollable: true,
  centered: false,
  beforeDismiss: () => torrentDetailsModalRef.componentInstance.canDeactivate(),
});
```

- [ ] **Step 2: Update `UI_RENAME_FILES` case**

Replace:

```typescript
const contentModalRef = this.modalService.open(TorrentDetails, {
  size: 'xl',
  scrollable: true,
  centered: false,
});
```

With:

```typescript
const contentModalRef = this.modalService.open(TorrentDetails, {
  size: 'xl',
  scrollable: true,
  centered: false,
  beforeDismiss: () => contentModalRef.componentInstance.canDeactivate(),
});
```

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`  
Expected: no errors, no warnings

- [ ] **Step 4: Commit**

```bash
git add src/app/services/ui-command-handler.service.ts
git commit -m "$(cat <<'EOF'
#35: Add beforeDismiss guard to TorrentDetails modal open calls

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Spec Coverage Check

| Spec requirement                                  | Covered by |
| ------------------------------------------------- | ---------- |
| `ModalGuardService` with `isDirty` signal         | Task 1     |
| `GuardableModal` interface                        | Task 1     |
| `TorrentDetails` provides `ModalGuardService`     | Task 5     |
| `TorrentDetails` implements `GuardableModal`      | Task 5     |
| `canDeactivate()` uses `ConfirmService`           | Task 5     |
| `onDismiss()` / `onClose()` methods               | Task 5     |
| `selectTab()` guards with `canDeactivate()`       | Task 5     |
| X button → `onDismiss()`                          | Task 6     |
| Footer Close → `onClose()`                        | Task 6     |
| `content.ts` sets `isDirty` from `editModeChange` | Task 3     |
| `content.html` binds `(editModeChange)`           | Task 4     |
| Escape / backdrop → `beforeDismiss`               | Task 7     |
| i18n keys EN + HU                                 | Task 2     |
| Both `TorrentDetails` open sites covered          | Task 7     |
