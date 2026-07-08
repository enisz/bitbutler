# Update Available Modal Refactor - Design

Issue: #209

## Context

`packages/app/src/app/modals/update-available/` is the only modal in the app that
doesn't follow the standard modal structure other modals use (`add-torrent`,
`rename-torrent`, `confirm`, etc.):

- It receives its data via a public writable `signal<UpdateCheckResponse | null>(null)`,
  set from the caller with `componentInstance.update.set(...)` after
  `modalService.open()`. Every other modal instead uses `input.required<T>()` +
  the `setModalInput()` helper (see `rename-torrent.ts`, `torrent-details.ts`).
- Its whole template is wrapped in a root `@if (update(); as u) { ... }`, which no
  other modal does, since `input.required` guarantees the value is present.
- Its header uses `.modal-header` with `border-0 pb-0` overrides and an embedded
  logo/title/subtitle block, instead of the standard `.modal-header` /
  `bb-modal-header` / `bb-modal-header__text` convention.
- Its footer uses a plain flex row (`View on GitHub` then `Close`, bunched to the
  right by Bootstrap's default `.modal-footer` justification) with a redundant
  `border-0` override on the footer that the component's `.scss` then manually
  re-adds a border for.
- Its "what's new" accordion only prevents collapsing the single item when there is
  exactly one release (`[disabled]="isSingleRelease()"`). With multiple releases,
  every item can be collapsed simultaneously, leaving nothing open.

`update` is always provided when this modal is opened - `command.model.ts` types
`UI_UPDATE_AVAILABLE` as `{ type: 'UI_UPDATE_AVAILABLE'; update: UpdateCheckResponse }`
with no optionality - so there is no real nullable case to guard against.

The app already has one other "branded" modal: `About`
(`packages/app/src/app/components/about/about.html`). It has no `.modal-header` at
all - the BitButler logo, title, and version badges are a hero block at the top of
`.modal-body` (`bb-about__header`), and the modal is closed only via the footer's
Close button (no close-X). Its footer uses
`.modal-footer.justify-content-between`, with external links on the left and Close
on the right.

## Design

### 1. Data flow: match the `input()` + `setModalInput()` convention

- `update-available.ts`: replace `public update = signal<UpdateCheckResponse | null>(null)`
  with `public readonly update = input.required<UpdateCheckResponse>();`.
- `ui-command-handler.service.ts` (`UI_UPDATE_AVAILABLE` case): replace
  `updateAvailableModalRef.componentInstance.update.set(command.update)` with
  `setModalInput(updateAvailableModalRef, 'update', command.update);` (already
  imported for other modals in this file).
- `update-available.html`: drop the root `@if (update(); as u) { ... }` wrapper;
  reference `update()` directly wherever `u` was used.

### 2. Header: drop it, move the logo into a `.modal-body` hero block

Mirrors `About` exactly rather than inventing a new pattern:

- Remove `.modal-header` and its `btn-close` button entirely.
- At the top of `.modal-body`, add a hero block reusing `About`'s visual language
  (logo in a bordered/rounded wrapper, title, subtitle) - not the floating/pulsing
  animation, which is specific to the About easter-egg feel and not appropriate
  here. Content: BitButler logo, "Update Available" title, and the existing
  "vX.Y.Z ready" subtitle (translated via
  `components.modals.update-available.new-version-ready`).
- Closing the modal is via the footer's Close button, Escape, and backdrop click
  only - consistent with `About` having no close-X.

### 3. Footer: match `About`'s layout

- `<div class="modal-footer justify-content-between">`
- Left: "View on GitHub" button (`btn btn-dashed-secondary btn-sm btn-split`),
  rendered only when `latestRelease` is present - unchanged behavior, just
  regrouped.
- Right: "Close" button (`btn btn-link btn-sm btn-split`, `autofocus`) - closes via
  `activeModal.close('ignore')`, unchanged.
- Remove the `border-0` overrides on both header (now deleted) and footer, and
  remove the manual `border-top`/`padding` re-add in `update-available.scss` - the
  footer keeps Bootstrap's default border, same as every other modal.

### 4. Accordion: always keep exactly one release panel open

Currently: `[collapsed]="i !== 0"` sets the initial open panel, and
`[disabled]="isSingleRelease()"` only blocks collapsing when there's a single
release. With multiple releases, clicking the open panel's header collapses it with
nothing to replace it, since `closeOthers` only closes _other_ panels, not the one
being clicked.

Confirmed in the installed `@ng-bootstrap/ng-bootstrap` v19 source
(`fesm2022/ng-bootstrap.mjs`): `NgbAccordionButton` binds the native `disabled`
attribute from `item.disabled`, which blocks the button's own click-driven toggle.
Separately, `NgbAccordionDirective._ensureCanExpand()` collapses the
previously-open sibling via a direct `.collapse()` method call when a different
item expands - this is a programmatic call, not a button click, so it is **not**
blocked by that sibling's `disabled` attribute. This means: disabling only the
currently-open item's button, while leaving every closed item's button enabled, is
sufficient to guarantee exactly one item is open at all times, for any number of
releases (including one).

Implementation:

- Add `activeReleaseId = signal<number | null>(null)`, initialized once from the
  first release's `id` via a constructor `effect()`:
  `effect(() => { const first = this.update().releases?.[0]?.id; if (first !== undefined && this.activeReleaseId() === null) this.activeReleaseId.set(first); });`
  Guarding on `=== null` keeps this a one-time initialization; subsequent changes
  come only from the `(show)` binding below.
- On `div[ngbAccordion]`, bind `(show)="activeReleaseId.set($event)"` - the
  directive's `show` output payload is the id of the item being expanded.
- Per `div[ngbAccordionItem]`, change `[disabled]="isSingleRelease()"` to
  `[disabled]="release.id === activeReleaseId()"`.
- Remove `isSingleRelease` (computed) entirely - it's fully superseded by the above
  and was only ever used for this one binding.

### 5. Tests

- `update-available.spec.ts`: replace all `component.update.set(...)` calls with
  `fixture.componentRef.setInput('update', ...)`; delete the `isSingleRelease`
  `describe` block (behavior removed, superseded by the accordion mechanism
  above, which is ng-bootstrap's own tested behavior - no new unit test needed for
  it).
- No changes expected to `ui-command-handler.service.spec.ts` (no existing
  coverage for the `UI_UPDATE_AVAILABLE` case).

## Out of scope

- No changes to translation keys - all existing `components.modals.update-available.*`
  keys are reused as-is.
- No changes to how `update-available.ts` fetches/computes release data
  (`cleanedBody`, `getVersion`, `toMs`, `downloadAsset`, `latestRelease`).
- No changes to the `About` modal itself - it's the reference pattern, not a target
  of this refactor.
