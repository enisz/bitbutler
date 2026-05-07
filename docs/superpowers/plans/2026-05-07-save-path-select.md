# Save Path Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all `ngbTypeahead`-based save-path inputs with a new reusable `SavePathSelect` component backed by `ng-select`, then delete `TypeaheadService`.

**Architecture:** A new standalone `ControlValueAccessor` component `SavePathSelect` derives unique sorted paths from `TorrentStoreService.torrentsArray()` and wraps `ng-select` with `[addTag]` support for free-form entries. It replaces the `ngbTypeahead` inputs in `add-torrent`, `set-torrent-location`, and the server settings path-mappings form.

**Tech Stack:** Angular 20 (zoneless, signals), `@ng-select/ng-select`, `@ngx-translate/core`, Vitest (`vi.fn()`)

---

## File Map

| Action | Path                                                                                       |
| ------ | ------------------------------------------------------------------------------------------ |
| Create | `packages/app/src/app/components/save-path-select/save-path-select.ts`                     |
| Create | `packages/app/src/app/components/save-path-select/save-path-select.html`                   |
| Create | `packages/app/src/app/components/save-path-select/save-path-select.scss`                   |
| Create | `packages/app/src/app/components/save-path-select/save-path-select.spec.ts`                |
| Modify | `public/i18n/us.json`                                                                      |
| Modify | `public/i18n/hu.json`                                                                      |
| Modify | `packages/app/src/app/components/add-torrent/add-torrent.ts`                               |
| Modify | `packages/app/src/app/components/add-torrent/add-torrent.html`                             |
| Modify | `packages/app/src/app/components/add-torrent/add-torrent.spec.ts`                          |
| Modify | `packages/app/src/app/components/modals/set-torrent-location/set-torrent-location.ts`      |
| Modify | `packages/app/src/app/components/modals/set-torrent-location/set-torrent-location.html`    |
| Modify | `packages/app/src/app/components/modals/set-torrent-location/set-torrent-location.spec.ts` |
| Modify | `packages/app/src/app/pages/settings/server/server.ts`                                     |
| Modify | `packages/app/src/app/pages/settings/server/server.html`                                   |
| Modify | `packages/app/src/app/pages/settings/server/server.spec.ts`                                |
| Delete | `packages/app/src/app/services/typeahead.service.ts`                                       |
| Delete | `packages/app/src/app/services/typeahead.service.spec.ts`                                  |

---

## Task 1: Create `save-path-select` component

**Files:**

- Create: `packages/app/src/app/components/save-path-select/save-path-select.ts`
- Create: `packages/app/src/app/components/save-path-select/save-path-select.html`
- Create: `packages/app/src/app/components/save-path-select/save-path-select.scss`
- Create: `packages/app/src/app/components/save-path-select/save-path-select.spec.ts`
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

- [ ] **Step 1: Write the failing spec**

Create `packages/app/src/app/components/save-path-select/save-path-select.spec.ts`:

```typescript
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { SavePathSelect } from './save-path-select';

describe('SavePathSelect', () => {
  let component: SavePathSelect;
  let fixture: ComponentFixture<SavePathSelect>;
  let torrentsSignal: ReturnType<typeof signal<any[]>>;

  beforeEach(async () => {
    torrentsSignal = signal([]);

    await TestBed.configureTestingModule({
      imports: [SavePathSelect],
      providers: [{ provide: TorrentStoreService, useValue: { torrentsArray: torrentsSignal } }],
    }).compileComponents();

    fixture = TestBed.createComponent(SavePathSelect);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('paths', () => {
    it('should derive unique sorted paths from torrents', () => {
      torrentsSignal.set([
        { save_path: '/media/movies' },
        { save_path: '/downloads' },
        { save_path: '/media/movies' },
      ]);
      expect(component.paths()).toEqual(['/downloads', '/media/movies']);
    });

    it('should return empty array when no torrents', () => {
      expect(component.paths()).toEqual([]);
    });
  });

  describe('addTag', () => {
    it('should return the typed term as-is', () => {
      expect(component.addTag('/new/custom/path')).toBe('/new/custom/path');
    });
  });

  describe('writeValue', () => {
    it('should set the select control value', () => {
      component.writeValue('/downloads');
      expect(component.selectControl.value).toBe('/downloads');
    });

    it('should set null', () => {
      component.writeValue(null);
      expect(component.selectControl.value).toBeNull();
    });
  });

  describe('setDisabledState', () => {
    it('should disable the control', () => {
      component.setDisabledState(true);
      expect(component.selectControl.disabled).toBe(true);
    });

    it('should enable the control', () => {
      component.setDisabledState(true);
      component.setDisabledState(false);
      expect(component.selectControl.enabled).toBe(true);
    });
  });

  describe('keyDownFn', () => {
    it('should return false for Escape key', () => {
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      expect(component.keyDownFn(event)).toBe(false);
    });

    it('should return true for other keys', () => {
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      expect(component.keyDownFn(event)).toBe(true);
    });
  });

  describe('ngOnInit', () => {
    it('should call onChange when selectControl value changes', () => {
      const onChange = vi.fn();
      component.registerOnChange(onChange);
      component.ngOnInit();
      component.selectControl.setValue('/new/path');
      expect(onChange).toHaveBeenCalledWith('/new/path');
    });
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd packages/app && npx ng test --watch=false --include="**/save-path-select.spec.ts" 2>&1 | tail -20
```

Expected: error about `SavePathSelect` not found.

- [ ] **Step 3: Create the component class**

Create `packages/app/src/app/components/save-path-select/save-path-select.ts`:

```typescript
import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  Input,
  OnInit,
  ViewChild,
  computed,
  forwardRef,
  inject,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import { NgSelectComponent } from '@ng-select/ng-select';
import { TranslatePipe } from '@ngx-translate/core';
import { TorrentStoreService } from '../../services/torrent-store.service';

@Component({
  selector: 'app-save-path-select',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgSelectComponent, TranslatePipe],
  templateUrl: './save-path-select.html',
  styleUrls: ['./save-path-select.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SavePathSelect),
      multi: true,
    },
  ],
})
export class SavePathSelect implements OnInit, ControlValueAccessor, AfterViewInit {
  @Input() autofocus = false;
  @ViewChild('ngselect') ngselect!: NgSelectComponent;

  private readonly torrentStoreService = inject(TorrentStoreService);

  public paths = computed(() => {
    const uniquePaths = new Set<string>();
    for (const t of this.torrentStoreService.torrentsArray()) {
      const path = t.save_path?.trim();
      if (path) uniquePaths.add(path);
    }
    return Array.from(uniquePaths).sort();
  });

  public selectControl = new FormControl<string | null>(null);

  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  public ngOnInit(): void {
    this.selectControl.valueChanges.subscribe((value) => {
      this.onChange(value);
      this.onTouched();
    });
  }

  public ngAfterViewInit(): void {
    if (this.autofocus) {
      this.ngselect.focus();
    }
  }

  writeValue(value: string | null): void {
    this.selectControl.setValue(value, { emitEvent: false });
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.selectControl.disable();
    } else {
      this.selectControl.enable();
    }
  }

  addTag = (term: string): string => term;

  keyDownFn(event: KeyboardEvent): boolean {
    if (event.key === 'Escape') {
      return false;
    }
    return true;
  }
}
```

- [ ] **Step 4: Create the template**

Create `packages/app/src/app/components/save-path-select/save-path-select.html`:

```html
<div class="form-floating">
  <ng-select
    [items]="paths()"
    [addTag]="addTag"
    [searchable]="true"
    [clearable]="true"
    [formControl]="selectControl"
    [keyDownFn]="keyDownFn"
    [openOnEnter]="false"
    #ngselect
  >
  </ng-select>
  <label>{{ 'components.save-path-select.label' | translate }}</label>
</div>
```

- [ ] **Step 5: Create the empty stylesheet**

Create `packages/app/src/app/components/save-path-select/save-path-select.scss` with empty content (one blank line — matches `category-select.scss` and `tag-select.scss`).

- [ ] **Step 6: Add translation keys**

In `public/i18n/us.json`, find the `"tag-select"` block and add `"save-path-select"` immediately after it:

```json
    "tag-select": {
      "label": "Tags"
    },
    "save-path-select": {
      "label": "Save Path"
    },
```

In `public/i18n/hu.json`, do the same (Hungarian label is the same wording — "Mentési útvonal"):

```json
    "tag-select": {
      "label": "Címkék"
    },
    "save-path-select": {
      "label": "Mentési útvonal"
    },
```

- [ ] **Step 7: Run tests and confirm they pass**

```bash
cd packages/app && npx ng test --watch=false --include="**/save-path-select.spec.ts" 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/app/components/save-path-select/ public/i18n/us.json public/i18n/hu.json
git commit -m "#66: add SavePathSelect component"
```

---

## Task 2: Migrate `add-torrent`

**Files:**

- Modify: `packages/app/src/app/components/add-torrent/add-torrent.ts`
- Modify: `packages/app/src/app/components/add-torrent/add-torrent.html`
- Modify: `packages/app/src/app/components/add-torrent/add-torrent.spec.ts`

- [ ] **Step 1: Update the component class**

In `packages/app/src/app/components/add-torrent/add-torrent.ts` make these changes:

Remove from imports array at the top of the file:

```typescript
import { NgbActiveModal, NgbModal, NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { TypeaheadService } from '../../services/typeahead.service';
```

Replace with (keep `NgbActiveModal` and `NgbModal`, drop `NgbTypeahead`):

```typescript
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
```

Add the new import:

```typescript
import { SavePathSelect } from '../save-path-select/save-path-select';
```

In the `@Component` imports array, replace `NgbTypeahead` with `SavePathSelect`.

Remove the private injection and public property:

```typescript
private readonly typeaheadService = inject(TypeaheadService);
// ...
public readonly searchSavePaths = this.typeaheadService.searchSavePaths;
```

Remove the `@ViewChild`:

```typescript
@ViewChild('savePathControl') public savePathControl!: ElementRef;
```

Also remove `ElementRef` from the `@angular/core` import if it is no longer used elsewhere (check the file — `ElementRef` is only used for `savePathControl`).

- [ ] **Step 2: Update the template**

In `packages/app/src/app/components/add-torrent/add-torrent.html`, replace the entire savepath `<div class="form-floating mb-3">` block (lines 73–94) with:

```html
<div class="mb-3">
  <app-save-path-select formControlName="savepath"></app-save-path-select>
</div>
```

- [ ] **Step 3: Update the spec**

In `packages/app/src/app/components/add-torrent/add-torrent.spec.ts`:

Remove this import:

```typescript
import { TypeaheadService } from '../../services/typeahead.service';
```

Remove this line from the `of` import (if `of` is now unused, remove the whole rxjs import):

```typescript
import { of } from 'rxjs';
```

Remove the `TypeaheadService` provider from the `providers` array:

```typescript
{
  provide: TypeaheadService,
  useValue: { searchSavePaths: vi.fn().mockReturnValue(of([])) },
},
```

- [ ] **Step 4: Run tests**

```bash
cd packages/app && npx ng test --watch=false --include="**/add-torrent.spec.ts" 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/add-torrent/
git commit -m "#66: migrate add-torrent savepath to SavePathSelect"
```

---

## Task 3: Migrate `set-torrent-location`

**Files:**

- Modify: `packages/app/src/app/components/modals/set-torrent-location/set-torrent-location.ts`
- Modify: `packages/app/src/app/components/modals/set-torrent-location/set-torrent-location.html`
- Modify: `packages/app/src/app/components/modals/set-torrent-location/set-torrent-location.spec.ts`

- [ ] **Step 1: Update the component class**

In `packages/app/src/app/components/modals/set-torrent-location/set-torrent-location.ts`:

Remove these imports:

```typescript
import { NgbActiveModal, NgbTooltip, NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { AutofocusDirective } from '../../../directives/autofocus';
import { TypeaheadService } from '../../../services/typeahead.service';
```

Replace with (keep `NgbActiveModal` and `NgbTooltip`):

```typescript
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
```

Add:

```typescript
import { SavePathSelect } from '../../save-path-select/save-path-select';
```

In the `@Component` imports array, replace `NgbTypeahead` and `AutofocusDirective` with `SavePathSelect`.

Remove these lines from the class body:

```typescript
@ViewChild('savePathControl') public savePathControl!: ElementRef;
private readonly typeaheadService = inject(TypeaheadService);
// ...
public readonly searchSavePaths = this.typeaheadService.searchSavePaths;
```

Also remove `ElementRef` and `ViewChild` from the `@angular/core` import if no longer used.

- [ ] **Step 2: Update the template**

In `packages/app/src/app/components/modals/set-torrent-location/set-torrent-location.html`, replace the entire `<div class="col-12">` block that contains the `<input>` with:

```html
<div class="col-12">
  <app-save-path-select formControlName="path" [autofocus]="true"></app-save-path-select>
</div>
```

- [ ] **Step 3: Update the spec**

In `packages/app/src/app/components/modals/set-torrent-location/set-torrent-location.spec.ts`:

Remove this import:

```typescript
import { of } from 'rxjs';
import { TypeaheadService } from '../../../services/typeahead.service';
```

Remove the `TypeaheadService` provider from the `providers` array:

```typescript
{
  provide: TypeaheadService,
  useValue: { searchSavePaths: vi.fn().mockReturnValue(of([])) },
},
```

Add a `TorrentStoreService` mock so `SavePathSelect` can initialise (add to the `providers` array):

```typescript
import { signal } from '@angular/core';
import { TorrentStoreService } from '../../../services/torrent-store.service';
// ...
{ provide: TorrentStoreService, useValue: { torrentsArray: signal([]) } },
```

- [ ] **Step 4: Run tests**

```bash
cd packages/app && npx ng test --watch=false --include="**/set-torrent-location.spec.ts" 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/modals/set-torrent-location/
git commit -m "#66: migrate set-torrent-location to SavePathSelect"
```

---

## Task 4: Migrate server settings path mappings

**Files:**

- Modify: `packages/app/src/app/pages/settings/server/server.ts`
- Modify: `packages/app/src/app/pages/settings/server/server.html`
- Modify: `packages/app/src/app/pages/settings/server/server.spec.ts`

- [ ] **Step 1: Update the component class**

In `packages/app/src/app/pages/settings/server/server.ts`:

Remove from imports at top of file:

```typescript
import { NgbTooltip, NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { TypeaheadService } from '../../../services/typeahead.service';
```

Replace with (keep `NgbTooltip`):

```typescript
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
```

Add:

```typescript
import { SavePathSelect } from '../../../components/save-path-select/save-path-select';
```

In the `@Component` imports array, replace `NgbTypeahead` with `SavePathSelect`.

Remove these lines from the class body:

```typescript
private readonly typeaheadService = inject(TypeaheadService);
// ...
public readonly searchSavePaths = this.typeaheadService.searchSavePaths;
```

- [ ] **Step 2: Update the template**

In `packages/app/src/app/pages/settings/server/server.html`, find the `<div class="col-5">` that contains the remote path `<input [ngbTypeahead]="searchSavePaths">` and replace the entire col-5 div with:

```html
<div class="col-5">
  <app-save-path-select formControlName="remote"></app-save-path-select>
</div>
```

(Remove the inner `<div class="form-floating">` wrapper — `SavePathSelect` provides its own.)

- [ ] **Step 3: Update the spec**

In `packages/app/src/app/pages/settings/server/server.spec.ts`, add a `TorrentStoreService` mock so `SavePathSelect` can initialise. The spec currently uses `NO_ERRORS_SCHEMA` but `SavePathSelect` is a known imported component so its dependencies are still resolved.

Add to the top imports:

```typescript
import { signal } from '@angular/core';
import { TorrentStoreService } from '../../../services/torrent-store.service';
```

Add to the `providers` array in `beforeEach`:

```typescript
{ provide: TorrentStoreService, useValue: { torrentsArray: signal([]) } },
```

- [ ] **Step 4: Run tests**

```bash
cd packages/app && npx ng test --watch=false --include="**/server.spec.ts" 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/pages/settings/server/
git commit -m "#66: migrate server path-mapping remote input to SavePathSelect"
```

---

## Task 5: Delete `TypeaheadService`

**Files:**

- Delete: `packages/app/src/app/services/typeahead.service.ts`
- Delete: `packages/app/src/app/services/typeahead.service.spec.ts`

- [ ] **Step 1: Verify no remaining consumers**

```bash
grep -r "TypeaheadService\|typeahead\.service" packages/app/src --include="*.ts" --include="*.html"
```

Expected: no output (zero matches).

- [ ] **Step 2: Delete the files**

```bash
rm packages/app/src/app/services/typeahead.service.ts
rm packages/app/src/app/services/typeahead.service.spec.ts
```

- [ ] **Step 3: Run the full test suite**

```bash
cd packages/app && npx ng test --watch=false 2>&1 | tail -30
```

Expected: all tests pass, no references to `TypeaheadService`.

- [ ] **Step 4: Commit**

```bash
git add -u packages/app/src/app/services/typeahead.service.ts packages/app/src/app/services/typeahead.service.spec.ts
git commit -m "#66: delete TypeaheadService, no remaining consumers"
```
