# Filter Group Variant Coloring - Design

## Problem

Filter group items (`packages/app/src/app/pages/main/status/filter-group/`) currently only
apply variant coloring (`info`/`success`/`secondary`/`primary`/`danger`) to the count badge on
the right of each item, via `text-bg-{variant}`. The rest of the item - label text and hover
background - stays neutral for every item, even ones with a semantic variant.

The right-click context menu (`packages/app/src/app/pages/main/grid/context-menu/`) already
colors variant items more fully: the item's text is tinted with the variant color, and hovering
shows a `color-mix` tint of that same color as the background. We want the filter group's
variant items (currently only the Status group: Downloading, Completed, Active, Inactive,
Stopped, Checking, Errored) to follow the same visual language.

## Scope

- Applies only to filter group items that already carry a `variant` (the Status group today).
  Categories, tags, trackers, and save-paths have no `variant` and are unaffected.
- The count badge keeps its current `text-bg-{variant}` styling unchanged.
- The item's resting background stays transparent (no permanent tint) - only the label text
  color and the hover background are affected.
- The active (selected) state is unchanged regardless of variant - it keeps using the existing
  `--bb-active-list-item-bg` background and `--bs-body-color` text color.

## Implementation

**`filter-group.html`**

Add a variant class to the item button (`@for` loop only - the "All" button has no variant):

```html
[ngClass]="item.variant ? 'bb-variant-' + item.variant : null"
```

**`filter-group.scss`**

Nest new rules under the existing `&:not(.active)` block, one per `BbProgressVariant` value
used by the Status group (`primary`, `secondary`, `success`, `info`, `danger`):

```scss
&:not(.active) {
  // ...existing neutral badge rule...

  &.bb-variant-primary {
    color: var(--bs-primary);
    --bs-list-group-action-hover-bg: color-mix(in srgb, var(--bs-primary) 16%, transparent);
  }
  &.bb-variant-secondary {
    color: var(--bs-secondary);
    --bs-list-group-action-hover-bg: color-mix(in srgb, var(--bs-secondary) 16%, transparent);
  }
  &.bb-variant-success {
    color: var(--bs-success);
    --bs-list-group-action-hover-bg: color-mix(in srgb, var(--bs-success) 16%, transparent);
  }
  &.bb-variant-info {
    color: var(--bs-info);
    --bs-list-group-action-hover-bg: color-mix(in srgb, var(--bs-info) 16%, transparent);
  }
  &.bb-variant-danger {
    color: var(--bs-danger);
    --bs-list-group-action-hover-bg: color-mix(in srgb, var(--bs-danger) 16%, transparent);
  }
}
```

This reuses the `--bs-list-group-action-hover-bg` custom property the file already sets at the
`.list-group` level for the default hover color, overriding it per-item instead of adding new
`:hover` selectors. The icon (`<fa-icon class="opacity-75">`) has no explicit color today, so it
inherits the new text color automatically.

The `:not(.active)` scoping means these rules never compete with the `.active` block for
specificity - active items always keep their current look no matter the source order.

## Out of scope

- Extending `variant` to categories/tags (would need a separate design for where the color
  comes from per category/tag).
- Any change to the badge's own styling.
- Any change to border color between items.
