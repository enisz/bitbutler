# Split buttons design (#180)

## Summary

Introduce a "split button" visual style across the app: a Bootstrap `.btn` divided into two
zones - a tinted icon segment and a text segment - replacing every plain-text Bootstrap button
with an icon-bearing one. This is a visual primitive plus a full app-wide retrofit, not a
dropdown-style split button.

Source prototype: GitHub issue #180 (HTML/CSS mockup using flat `rgba(0,0,0,.15)` icon-segment
tinting). This design replaces that flat tint with a theme-aware one and defines the rollout
across the whole app.

## Scope

**In scope:** every literal Bootstrap `.btn`-classed `<button>`, `<a>`, or toggle-group
`<label>` in `packages/app/src/app/**`, including assigning a new icon to buttons that don't
have one today (Cancel, Close, OK, Save, etc.).

**Out of scope:**

- `packages/app/src/app/pages/main/button-bar/button-bar.html` and
  `.../grid/context-menu/context-menu.html` - bespoke `.bb-tool`/`.bb-item` components, not
  Bootstrap `.btn`. They already solve icon+label with their own responsive collapse-to-icon
  behavior; restyling them is a separate toolbar redesign, not part of this issue.
- `.btn-close` (Bootstrap's circular X dismiss button) - already icon-only.
- Icon-only `.btn-link`/`.btn-sm` buttons that show only an `<fa-icon>` with a tooltip and no
  visible text (file-tree inline actions, torrent-details inline copy/edit buttons, manage-\*
  inline edit/delete/save/cancel, import-torrents/server path-mapping buttons, login.html's
  quick-setting dropdown togglers). Nothing to split - there's no text segment.
- Bootstrap `nav-link`, `ngbAccordionButton`, `list-group-item-action` - no `btn` class.
- Two ambiguous text links that don't read as icon-bearing actions: the inline qb-settings link
  in `import-torrents.html`, and the `v{{version}}` link in `login.html`. Both stay plain
  `.btn-link` text.

## Architecture

### CSS primitive

`packages/app/src/styles/themes/_theme-utils.scss` already generates per-variant `--bs-btn-*`
custom properties via `bb-solid-button`, `bb-outline-button`, `bb-dashed-button` mixins, reused
across all 8 themes (bitbutler, aurora, mint-green, purple-haze, ocean-breeze, pumpkin-spice,
deep-sea, crimson-ember) x dark/light mode, since each theme only redefines `--bs-{variant}`.
The split-button styling builds on top of those same tokens - no per-theme file changes needed.

Each mixin gains one additional custom property for the icon-segment background:

```scss
@mixin bb-solid-button($variant) {
  // ...existing --bs-btn-* declarations...
  --bs-btn-split-icon-bg: color-mix(in srgb, #{$c} 85%, var(--bb-black) 15%);
}

@mixin bb-outline-button($variant) {
  // ...existing --bs-btn-* declarations...
  --bs-btn-split-icon-bg: color-mix(in srgb, #{$c} 12%, transparent);
}

@mixin bb-dashed-button($variant) {
  // ...existing --bs-btn-* declarations...
  --bs-btn-split-icon-bg: color-mix(in srgb, #{$c} 12%, transparent);
}
```

Solid buttons darken their own background by 15% toward black; outline/dashed buttons (which
have a transparent background) tint with the variant's own color at low opacity instead. Both
derive from tokens the theme already defines, so the icon segment automatically adapts across
all 8 themes and both light/dark mode with zero per-theme edits. This replaces the prototype's
flat `rgba(0,0,0,.15)`, which doesn't adapt to theme or light/dark mode.

`.btn-link.btn-split` is the one variant without a `--bs-btn-bg`/color token to derive from in
the same way; it gets a fixed low-opacity tint of `currentColor`:
`--bs-btn-split-icon-bg: color-mix(in srgb, currentColor 10%, transparent);`

Global structural CSS (in `styles.scss`, alongside the existing base `.btn` rule):

```scss
.btn-split {
  display: inline-flex;
  align-items: stretch;
  padding: 0 !important;
  overflow: hidden;

  .btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--bs-btn-padding-y) calc(var(--bs-btn-padding-x) * 0.75);
    background-color: var(--bs-btn-split-icon-bg);
  }

  .btn-text {
    display: inline-flex;
    align-items: center;
    padding: var(--bs-btn-padding-y) var(--bs-btn-padding-x);
  }
}
```

Sizing (`.btn-sm`/`.btn-lg`) requires no extra rules - padding derives from Bootstrap's own
`--bs-btn-padding-y`/`-x`, which already vary by size.

### Shared inner-content component

A new standalone component, `bb-btn-content` (bare `bb-` prefix, matching other small reusable
primitives like `bb-popover`), at `packages/app/src/app/components/bb-btn-content/`:

```ts
@Component({
  selector: 'bb-btn-content',
  standalone: true,
  imports: [FontAwesomeModule],
  template: `
    @if (position() !== 'end') {
      <span class="btn-icon" aria-hidden="true"><fa-icon [icon]="icon()"></fa-icon></span>
    }
    <span class="btn-text">{{ text() }}</span>
    @if (position() === 'end') {
      <span class="btn-icon" aria-hidden="true"><fa-icon [icon]="icon()"></fa-icon></span>
    }
  `,
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BbBtnContent {
  icon = input.required<IconProp>();
  text = input.required<string>();
  position = input<'start' | 'end'>('start');
}
```

`host: { style: 'display: contents' }` makes the component's own element invisible to layout,
so `.btn-icon`/`.btn-text` behave as direct children of the host `.btn-split` button/label/anchor

- exactly what the flex CSS above expects - without the call site needing to know about it.

Call sites keep the host element's existing tag (`<button>`, `<a>`, or toggle-group `<label>`)
and Bootstrap classes unchanged, adding only `btn-split`, and replace their button body with
`bb-btn-content`:

```html
<button type="button" class="btn btn-danger btn-split" (click)="activeModal.close(true)">
  <bb-btn-content [icon]="icons.faTrashCan" [text]="btnOkText() | translate"></bb-btn-content>
</button>
```

```html
<label class="btn btn-outline-secondary btn-split" for="scope-all">
  <bb-btn-content
    [icon]="icons.faLayerGroup"
    [text]="(scopeAllLabel() | translate) + ' (' + allCount() + ')'"
  ></bb-btn-content>
</label>
```

Each call site still imports its own `fa*` icon constant from `@fortawesome/free-solid-svg-icons`
(or `-regular-`/`-brands-`) and exposes it via a component-local `icons` object, consistent with
the existing app convention (no central icon registry) - see `button-bar.ts` for the established
pattern. Call sites no longer need to import `FontAwesomeModule` themselves; that import moves
into `bb-btn-content`.

A wrapping `<app-split-button>` component that owns the whole button element was considered and
rejected: Bootstrap's toggle-group styling (`.btn-check:checked + label.btn`) requires the
`<label>` to be a literal sibling of the `<input class="btn-check">`, which a wrapper component
would break.

## Icon & translation conventions

### Generic `general.button.*` keys

One icon per key, applied everywhere that key is reused (`public/i18n/us.json`, `general.button`
section):

| key                               | label                      | icon            | reuses existing app icon                      |
| --------------------------------- | -------------------------- | --------------- | --------------------------------------------- |
| close, cancel                     | Close, Cancel              | `faXmark`       | yes (button-bar search-clear)                 |
| add                               | Add                        | `faPlus`        | yes (button-bar "Add Torrent")                |
| delete                            | Delete                     | `faTrashCan`    | yes (button-bar "Delete")                     |
| save, update                      | Save, Update               | `faFloppyDisk`  | no                                            |
| connect                           | Connect                    | `faPlug`        | yes (manage-servers)                          |
| add-server, manage-servers        | Add Server, Manage Servers | `faServer`      | yes (button-bar)                              |
| ok, set                           | OK, Set                    | `faCheck`       | yes (inline confirm-edit)                     |
| show                              | Show                       | `faEye`         | no                                            |
| open-details                      | Open Details               | `faCircleInfo`  | no                                            |
| edit                              | Edit                       | `faPenToSquare` | yes                                           |
| browse                            | Browse                     | `faFolderOpen`  | yes                                           |
| today                             | Today                      | `faCalendarDay` | no                                            |
| clear, clear-all                  | Clear                      | `faEraser`      | no (distinct from delete's trash icon and the |
| icon-only search-clear `faXmark`) |

### Component-specific keys

Keep their own icon, chosen per concept: `export-torrents` Export -> `faFileExport`, Show in
folder -> `faFolderOpen`; `import-torrents` Import -> `faFileImport`; `torrent-exists` Delete
Torrent File -> `faTrashCan`; `update-available` View on GitHub -> `faGithub`; `settings/general`
Check for update -> `faArrowsRotate`. `about.html`'s two buttons already have icons (`faGithub`,
`faUser`) - they only need markup restructured to the split form, no new icon decision.

### `Confirm` component

`confirm.html` takes caller-supplied `btnOkText()`/`btnCancelText()` with no icon concept today.
Add `okIcon`/`cancelIcon` inputs defaulting to `faCheck`/`faXmark`. Every existing caller of
`Confirm` across the app gets audited in whichever phase touches it (see Phase 3 below); most
keep the default, but a caller confirming a destructive action (e.g. a delete confirmation) may
pass `faTrashCan` for `okIcon` instead.

### Toggle groups

One icon per option, reusing existing app icons where the concept already has one:

| file                     | group             | options                   | icons                                               |
| ------------------------ | ----------------- | ------------------------- | --------------------------------------------------- |
| add-torrent/general.html | Input mode        | File / Link               | `faFile` / `faLink`                                 |
| export-torrents.html     | Torrents scope    | All / Filtered / Selected | `faLayerGroup` / `faFilter` / `faSquareCheck`       |
| export-torrents.html     | Categories scope  | All / Assigned            | `faFolderTree` (reuse) / `faLink`                   |
| export-torrents.html     | Tags scope        | All / Assigned            | `faTags` (reuse) / `faLink`                         |
| import-torrents.html     | After-import mode | Paused / Active / All     | `faPause` (reuse) / `faPlay` (reuse) / `faAsterisk` |

## Phased rollout

Per-phase implementation plans are written separately (via the writing-plans skill, one plan per
phase) so each stays small enough to implement and review in one sitting.

| Phase | Scope                                                                                       | Files                                                                                                               | Buttons               |
| ----- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 0     | Primitive only: `.btn-split` CSS + `bb-btn-content` component. No visible changes.          | `_theme-utils.scss`, `styles.scss`, new `bb-btn-content` component                                                  | 0                     |
| 1     | Showcase: validates `btn-lg`, `btn-dashed-secondary`, a brand icon; zero new icon decisions | about, update-available, login                                                                                      | 7                     |
| 2     | Mechanical Save/Cancel modals: same pattern repeated                                        | rename-torrent, set-torrent-category, set-torrent-location, set-torrent-tags, server-editor, credential-prompt      | 12                    |
| 3     | Confirm/danger modals: touches `Confirm`'s API (new icon inputs) - audit all its callers    | confirm, delete-torrent, torrent-exists                                                                             | ~6                    |
| 4     | List-management & settings modals                                                           | manage-categories, manage-tags, manage-servers, torrent-details, qb-settings, settings                              | ~10                   |
| 5     | Data-transfer modals + most toggle groups                                                   | export-torrents, import-torrents, share-limit, transfer-limit                                                       | ~12 + 4 toggle groups |
| 6     | Remaining toggle group + filters + misc                                                     | add-torrent/general (toggle), datepicker-filter, datepicker-range-filter, settings/general, settings/server, status | ~8 + 1 toggle group   |

Each phase after 0 is independently shippable. Phase ordering is dependency-driven: Phase 0 must
land first since every later phase consumes its CSS/component; phases 1-6 have no dependencies
on each other and could in principle be reordered, but the above order goes
simplest-and-lowest-risk-first (no new icon/API decisions) toward most complex (shared-component
API change in Phase 3, bulk toggle-group work in Phases 5-6).

## Testing

- Each phase's component spec files get updated alongside their templates wherever a spec
  asserts on button markup/text (e.g. `general.spec.ts` references already shown in the
  inventory).
- No new test infrastructure needed - existing Angular TestBed specs cover button presence/click
  behavior; the visual split styling itself is not unit-testable and isn't covered by tests.
- Manual verification per phase: run the app, switch through all 8 themes x light/dark to confirm
  icon-segment contrast/legibility, since that's the part `color-mix` can't be verified by a
  type-checker.

## Out-of-scope follow-ups (not part of issue #180)

- Restyling `button-bar.html`/`context-menu.html` to match (separate toolbar redesign).
- Standardizing `faX` vs `faXmark` inconsistency already present in `bb-file-tree.html` and
  `torrent-details/general/general.html` for icon-only buttons (noted by the inventory pass,
  fix opportunistically if those files are touched for unrelated reasons).
