# Filter-group upgrade design

Issue: #202

## Overview

`FilterGroupComponent` (`packages/app/src/app/pages/main/status/filter-group/filter-group.ts`)
is used by `Status` (`packages/app/src/app/pages/main/status/status.ts`) to render the five
sidebar filter groups (status, trackers, categories, tags, save-paths). This upgrade makes the
filter text box opt-in, adds an optional header action button, animates the filtered list, and
adds optional Bootstrap severity coloring to items.

## Component API changes (`filter-group.ts`)

```ts
export interface FilterGroupAction {
  label: string;
  action: () => void;
}

export interface FilterItem {
  key: string;
  label: string;
  count: number;
  icon?: IconDefinition | IconDefinition[];
  variant?: BbProgressVariant; // reused from bb-progress.types.ts
}
```

New inputs on `FilterGroupComponent`:

- `showFilter = input(false)` - controls whether the filter text box renders. Defaults to hidden.
- `action = input<FilterGroupAction | null>(null)` - when set, renders a header button.

No changes to existing inputs/outputs (`label`, `items`, `activeKey`, `showAll`, `showAllCount`,
`itemSelected`).

## Template changes (`filter-group.html`)

1. Header becomes a flex row so the action button can sit flush right:

```html
<div class="d-flex align-items-center justify-content-between">
  <div class="small text-uppercase fw-semibold opacity-75 user-select-none">
    {{ label() }} ({{ (items() ?? []).length }})
  </div>
  @if (action(); as act) {
  <button type="button" class="btn btn-sm btn-link p-0" (click)="act.action()">
    {{ act.label }}
  </button>
  }
</div>
```

2. The filter box block is wrapped in `@if (showFilter()) { ... }`.

3. Each item button rendered by the `@for (item of filteredItems(); ...)` loop gets:
   `animate.enter="bb-filter-item-enter"` and `animate.leave="bb-filter-item-leave"`. The "All"
   button (rendered separately, not part of `filteredItems()`) is not animated since it's never
   added/removed by filtering.

4. The item badge gets a conditional class: `[ngClass]="item.variant ? 'text-bg-' + item.variant : 'bb-status-badge--neutral'"`
   alongside its existing `badge bb-status-badge` classes.

No `@angular/animations` package is added. Angular 20.3's native `animate.enter` /
`animate.leave` template bindings are CSS-class-driven and work with `@for` out of the box; they
are the current recommended replacement for the deprecated `NoopAnimationsModule` and need no
special wiring for zoneless/OnPush.

## Style changes (`filter-group.scss`)

- Add keyframes and the two animation classes:

```scss
@keyframes bb-filter-item-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes bb-filter-item-out {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-4px);
  }
}

.bb-filter-item-enter {
  animation: bb-filter-item-in 0.15s ease-out;
}

.bb-filter-item-leave {
  animation: bb-filter-item-out 0.15s ease-in;
}
```

- Gate the existing active/inactive badge background rules behind the new
  `.bb-status-badge--neutral` marker class, so they only apply when the item has no `variant`.
  This avoids any specificity fight with Bootstrap's `.text-bg-*` utility classes, since a badge
  never carries both a `--neutral` and a `text-bg-*` class at once:

```scss
&.active {
  .bb-status-badge.bb-status-badge--neutral {
    background-color: var(--bb-accent);
    color: var(--bb-primary-ink);
  }
}

&:not(.active) {
  .bb-status-badge.bb-status-badge--neutral {
    background-color: var(--bs-tertiary-bg);
    color: var(--bs-emphasis-color);
  }
}
```

## Consumer wiring (`status.ts` / `status.html`)

- `status.html`: add `[showFilter]="true"` to the trackers, categories, tags, and save-paths
  `app-filter-group` elements. The status group is left as-is (no `showFilter` input passed, so
  it defaults to hidden - removing the box that's shown there today).
- `status.ts`: inject `CommandBusService` (already used the same way in `button-bar.ts`) and add:
  - `categoriesAction = computed<FilterGroupAction>(...)` emitting `UI_MANAGE_CATEGORIES`.
  - `tagsAction = computed<FilterGroupAction>(...)` emitting `UI_MANAGE_TAGS`.
  - Both recompute on `languageChanged()` (existing signal) so the label re-translates on
    language switch, matching the pattern already used by `statusItems()`.
  - Bind `[action]="categoriesAction()"` / `[action]="tagsAction()"` on the categories/tags
    `app-filter-group` elements.
- `statusItems()` computed: add a `variant` to each of the 7 entries, mirroring the semantics
  already used by `variantForTorrentState` for `bb-progress`:
  - `downloading` -> `info`
  - `completed` -> `success`
  - `active` -> `success`
  - `inactive` -> `secondary`
  - `stopped` -> `secondary`
  - `checking` -> `primary`
  - `errored` -> `danger`
- Trackers, categories, tags, and save-paths items are left without a `variant` (no inherent
  severity), so their badges keep today's neutral styling.

## i18n changes

Add to `pages.main.status` in `public/i18n/us.json` and `public/i18n/hu.json`:

```json
"manage-categories": "Manage Categories",
"manage-tags": "Manage Tags"
```

(Hungarian equivalents: `"Kategóriák kezelése"`, `"Címkék kezelése"`.)

## Testing plan

- `filter-group.spec.ts`: default `showFilter` hides the box; setting it renders the input;
  `action` input renders/hides the button and its click invokes the provided callback; items
  with a `variant` get the `text-bg-{variant}` class and not `bb-status-badge--neutral`, and
  vice versa for items without one.
- `status.spec.ts`: `categoriesAction()`/`tagsAction()` emit the correct `CommandBusService`
  commands when invoked; `statusItems()` entries carry the expected `variant` per key.

## Non-goals

- No coloring for trackers/categories/tags/save-paths items (no inherent severity to map).
- No configurable animation duration/easing - fixed short (150ms) transition matching other
  micro-interactions in the app.
