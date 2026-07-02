# Uniform "Open Destination" button + row double-click fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "Open Destination" action consistent across the Torrent Details modal footer and the grid context menu (always visible, disabled-with-tooltip when path mappings don't resolve), and fix the grid's row-double-click "Open Destination" action so it resolves the path (and fails gracefully) instead of throwing an OS-level error.

**Architecture:** Three independent, sequential changes in the existing Angular 20 (zoneless, signal-based) renderer: (1) a template/SCSS/i18n change to the Torrent Details modal footer, (2) a template/component change to the shared grid context menu component that swaps its hand-rolled tooltip mechanism for `ngbTooltip`, and (3) a one-line behavior fix in the grid's row-double-click handler that routes through the existing `UI_OPEN_DESTINATION` command instead of calling Electron directly.

**Tech Stack:** Angular 20, `@ng-bootstrap/ng-bootstrap` (`NgbTooltip`, `NgbDropdownItem`), `@ngx-translate/core`, Vitest (via `ng test`, runner: vitest).

## Global Constraints

- Use `-` (hyphen), never `—` (em dash), in all code comments, commit messages, and docs.
- Commit format: `#198: short description` (this work continues on the existing `198-reorganize-context-menu-and-modal-footer-groups` branch).
- `npm run lint` must pass with zero warnings (`max-warnings=0`) - remove any import/field that becomes unused.
- Every new user-facing string needs an entry in both `public/i18n/us.json` and `public/i18n/hu.json`.
- Do not use the native `disabled` attribute/input on any element that also carries an `ngbTooltip` meant to explain _why_ it's disabled - disabled form controls (and Bootstrap's `.disabled`/`:disabled` CSS, which sets `pointer-events: none`) never fire `mouseenter`, so the tooltip would never open. Use a visual-only disabled class + a guarded click handler instead.

---

### Task 1: Torrent Details modal footer - always show "Open Destination", disable+tooltip when unresolved

**Files:**

- Modify: `packages/app/src/app/modals/torrent-details/torrent-details.html:112-125`
- Modify: `packages/app/src/styles.scss:436-442`
- Modify: `public/i18n/us.json` (new key under `components.modals.torrent-details.general.tooltip`)
- Modify: `public/i18n/hu.json` (same key)
- Test: `packages/app/src/app/modals/torrent-details/torrent-details.spec.ts`

**Interfaces:**

- Consumes: `dataService.localPath(): string | null` (existing signal, already injected as `dataService` in `torrent-details.ts`), `actionsService.openPath(): void` (existing method on `TorrentDetailsActionsService`, already injected as `actionsService`).
- Produces: no new public interface - this is a leaf template/style change.

- [ ] **Step 1: Write the failing test**

  Replace the existing `describe('manage dropdown open-destination item', ...)` block (lines 198-219 of `torrent-details.spec.ts`) with:

  ```ts
  describe('files dropdown open-destination item', () => {
    it('is always present, even when there is no localPath', () => {
      mockDataService.localPath.set(null);
      fixture.detectChanges();
      const items: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('[ngbDropdownItem]'),
      );
      expect(items.some((i) => i.textContent?.includes('open-destination'))).toBe(true);
    });

    it('is visually disabled and does not call openPath when there is no localPath', () => {
      mockDataService.localPath.set(null);
      fixture.detectChanges();
      const items: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('[ngbDropdownItem]'),
      );
      const openDestinationItem = items.find((i) => i.textContent?.includes('open-destination'));
      expect(openDestinationItem).toBeDefined();
      expect(openDestinationItem?.classList.contains('bb-dropdown-item--disabled')).toBe(true);
      expect(openDestinationItem?.getAttribute('aria-disabled')).toBe('true');
      openDestinationItem?.click();
      expect(mockActionsService['openPath']).not.toHaveBeenCalled();
    });

    it('is enabled and calls openPath when there is a localPath', () => {
      mockDataService.localPath.set('/local/path');
      fixture.detectChanges();
      const items: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('[ngbDropdownItem]'),
      );
      const openDestinationItem = items.find((i) => i.textContent?.includes('open-destination'));
      expect(openDestinationItem).toBeDefined();
      expect(openDestinationItem?.classList.contains('bb-dropdown-item--disabled')).toBe(false);
      expect(openDestinationItem?.getAttribute('aria-disabled')).toBeNull();
      openDestinationItem?.click();
      expect(mockActionsService['openPath']).toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 2: Run the tests to verify the new ones fail**

  Run (from `packages/app`): `npx ng test --watch=false --include=src/app/modals/torrent-details/torrent-details.spec.ts`

  Expected: FAIL - `'is always present, even when there is no localPath'` fails because the button is still wrapped in `@if (dataService.localPath())` and is absent from the DOM.

- [ ] **Step 3: Implement**

  In `packages/app/src/app/modals/torrent-details/torrent-details.html`, replace:

  ```html
  <div ngbDropdownMenu class="bb-toolbar-dropdown">
    @if (dataService.localPath()) {
    <button ngbDropdownItem type="button" (click)="actionsService.openPath()">
      <span class="bb-dropdown-icon" aria-hidden="true"
        ><fa-icon [icon]="icon.faFolderOpen"></fa-icon
      ></span>
      {{ (dataService.singleFile() ? 'components.modals.torrent-details.general.show-file' :
      'components.modals.torrent-details.general.open-destination' ) | translate }}
    </button>
    }
  </div>
  ```

  with:

  ```html
  <div ngbDropdownMenu class="bb-toolbar-dropdown">
    <button
      ngbDropdownItem
      type="button"
      [class.bb-dropdown-item--disabled]="!dataService.localPath()"
      [attr.aria-disabled]="!dataService.localPath() ? 'true' : null"
      [ngbTooltip]="
            'components.modals.torrent-details.general.tooltip.open-destination-unresolved'
              | translate
          "
      [disableTooltip]="!!dataService.localPath()"
      placement="right"
      container="body"
      (click)="dataService.localPath() && actionsService.openPath()"
    >
      <span class="bb-dropdown-icon" aria-hidden="true"
        ><fa-icon [icon]="icon.faFolderOpen"></fa-icon
      ></span>
      {{ (dataService.singleFile() ? 'components.modals.torrent-details.general.show-file' :
      'components.modals.torrent-details.general.open-destination' ) | translate }}
    </button>
  </div>
  ```

  In `packages/app/src/styles.scss`, inside the `.bb-toolbar-dropdown .dropdown-item` block, replace:

  ```scss
      &:disabled,
      &.disabled {
        opacity: 0.45;
        pointer-events: none;
      }
    }
  ```

  with:

  ```scss
      &:disabled,
      &.disabled {
        opacity: 0.45;
        pointer-events: none;
      }

      &.bb-dropdown-item--disabled {
        opacity: 0.45;
        cursor: not-allowed;

        &:hover {
          background: transparent;
        }
      }
    }
  ```

  In `public/i18n/us.json`, inside `components.modals.torrent-details.general` (as a new sibling of `"force-start"`, right before `"labels": {`, around line 384), add:

  ```json
          "tooltip": {
            "open-destination-unresolved": "This torrent's save path could not be resolved on this machine."
          },
  ```

  In `public/i18n/hu.json`, at the same position (also right before `"labels": {`, around line 384), add:

  ```json
          "tooltip": {
            "open-destination-unresolved": "A torrent mentési útvonala nem feloldható ezen a gépen."
          },
  ```

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `npx ng test --watch=false --include=src/app/modals/torrent-details/torrent-details.spec.ts`

  Expected: PASS (all tests, including the 3 new ones)

- [ ] **Step 5: Commit**

  ```bash
  git add packages/app/src/app/modals/torrent-details/torrent-details.html packages/app/src/app/modals/torrent-details/torrent-details.spec.ts packages/app/src/styles.scss public/i18n/us.json public/i18n/hu.json
  git commit -m "$(cat <<'EOF'
  #198: always show open destination button, disable with tooltip when unresolved

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 2: Context menu - replace the manual tooltip mechanism with `ngbTooltip`

**Files:**

- Modify: `packages/app/src/app/pages/main/grid/context-menu/context-menu.html`
- Modify: `packages/app/src/app/pages/main/grid/context-menu/context-menu.ts`
- Modify: `packages/app/src/app/pages/main/grid/context-menu/context-menu.scss`
- Test: `packages/app/src/app/pages/main/grid/context-menu/context-menu.spec.ts`

**Interfaces:**

- Consumes: `ContextMenuEntry` (`kind: 'item'` variant's `disabled?: boolean` and `tooltip?: string` fields - unchanged, from `context-menu.types.ts`).
- Produces: no new public interface - `entry.disabled`/`entry.tooltip` continue to mean the same thing to `grid-context-menu.service.ts`, which needs no changes.

- [ ] **Step 1: Write the failing test**

  In `context-menu.spec.ts`, add these imports at the top (alongside the existing ones):

  ```ts
  import { By } from '@angular/platform-browser';
  import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
  ```

  Replace the entire `describe('tooltip popover', ...)` block (lines 107-183) with:

  ```ts
  describe('disabled item tooltip', () => {
    async function renderMenu(
      menuItems: ContextMenuEntry[],
    ): Promise<ComponentFixture<ContextMenu>> {
      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [ContextMenu, OverlayModule],
        providers: [
          { provide: OverlayRef, useValue: makeOverlayRefMock() },
          { provide: CONTEXT_MENU_CONFIG, useValue: { items: menuItems } },
        ],
      }).compileComponents();
      const f = TestBed.createComponent(ContextMenu);
      f.detectChanges();
      return f;
    }

    it('binds the translated tooltip text for a disabled item with a tooltip', async () => {
      const f = await renderMenu([
        { kind: 'item', id: 'x', label: 'X', disabled: true, tooltip: 'Not available right now' },
      ]);
      const tooltip = f.debugElement.query(By.css('.bb-item')).injector.get(NgbTooltip);
      expect(tooltip.ngbTooltip).toBe('Not available right now');
      expect(tooltip.disableTooltip).toBeFalsy();
    });

    it('disables the tooltip for an enabled item even if it has a tooltip', async () => {
      const f = await renderMenu([
        { kind: 'item', id: 'x', label: 'X', disabled: false, tooltip: 'Should not show' },
      ]);
      const tooltip = f.debugElement.query(By.css('.bb-item')).injector.get(NgbTooltip);
      expect(tooltip.disableTooltip).toBeTruthy();
    });

    it('disables the tooltip for a disabled item with no tooltip text', async () => {
      const f = await renderMenu([{ kind: 'item', id: 'x', label: 'X', disabled: true }]);
      const tooltip = f.debugElement.query(By.css('.bb-item')).injector.get(NgbTooltip);
      expect(tooltip.disableTooltip).toBeTruthy();
    });

    it('uses top placement for the open-destination item', async () => {
      const f = await renderMenu([
        {
          kind: 'item',
          id: 'files.openDestination',
          label: 'X',
          disabled: true,
          tooltip: 'Hint',
        },
      ]);
      const tooltip = f.debugElement.query(By.css('.bb-item')).injector.get(NgbTooltip);
      expect(tooltip.placement).toBe('top');
    });

    it('uses right placement for every other item', async () => {
      const f = await renderMenu([
        { kind: 'item', id: 'row.pinToTop', label: 'X', disabled: true, tooltip: 'Hint' },
      ]);
      const tooltip = f.debugElement.query(By.css('.bb-item')).injector.get(NgbTooltip);
      expect(tooltip.placement).toBe('right');
    });
  });
  ```

- [ ] **Step 2: Run the tests to verify the new ones fail**

  Run (from `packages/app`): `npx ng test --watch=false --include=src/app/pages/main/grid/context-menu/context-menu.spec.ts`

  Expected: FAIL - `injector.get(NgbTooltip)` throws `NullInjectorError` because the `[ngbTooltip]` directive isn't attached to `.bb-item` yet (`ContextMenu` doesn't import `NgbTooltipModule`).

- [ ] **Step 3: Implement**

  In `context-menu.ts`, replace the imports:

  ```ts
  import { Clipboard } from '@angular/cdk/clipboard';
  import { Overlay, OverlayRef } from '@angular/cdk/overlay';
  import { ComponentPortal } from '@angular/cdk/portal';
  import { CommonModule } from '@angular/common';
  import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    Injector,
    OnDestroy,
    ViewChild,
    inject,
    signal,
  } from '@angular/core';
  import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
  import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
  import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
  import { TranslatePipe } from '@ngx-translate/core';
  import { fromEvent } from 'rxjs';
  import { takeUntil } from 'rxjs/operators';
  ```

  with:

  ```ts
  import { Clipboard } from '@angular/cdk/clipboard';
  import { Overlay, OverlayRef } from '@angular/cdk/overlay';
  import { ComponentPortal } from '@angular/cdk/portal';
  import { CommonModule } from '@angular/common';
  import {
    ChangeDetectionStrategy,
    Component,
    Injector,
    OnDestroy,
    inject,
    signal,
  } from '@angular/core';
  import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
  import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
  import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
  import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
  import { TranslatePipe } from '@ngx-translate/core';
  import { fromEvent } from 'rxjs';
  import { takeUntil } from 'rxjs/operators';
  ```

  Replace the `@Component` decorator's `imports` array:

  ```ts
    imports: [CommonModule, FontAwesomeModule, TranslatePipe],
  ```

  with:

  ```ts
    imports: [CommonModule, FontAwesomeModule, NgbTooltipModule, TranslatePipe],
  ```

  Remove the `tooltipElRef` field and the `tooltipText` signal:

  ```ts
    @ViewChild('tooltipEl', { static: true })
    private tooltipElRef!: ElementRef<HTMLElement>;

    readonly faChevronRight = faChevronRight;
    readonly activeSubmenuId = signal<string | null>(null);
    readonly tooltipText = signal<string | null>(null);
  ```

  with:

  ```ts
    readonly faChevronRight = faChevronRight;
    readonly activeSubmenuId = signal<string | null>(null);
  ```

  Remove the `onItemMouseEnter`/`onItemMouseLeave` methods:

  ```ts
    onItemMouseEnter(entry: ContextMenuEntry, target: HTMLElement): void {
      if (entry.kind !== 'item' || !entry.disabled || !entry.tooltip) return;

      this.tooltipText.set(entry.tooltip);

      const tooltipEl = this.tooltipElRef.nativeElement;
      const rect = target.getBoundingClientRect();
      tooltipEl.style.top = `${rect.top}px`;
      tooltipEl.style.left = `${rect.right + 6}px`;
      tooltipEl.showPopover();
    }

    onItemMouseLeave(): void {
      this.tooltipText.set(null);
      this.tooltipElRef.nativeElement.hidePopover();
    }

  ```

  (delete these two methods entirely - nothing replaces them)

  Remove the now-unused `asHtmlElement` helper at the bottom of the class:

  ```ts
    protected readonly asHtmlElement = (el: EventTarget | null): HTMLElement => el as HTMLElement;
  ```

  In `context-menu.html`, replace the `kind === 'item'` button block:

  ```html
  @if (entry.kind === 'item') {
  <button
    type="button"
    class="bb-item"
    [class.bb-danger]="entry.variant === 'danger'"
    [class.bb-warning]="entry.variant === 'warning'"
    [class.bb-success]="entry.variant === 'success'"
    [class.bb-info]="entry.variant === 'info'"
    [class.bb-item--disabled]="entry.disabled"
    [attr.aria-disabled]="entry.disabled ? 'true' : null"
    (click)="onEntryClick(entry)"
    (mouseenter)="onItemMouseEnter(entry, asHtmlElement($event.currentTarget))"
    (mouseleave)="onItemMouseLeave()"
    role="menuitem"
  ></button>
  ```

  with:

  ```html
  @if (entry.kind === 'item') {
  <button
    type="button"
    class="bb-item"
    [class.bb-danger]="entry.variant === 'danger'"
    [class.bb-warning]="entry.variant === 'warning'"
    [class.bb-success]="entry.variant === 'success'"
    [class.bb-info]="entry.variant === 'info'"
    [class.bb-item--disabled]="entry.disabled"
    [attr.aria-disabled]="entry.disabled ? 'true' : null"
    [ngbTooltip]="entry.tooltip ? (entry.tooltip | translate) : null"
    [disableTooltip]="!(entry.disabled && entry.tooltip)"
    [placement]="entry.id === 'files.openDestination' ? 'top' : 'right'"
    container="body"
    (click)="onEntryClick(entry)"
    role="menuitem"
  ></button>
  ```

  Remove the popover div at the bottom of `context-menu.html`:

  ```html
  <div #tooltipEl popover="manual" class="bb-tooltip-popover">{{ tooltipText() | translate }}</div>
  ```

  (delete it - the closing `</div>` for `.bb-menu` on the last line stays)

  In `context-menu.scss`, remove the now-unused rule:

  ```scss
  .bb-tooltip-popover {
    position: fixed;
    inset: unset;
    margin: 0;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
    max-width: 260px;
    background: var(--bs-tooltip-bg, #000);
    color: var(--bs-tooltip-color, #fff);
    border: 1px solid var(--bs-border-color);
    pointer-events: none;
  }
  ```

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `npx ng test --watch=false --include=src/app/pages/main/grid/context-menu/context-menu.spec.ts`

  Expected: PASS (all tests, including the 5 new ones)

- [ ] **Step 5: Run lint to confirm no unused-import/unused-field warnings**

  Run (from repo root): `npm run lint`

  Expected: PASS with zero warnings (confirms `ElementRef`, `ViewChild`, `asHtmlElement`, and the removed methods left no dangling references)

- [ ] **Step 6: Commit**

  ```bash
  git add packages/app/src/app/pages/main/grid/context-menu/context-menu.html packages/app/src/app/pages/main/grid/context-menu/context-menu.ts packages/app/src/app/pages/main/grid/context-menu/context-menu.scss packages/app/src/app/pages/main/grid/context-menu/context-menu.spec.ts
  git commit -m "$(cat <<'EOF'
  #198: replace context menu's manual tooltip popover with ngbTooltip

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 3: Fix row double-click "Open Destination" to resolve the path instead of erroring

**Files:**

- Modify: `packages/app/src/app/pages/main/grid/grid.ts:1-353` (imports + `handleRowDoubleClick`)
- Test: `packages/app/src/app/pages/main/grid/grid.spec.ts`

**Interfaces:**

- Consumes: `CommandBusService.emit(cmd: AppCommand): void` (already injected as `this.commandBusService`); the `UI_OPEN_DESTINATION` command shape `{ type: 'UI_OPEN_DESTINATION'; remotePath: string | null; hash: string }` from `command.model.ts:28` (already handled by `ui-command-handler.service.ts:285`, unchanged).
- Produces: no new public interface.

- [ ] **Step 1: Write the failing test**

  In `grid.spec.ts`, add `of` to the existing `rxjs` import:

  ```ts
  import { Subject } from 'rxjs';
  ```

  becomes:

  ```ts
  import { Subject, of } from 'rxjs';
  ```

  Then add a new `describe` block (e.g. right after the `describe('applyGridSettings', ...)` block, before the closing `});` of the outer `describe('Grid', ...)`):

  ```ts
  describe('handleRowDoubleClick', () => {
    it('emits UI_OPEN_DESTINATION with content_path and hash when rowDoubleClickAction is SAVE_PATH', async () => {
      const settingsService = TestBed.inject(TorrentListGridSettingsService);
      (settingsService.asObservable as ReturnType<typeof vi.fn>).mockReturnValue(
        of({ rowDoubleClickAction: 'SAVE_PATH' }),
      );
      const commandBusService = TestBed.inject(CommandBusService);

      await (component as any).handleRowDoubleClick({
        data: { hash: 'abc123', content_path: '/remote/content/path', save_path: '/remote/save' },
      });

      expect(commandBusService.emit).toHaveBeenCalledWith({
        type: 'UI_OPEN_DESTINATION',
        remotePath: '/remote/content/path',
        hash: 'abc123',
      });
    });

    it('does not emit anything when content_path is missing', async () => {
      const settingsService = TestBed.inject(TorrentListGridSettingsService);
      (settingsService.asObservable as ReturnType<typeof vi.fn>).mockReturnValue(
        of({ rowDoubleClickAction: 'SAVE_PATH' }),
      );
      const commandBusService = TestBed.inject(CommandBusService);

      await (component as any).handleRowDoubleClick({
        data: { hash: 'abc123', content_path: '', save_path: '/remote/save' },
      });

      expect(commandBusService.emit).not.toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 2: Run the tests to verify the new ones fail**

  Run (from `packages/app`): `npx ng test --watch=false --include=src/app/pages/main/grid/grid.spec.ts`

  Expected: FAIL - `commandBusService.emit` was not called with the expected `UI_OPEN_DESTINATION` payload, because `handleRowDoubleClick` still calls `electronService.openPath(event.data.save_path)` directly.

- [ ] **Step 3: Implement**

  In `grid.ts`, replace:

  ```ts
    private handleRowDoubleClick = async (event: RowDoubleClickedEvent<Torrent, any>) => {
      if (!event.data) return;
      const settings = await firstValueFrom(this.torrentListGridSettingsService.asObservable());
      const action = settings?.rowDoubleClickAction ?? 'DETAILS';
      if (action === 'INLINE_EDIT') return;
      if (action === 'DETAILS')
        this.commandBusService.emit({ type: 'UI_OPEN_TORRENT_DETAILS', hash: event.data.hash });
      else if (action === 'SAVE_PATH' && event.data.save_path)
        this.electronService.openPath(event.data.save_path);
    };
  ```

  with:

  ```ts
    private handleRowDoubleClick = async (event: RowDoubleClickedEvent<Torrent, any>) => {
      if (!event.data) return;
      const settings = await firstValueFrom(this.torrentListGridSettingsService.asObservable());
      const action = settings?.rowDoubleClickAction ?? 'DETAILS';
      if (action === 'INLINE_EDIT') return;
      if (action === 'DETAILS')
        this.commandBusService.emit({ type: 'UI_OPEN_TORRENT_DETAILS', hash: event.data.hash });
      else if (action === 'SAVE_PATH' && event.data.content_path)
        this.commandBusService.emit({
          type: 'UI_OPEN_DESTINATION',
          remotePath: event.data.content_path,
          hash: event.data.hash,
        });
    };
  ```

  Remove the now-unused `ElectronService` import and injection. Replace:

  ```ts
  import { CommandBusService } from '../../../services/command-bus.service';
  import { ContextMenuService } from '../../../services/context-menu.service';
  import { ElectronService } from '../../../services/electron.service';
  import { FilterService } from '../../../services/filter.service';
  ```

  with:

  ```ts
  import { CommandBusService } from '../../../services/command-bus.service';
  import { ContextMenuService } from '../../../services/context-menu.service';
  import { FilterService } from '../../../services/filter.service';
  ```

  and remove:

  ```ts
    private readonly electronService = inject(ElectronService);
  ```

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `npx ng test --watch=false --include=src/app/pages/main/grid/grid.spec.ts`

  Expected: PASS (all tests, including the 2 new ones)

- [ ] **Step 5: Run lint to confirm the removed `ElectronService` injection left no unused-import warning**

  Run (from repo root): `npm run lint`

  Expected: PASS with zero warnings

- [ ] **Step 6: Commit**

  ```bash
  git add packages/app/src/app/pages/main/grid/grid.ts packages/app/src/app/pages/main/grid/grid.spec.ts
  git commit -m "$(cat <<'EOF'
  #198: resolve local path before opening destination on row double-click

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Final verification

- [ ] Run the full test suite: `npm test` (from repo root) - expect all tests passing.
- [ ] Run the full lint: `npm run lint` (from repo root) - expect zero warnings.
- [ ] Run `npm run format` (from repo root) to ensure Prettier formatting is applied consistently across all touched files.
