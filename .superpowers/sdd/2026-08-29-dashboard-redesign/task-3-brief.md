### Task 3: Shared `WidgetMenu` component

A small presentational component: an ellipsis button (shown only when `visible()` is true) that opens an `NgbDropdown` with "Configure" and "Delete" actions. Reused by every widget type from Task 4 onward.

**Files:**

- Create: `packages/app/src/app/pages/dashboard/widgets/widget-menu/widget-menu.ts`
- Create: `packages/app/src/app/pages/dashboard/widgets/widget-menu/widget-menu.html`
- Create: `packages/app/src/app/pages/dashboard/widgets/widget-menu/widget-menu.scss`
- Create: `packages/app/src/app/pages/dashboard/widgets/widget-menu/widget-menu.spec.ts`
- Modify: `packages/app/public/i18n/us.json`
- Modify: `packages/app/public/i18n/hu.json`

**Interfaces:**

- Produces: `WidgetMenu` standalone component, selector `app-widget-menu`, `input<boolean>() visible` (default `false`), `output<void>() configure`, `output<void>() remove`.

- [ ] **Step 1: Write the failing test**

Create `packages/app/src/app/pages/dashboard/widgets/widget-menu/widget-menu.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WidgetMenu } from './widget-menu';

describe('WidgetMenu', () => {
  let fixture: ComponentFixture<WidgetMenu>;
  let component: WidgetMenu;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [WidgetMenu] }).compileComponents();
    fixture = TestBed.createComponent(WidgetMenu);
    component = fixture.componentInstance;
  });

  it('should render nothing when not visible', () => {
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.widget-menu')).toBeNull();
  });

  it('should render the toggle when visible', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.widget-menu')).toBeTruthy();
  });

  it('should emit configure when the Configure item is clicked', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    const emitted = vi.fn();
    component.configure.subscribe(emitted);

    fixture.nativeElement.querySelector('[data-test="widget-menu-configure"]').click();

    expect(emitted).toHaveBeenCalled();
  });

  it('should emit remove when the Delete item is clicked', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    const emitted = vi.fn();
    component.remove.subscribe(emitted);

    fixture.nativeElement.querySelector('[data-test="widget-menu-remove"]').click();

    expect(emitted).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=@bitbutler/app -- widget-menu`
Expected: FAIL - cannot find module `./widget-menu`.

- [ ] **Step 3: Add i18n keys**

In `packages/app/public/i18n/us.json`, inside `general.button` (after `"edit": "Edit",`), add:

```json
      "configure": "Configure",
```

In `packages/app/public/i18n/hu.json`, inside `general.button` (after `"edit": "Szerkesztés",`), add:

```json
      "configure": "Konfigurálás",
```

In `packages/app/public/i18n/us.json`, inside `pages.dashboard` (as a new sibling of `"widgets"`, right after the closing `}` of the `widgets` block on line 1264), add:

```json
      "widget-menu": {
        "toggle-label": "Widget options"
      },
```

In `packages/app/public/i18n/hu.json`, at the same spot:

```json
      "widget-menu": {
        "toggle-label": "Widget műveletek"
      },
```

- [ ] **Step 4: Implement the component**

Create `packages/app/src/app/pages/dashboard/widgets/widget-menu/widget-menu.ts`:

```ts
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-widget-menu',
  standalone: true,
  imports: [NgbDropdownModule, FontAwesomeModule, TranslatePipe],
  templateUrl: './widget-menu.html',
  styleUrl: './widget-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetMenu {
  readonly visible = input(false);
  readonly configure = output<void>();
  readonly remove = output<void>();

  readonly icon = { faEllipsisVertical };
}
```

Create `packages/app/src/app/pages/dashboard/widgets/widget-menu/widget-menu.html`:

```html
@if (visible()) {
<div class="widget-menu" ngbDropdown container="body" placement="bottom-end">
  <button
    type="button"
    class="widget-menu__toggle"
    ngbDropdownToggle
    [attr.aria-label]="'pages.dashboard.widget-menu.toggle-label' | translate"
  >
    <fa-icon [icon]="icon.faEllipsisVertical" />
  </button>
  <div ngbDropdownMenu>
    <button
      type="button"
      ngbDropdownItem
      data-test="widget-menu-configure"
      (click)="configure.emit()"
    >
      {{ 'general.button.configure' | translate }}
    </button>
    <button type="button" ngbDropdownItem data-test="widget-menu-remove" (click)="remove.emit()">
      {{ 'general.button.delete' | translate }}
    </button>
  </div>
</div>
}
```

Create `packages/app/src/app/pages/dashboard/widgets/widget-menu/widget-menu.scss`:

```scss
.widget-menu {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 1;

  &__toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    border: none;
    border-radius: var(--bs-border-radius);
    background: transparent;
    color: var(--bs-body-color);
    opacity: 0.6;

    &:hover {
      opacity: 1;
      background-color: var(--bs-border-color);
    }
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test --workspace=@bitbutler/app -- widget-menu`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/pages/dashboard/widgets/widget-menu packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git commit -m "#324: add shared WidgetMenu component"
```

---

