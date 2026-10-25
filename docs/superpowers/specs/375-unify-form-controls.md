# #375 - Unify form controls across the app

## Goal

Replace every hand-written Bootstrap checkbox, switch, radio and `btn-group` with a small shared
set of Angular form-control components built from the new form-controls design, convert the
short `ng-select` dropdowns listed in the issue to option cards / inline radios, and move all
control colors to tokens defined once, so the per-theme `.form-check-input` / `.form-switch`
overrides can be deleted from the 16 theme files.

## Principles

- **Native inputs underneath.** Every component renders a real `<input type="checkbox|radio">`
  styled with `appearance: none` (segmented control: visually hidden input + label). This gives
  Space-to-toggle, arrow keys inside radio groups (native `name` grouping), form semantics,
  `<label for>` association and screen-reader roles for free. No hand-rolled key handling.
- **`ControlValueAccessor` on all value components**, so `formControlName`, `[formControl]` and
  `[(ngModel)]` work, including `disable()` from reactive forms.
- **Signals + OnPush**, `input()` / `model()` APIs, matching existing components.
- **Theme tokens once.** New `--bb-check-*` tokens are declared on `:root` in a single partial,
  derived from the tokens every theme already defines (`--bb-accent`, `--bb-control-*`,
  `--bs-danger`, `--bb-secondary-ink`, `--bs-body-bg`). No theme file needs a new line.
- **Selectors** follow `app-bb-*` (as `app-bb-section-card`, `app-bb-spinner`).

## Theme tokens (`styles/_form-controls.scss`, used from `styles.scss`)

| Token                         | Default                                                     | Used for                   |
| ----------------------------- | ----------------------------------------------------------- | -------------------------- |
| `--bb-check-bg`               | `var(--bs-body-bg)`                                         | box/circle fill, off       |
| `--bb-check-border`           | `var(--bb-control-border)`                                  | border, off                |
| `--bb-check-hover-border`     | `var(--bb-accent)`                                          | border on hover            |
| `--bb-check-on-bg`            | `var(--bb-accent)`                                          | fill when on / mixed       |
| `--bb-check-on-ink`           | `var(--bb-secondary-ink)`                                   | tick, dash, radio dot      |
| `--bb-check-error`            | `var(--bs-danger)`                                          | error border / danger tone |
| `--bb-check-focus-ring`       | `var(--bb-control-focus-ring)`                              | focus ring                 |
| `--bb-check-disabled-opacity` | `0.45`                                                      | disabled and disabled-on   |
| `--bb-switch-track-off`       | `color-mix(in srgb, var(--bb-control-bg) 85%, #000)`        | switch track, off          |
| `--bb-switch-knob-off`        | `color-mix(in srgb, var(--bs-body-color) 45%, transparent)` | switch knob, off           |

Tick / dash / dot are drawn with CSS (mask or pseudo-elements using `currentColor`), not
per-theme SVG data URIs, which is what forced the 16 copies today.

**Removed afterwards:** the `.form-switch …` and `.form-check-input[type=…]` blocks and the
`$…-check-marker-colors` maps in all 16 `styles/themes/*/_{light,dark}.scss`, the
`.form-check-input` / `.form-switch` entries in the `styles.scss` transition list, the
`.bb-option__toggle .form-check-input` sizing, and the `.btn-group` / `.segmented-picker`
styles in `export-torrents.scss`, `import-torrents.scss`, `add-torrent/general.scss` and the
limit pickers. Acceptance check: `grep -rE 'form-check|form-switch|btn-check|btn-group'
packages/app/src` returns nothing.

## Components (`packages/app/src/app/components/form-controls/`)

### `app-bb-checkbox` - `BbCheckbox`

- CVA value: `boolean`.
- Inputs: `label?`, `sub?`, `mixed` (indeterminate, shows the dash; a click resolves it to on),
  `invalid` (error state; also shown automatically when the bound `NgControl` is
  `invalid && touched`), `tone: 'default' | 'danger'` (red tick/border when on - replaces
  `bb-check-danger` in the delete-torrent modal), `inputId?` (generated otherwise).
- Layout: box on the left; label (and sub-text below it) on the right, as in the design's
  "Start torrents automatically" row. Without a label it is a bare box (file tree).
- States: off, on, mixed, error, hover, focus-visible ring, disabled, disabled-on.
- Content projection `[bbLabelExtra]` after the label (help popovers).

### `app-bb-switch` - `BbSwitch`

- CVA value: `boolean`. Inputs: `label?`, `sub?`, `inputId?`. `role="switch"` on the input.
- Layout: the option row - label + sub-text on the left (single-line truncation via the
  existing `bbOptionText` behavior), switch on the right. Host carries `.bb-option` so it slots
  into `.bb-options` / `.bb-options--grid` and the existing `nth-child` page rules keep working.
- `[bbLabelExtra]` slot for popovers (wrapped in `.bb-option__label-text` handling as today).

### `app-bb-radio-group` + `app-bb-radio` - `BbRadioGroup`, `BbRadio`

- The group is the CVA (value: any primitive). Children declare `value`, `label`, `sub?`,
  `disabled?`, and may project extra content (e.g. counts).
- The group owns a generated `name`, so native arrow-key navigation and roving tab stop work.
- `appearance`:
  - `'list'` (default) - one radio per row, label + optional sub-text.
  - `'inline'` - compact row, no sub-text (Low / Normal / High).
  - `'cards'` - **option cards**: boxed radio with title and one-line sub-text, side by side,
    equal width; `columns` input (default = number of options; `2` gives the 2x2 notification
    position grid). Selected card gets the accent border; disabled card is dimmed.
    Wraps to one column under the existing `$bb-options-grid-breakpoint`.
- `aria-label` / `aria-labelledby` passthrough on the group (`role="radiogroup"`).

### `app-bb-inline-group` - `BbInlineGroup`

- Pure layout: a wrapping row of `app-bb-checkbox` (no sub-text) with the design's spacing,
  `role="group"` + `aria-label`. Inline radios use `app-bb-radio-group appearance="inline"`,
  which shares the same spacing class.

### `app-bb-segmented` - `BbSegmented`

- CVA value: any primitive. Options via `[options]: { value, label, disabled? }[]`.
- Joined buttons, same border / radius / accent / focus ring as the option cards.
- Native radios (visually hidden) underneath, so arrows move the selection.
- Size input `'md' | 'sm'` (the limit pickers sit next to a floating input, so `sm` matches
  their height).
- For switching which input/view is shown; option cards are used when the choice is a value
  whose effect needs explaining.

### `app-bb-check-tree` - `BbCheckTree`

- The "select files" pattern for flat lists: a parent "select all" checkbox showing the mixed
  state, and indented child checkboxes.
- CVA value: `readonly K[]` (selected keys). Inputs: `items: { key, label, sub? }[]`,
  `allLabel`. Optional `ng-template` (`bbCheckTreeItem`) for extra content per item (counts
  badge in the set filter).
- "Select all" acts on the items currently passed in (so a filtered list selects only what is
  shown).
- Consumers: the column set filter (values list), import configuration (server list).
- The file tree (`app-bb-file-tree`) is virtual-scrolled and nested, so it keeps its own rows
  but uses `app-bb-checkbox` with `[mixed]` for folders and files.

## Settings row variant

`.bb-option--stacked`: label and description on top, the control (option cards) across the
full width below. Added next to the other `.bb-option` rules in `styles.scss`.

## Migration

### Checkboxes / switches / radios → components

Every template from the inventory (22 files): settings (general, notifications, startup,
torrent-list-grid), qB settings (storage, seeding-ratios, queue-limits, bandwidth), modals (add
torrent general/options/folder picker, import/export torrents, import configuration, delete
torrent, server editor, credential prompt, torrent details general), the file tree, the column
filters (set filter), and the share/transfer limit components.

### `ng-select` → option cards (stacked rows)

| Setting                                   | Sub-text per option                          |
| ----------------------------------------- | -------------------------------------------- |
| Row double-click behavior (grid)          | what the action does                         |
| Date format preset (general)              | live sample (`example` already computed)     |
| Notification position                     | `columns=2`, ordered like the screen corners |
| Content layout (qB storage)               | resulting folder structure                   |
| Default torrent management mode (storage) | what Manual / Automatic means                |
| Ratio limit action (seeding ratios)       | what happens to the torrent                  |

### `ng-select` → inline radios

Theme mode (appearance), first day of week (general), the three torrent-management change
behaviors (storage).

### Kept as `ng-select`

Language, theme family, scheduler days/hours/minutes, the column pool - plus the ones the issue
does not list (login server picker, server-editor protocol, add-torrent root folder, file-tree
priority, column filter operators, boolean filter).

### `btn-group` → components

- Export torrents: Torrents (All / Filtered / Selected), Categories, Tags → option cards; count
  in the card title, the scope hint text moves to each card's sub-text, an option with nothing
  to export is disabled.
- Import torrents "After import" (Keep paused / Start active ones / Start all) → option cards
  with the hint on each card.
- Add torrent File / Link / Folder → segmented control.
- Transfer limit (No limit / Custom) and share limit (Global / No limit / Custom) →
  segmented control (`sm`).

### Save path field (general settings)

The two radio rows (select / typeahead), each with a preview control, become option cards
(title + one-line sub-text, as in the design), followed by the preview control for the
selected type.

## i18n

New keys (US + HU) for option-card sub-texts: row double-click actions, content layouts, TMM
modes, ratio actions, save path types, import start modes; existing scope hint keys are reused
for export cards. Removed keys that only fed the deleted description lines are deleted from both
files.

## Testing

- A spec per component: CVA write/read, disabled from the form, mixed → on on click, error from
  `NgControl`, keyboard (Space toggles; arrow keys move within radio group / segmented via
  native radios), card `disabled`, check-tree select-all / mixed / filtered subset.
- Existing specs that query `.form-check-input`, `.btn-check` or `ng-select` for the converted
  fields are updated (`app.spec.ts`, `add-torrent/options`, `save-path-select`, others found
  when running the suite).
- `npm run lint`, `npm test`, `npm run build` clean; visual pass in the running app across a
  light and a dark theme.

## Out of scope

Text inputs, `ng-select` styling, ag-grid's own checkboxes.
