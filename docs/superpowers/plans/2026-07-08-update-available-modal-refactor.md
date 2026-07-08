# Update Available Modal Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `packages/app/src/app/modals/update-available/` to follow the app's standard modal conventions (input-driven data, standard body/footer structure) and to keep exactly one release panel open in the "what's new" accordion at all times.

**Architecture:** Three sequential, self-contained changes to the same component: (1) switch `update` from a settable signal to `input.required<UpdateCheckResponse>()` wired through the existing `setModalInput()` helper, matching every other modal; (2) drop the custom `.modal-header` in favor of a hero block at the top of `.modal-body` (mirroring the `About` component) and align the footer with `About`'s `justify-content-between` layout; (3) replace the single-release-only accordion lock with a general "exactly one open" mechanism using ng-bootstrap's per-item `disabled` binding.

**Tech Stack:** Angular 20 (zoneless, signals), `@ng-bootstrap/ng-bootstrap` v19 accordion directives, Vitest.

## Global Constraints

- `npm run lint` must pass with zero warnings (`eslint --max-warnings=0`) - it runs automatically on commit via lint-staged for any touched `.ts`/`.html` file, so remove imports the moment they become unused rather than leaving them dangling between tasks.
- Follow the existing modal convention: data into a modal is passed via `input.required<T>()` on the modal component, set from `ui-command-handler.service.ts` via the `setModalInput()` helper (`packages/app/src/app/utils/modal-input.ts`) - never `componentInstance.someSignal.set(...)`.
- No new translation keys - reuse the existing `components.modals.update-available.*` keys already in `public/i18n/us.json` / `hu.json`.
- Use `-` (hyphen), never `—` (em dash), in any prose this plan touches (commit messages, comments).
- Commit format: `#209: <short description>` (this work is tracked under issue #209).
- ng-bootstrap v19 accordion facts confirmed by reading `node_modules/@ng-bootstrap/ng-bootstrap/fesm2022/ng-bootstrap.mjs` (used by Task 3):
  - `NgbAccordionButton` binds the native `disabled` attribute from `item.disabled`, which blocks that item's own click-driven toggle only.
  - `NgbAccordionDirective._ensureCanExpand()` collapses the previously-open sibling via a direct `.collapse()` method call when a different item expands - a programmatic call, not a button click, so it is **not** blocked by that sibling's `disabled` attribute.
  - `NgbAccordionItem`'s `id` (bound via `[ngbAccordionItem]="..."`) is a `string`. The directive-level `(show)` output on `div[ngbAccordion]` emits that id as its payload (`EventEmitter<string>`). The per-item `(show)` output (on `div[ngbAccordionItem]`) has no payload (`EventEmitter<void>`) - use the directive-level one.

---

### Task 1: Switch `update` to `input.required` and wire it through `setModalInput`

**Files:**

- Modify: `packages/app/src/app/modals/update-available/update-available.ts`
- Modify: `packages/app/src/app/services/ui-command-handler.service.ts:351-362` (the `UI_UPDATE_AVAILABLE` case)
- Test: `packages/app/src/app/modals/update-available/update-available.spec.ts`
- Test: `packages/app/src/app/services/ui-command-handler.service.spec.ts`

**Interfaces:**

- Produces: `UpdateAvailable.update: InputSignal<UpdateCheckResponse>` (was `WritableSignal<UpdateCheckResponse | null>`). Tasks 2 and 3 read `this.update()` the same way as before - no consumer-facing change.

- [ ] **Step 1: Update `update-available.spec.ts` to set `update` via `setInput`, and update `ui-command-handler.service.spec.ts` with a new test - these will fail until Task 1's implementation lands**

Replace the full contents of `packages/app/src/app/modals/update-available/update-available.spec.ts` with:

```ts
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Release, UpdateCheckResponse } from '@bitbutler/shared';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ElectronService } from '../../services/electron.service';
import { ThemeService } from '../../services/theme.service';
import { UpdateAvailable } from './update-available';

const makeRelease = (overrides: Partial<Release> = {}): Release =>
  ({
    tag_name: 'v2.0.0',
    name: '2.0.0',
    body: "## What's Changed\nFix bug A\n\nAdd feature B",
    published_at: '2024-01-15T10:00:00Z',
    assets: [],
    ...overrides,
  }) as Release;

describe('UpdateAvailable', () => {
  let component: UpdateAvailable;
  let fixture: ComponentFixture<UpdateAvailable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpdateAvailable],
      providers: [
        { provide: NgbActiveModal, useValue: { close: vi.fn(), dismiss: vi.fn() } },
        { provide: ThemeService, useValue: { family: signal('bitbutler') } },
        { provide: ElectronService, useValue: { openExternalUrl: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UpdateAvailable);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('update', {
      releases: [],
      updateAvailable: false,
    } as UpdateCheckResponse);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('cleanedBody', () => {
    it('should strip the "What\'s Changed" heading', () => {
      const release = makeRelease({ body: "## What's Changed\nFix A\nAdd B" });
      expect(component.cleanedBody(release)).toBe('Fix A\nAdd B');
    });

    it('should return body unchanged when there is no heading', () => {
      const release = makeRelease({ body: 'Fix A\nAdd B' });
      expect(component.cleanedBody(release)).toBe('Fix A\nAdd B');
    });

    it('should return empty string for empty body', () => {
      const release = makeRelease({ body: '' });
      expect(component.cleanedBody(release)).toBe('');
    });

    it('should trim trailing whitespace', () => {
      const release = makeRelease({ body: 'Fix A  \n  ' });
      expect(component.cleanedBody(release)).toBe('Fix A');
    });
  });

  describe('getVersion', () => {
    it('should strip leading v from version string', () => {
      expect(component.getVersion('v2.0.0')).toBe('2.0.0');
    });

    it('should return version unchanged when there is no leading v', () => {
      expect(component.getVersion('2.0.0')).toBe('2.0.0');
    });
  });

  describe('toMs', () => {
    it('should convert ISO date string to milliseconds', () => {
      const ms = component.toMs('2024-01-15T10:00:00Z');
      expect(ms).toBe(new Date('2024-01-15T10:00:00Z').getTime());
    });

    it('should return 0 for null', () => {
      expect(component.toMs(null)).toBe(0);
    });

    it('should return 0 for undefined', () => {
      expect(component.toMs(undefined)).toBe(0);
    });

    it('should return 0 for invalid date string', () => {
      expect(component.toMs('not-a-date')).toBe(0);
    });
  });

  describe('isSingleRelease', () => {
    it('should be true when exactly one release is present', () => {
      fixture.componentRef.setInput('update', {
        releases: [makeRelease()],
        updateAvailable: true,
      } as UpdateCheckResponse);
      fixture.detectChanges();
      expect(component.isSingleRelease()).toBe(true);
    });

    it('should be false when more than one release is present', () => {
      fixture.componentRef.setInput('update', {
        releases: [makeRelease(), makeRelease()],
        updateAvailable: true,
      } as UpdateCheckResponse);
      fixture.detectChanges();
      expect(component.isSingleRelease()).toBe(false);
    });

    it('should be false when no releases are present', () => {
      fixture.componentRef.setInput('update', {
        releases: [],
        updateAvailable: false,
      } as UpdateCheckResponse);
      fixture.detectChanges();
      expect(component.isSingleRelease()).toBe(false);
    });
  });

  describe('latestRelease', () => {
    it('should return the first release', () => {
      const r = makeRelease({ tag_name: 'v1.0.0' });
      fixture.componentRef.setInput('update', {
        releases: [r],
        updateAvailable: true,
      } as UpdateCheckResponse);
      fixture.detectChanges();
      expect(component.latestRelease?.tag_name).toBe('v1.0.0');
    });

    it('should return undefined when no releases', () => {
      fixture.componentRef.setInput('update', {
        releases: [],
        updateAvailable: false,
      } as UpdateCheckResponse);
      fixture.detectChanges();
      expect(component.latestRelease).toBeUndefined();
    });
  });
});
```

In `packages/app/src/app/services/ui-command-handler.service.spec.ts`, add a new test right after the `'should open a new TorrentExists modal even if one is already open (no isModalOpen guard)'` test (which ends at the `});` currently on line 243, right before the `'should open ServerEditor modal for UI_SERVER_EDITOR_OPEN'` test):

```ts
it('should open UpdateAvailable modal with the update input for UI_UPDATE_AVAILABLE', async () => {
  const update = { releases: [], updateAvailable: true } as any;
  commands$.next({ type: 'UI_UPDATE_AVAILABLE', update });
  await flushPromises();
  expect(mockModalService.open).toHaveBeenCalled();
  expect(setInputSpy).toHaveBeenCalledWith('update', update);
});
```

- [ ] **Step 2: Run both test files to confirm they fail**

Run: `npm run test --workspace=@bitbutler/app -- --include=src/app/modals/update-available/update-available.spec.ts --include=src/app/services/ui-command-handler.service.spec.ts --watch=false`

Expected: `update-available.spec.ts` fails every test - `update` is still a plain public signal field, not a declared Angular input, so `beforeEach`'s `fixture.componentRef.setInput('update', ...)` throws `NG0303: Can't set value of the 'update' input on the 'UpdateAvailable' component. Make sure that the 'update' property is annotated with @Input or a mapped @Input() alias.` before any test body runs. `ui-command-handler.service.spec.ts`'s new test fails because `setInputSpy` was never called with `'update'` (the current code calls `componentInstance.update.set(...)` against a mock `componentInstance: {}` that has no `update` property, which throws inside the service's try/catch and is swallowed, so `mockModalService.open` assertion may pass but the `setInputSpy` assertion fails).

- [ ] **Step 3: Implement - switch `update` to `input.required` in `update-available.ts`**

Replace the full contents of `packages/app/src/app/modals/update-available/update-available.ts` with:

```ts
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Release, UpdateCheckResponse } from '@bitbutler/shared';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbAccordionModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { MarkdownComponent } from 'ngx-markdown';
import { TimeagoPipe } from 'ngx-timeago';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { FilesizePipe } from '../../pipes/filesize-pipe';
import { ElectronService } from '../../services/electron.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-update-available',
  standalone: true,
  imports: [
    CommonModule,
    NgbAccordionModule,
    MarkdownComponent,
    FilesizePipe,
    TimeagoPipe,
    TranslatePipe,
    BbBtnContent,
  ],
  templateUrl: './update-available.html',
  styleUrl: './update-available.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateAvailable {
  private readonly themeService = inject(ThemeService);

  public readonly icons = { faGithub, faXmark };
  public readonly update = input.required<UpdateCheckResponse>();
  public readonly activeModal = inject(NgbActiveModal);
  private readonly electronService = inject(ElectronService);
  public readonly logoUrl = computed(
    () => `assets/images/bitbutler-logo-${this.themeService.family()}.png`,
  );

  public readonly isSingleRelease = computed(() => (this.update().releases?.length ?? 0) === 1);

  get latestRelease(): Release | undefined {
    return this.update().releases?.[0];
  }

  public cleanedBody(release: Release): string {
    const body = release.body || '';
    return body.replace(/^#+\s*What's\s*Changed\s*\r?\n/i, '').trim();
  }

  public getVersion(version: string): string {
    return version.replace(/^v/, '');
  }

  public toMs(dateStr: string | null | undefined): number {
    const ms = dateStr ? new Date(dateStr).getTime() : 0;
    return isNaN(ms) ? 0 : ms;
  }

  public downloadAsset(url: string): void {
    this.electronService.openExternalUrl(url);
  }
}
```

- [ ] **Step 4: Implement - wire `setModalInput` in `ui-command-handler.service.ts`**

In `packages/app/src/app/services/ui-command-handler.service.ts`, find the `UI_UPDATE_AVAILABLE` case:

```ts
          case 'UI_UPDATE_AVAILABLE': {
            const { UpdateAvailable } = await import('../modals/update-available/update-available');
            if (this.isModalOpen(UpdateAvailable)) break;
            const updateAvailableModalRef = this.modalService.open(UpdateAvailable, {
              size: 'lg',
              centered: true,
              scrollable: true,
            });
            updateAvailableModalRef.componentInstance.update.set(command.update);
            updateAvailableModalRef.result.catch(() => {});
            break;
          }
```

Replace the `updateAvailableModalRef.componentInstance.update.set(command.update);` line with:

```ts
setModalInput(updateAvailableModalRef, 'update', command.update);
```

(`setModalInput` is already imported at the top of this file.)

- [ ] **Step 5: Run both test files to confirm they pass**

Run: `npm run test --workspace=@bitbutler/app -- --include=src/app/modals/update-available/update-available.spec.ts --include=src/app/services/ui-command-handler.service.spec.ts --watch=false`

Expected: all tests PASS.

- [ ] **Step 6: Run lint**

Run: `npm run lint`

Expected: no errors, no warnings.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/modals/update-available/update-available.ts \
        packages/app/src/app/modals/update-available/update-available.spec.ts \
        packages/app/src/app/services/ui-command-handler.service.ts \
        packages/app/src/app/services/ui-command-handler.service.spec.ts
git commit -m "$(cat <<'EOF'
#209: switch update-available modal to input.required + setModalInput

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Move the header into a `.modal-body` hero block and align the footer

**Files:**

- Modify: `packages/app/src/app/modals/update-available/update-available.html`
- Modify: `packages/app/src/app/modals/update-available/update-available.scss`

**Interfaces:**

- Consumes: `update-available.ts` from Task 1 (`update`, `latestRelease`, `logoUrl`, `getVersion`, `cleanedBody`, `downloadAsset`, `isSingleRelease`, `icons`, `activeModal`) - unchanged by this task.
- Produces: no new TS-visible surface. Task 3 edits this same HTML file's accordion block on top of this task's output.

This is a template/style-only restructuring; there is no new component logic to drive with a failing test, and this codebase's modal specs test component logic, not rendered DOM structure (see `about.spec.ts`, which has no DOM assertions). Existing tests act as the regression check.

- [ ] **Step 1: Replace the template**

Replace the full contents of `packages/app/src/app/modals/update-available/update-available.html` with:

```html
<div class="modal-body">
  <div class="d-flex align-items-center mb-4">
    <div class="me-3 logo-container">
      <img [src]="logoUrl()" alt="BitButler logo" />
    </div>
    <div>
      <h4 class="modal-title mb-0">{{ 'components.modals.update-available.title' | translate }}</h4>
      @if (latestRelease; as release) {
      <small
        class="text-muted"
        [innerHTML]="
            'components.modals.update-available.new-version-ready'
              | translate: { tag_name: getVersion(release.tag_name) }
          "
      ></small>
      }
    </div>
  </div>

  <h6 class="text-uppercase fw-bold text-muted small mb-3">
    {{ 'components.modals.update-available.whats-new' | translate }}
  </h6>

  <div ngbAccordion class="mb-4" [closeOthers]="true">
    @for (release of update().releases ?? []; track release.id; let i = $index) {
    <div ngbAccordionItem [collapsed]="i !== 0" [disabled]="isSingleRelease()">
      <h2 ngbAccordionHeader>
        <button
          ngbAccordionButton
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#collapseOne"
        >
          <div class="d-flex flex-row justify-content-between align-items-center w-100">
            <strong>v{{ getVersion(release.tag_name) }}</strong>
            <div class="me-3 d-flex flex-column justify-content-between align-items-center">
              <span>{{ release.published_at | date: 'yyyy-MM-dd' }}</span>
              <small class="version">{{ release.published_at | timeago }}</small>
            </div>
          </div>
        </button>
      </h2>
      <div ngbAccordionCollapse>
        <div ngbAccordionBody>
          <div class="markdown-content">
            <markdown [data]="cleanedBody(release)"></markdown>
          </div>
        </div>
      </div>
    </div>
    }
  </div>

  @if (latestRelease?.assets; as assets) {
  <h6 class="text-uppercase fw-bold text-muted small mb-2">
    {{ 'components.modals.update-available.available-downloads' | translate }}
  </h6>
  <div class="list-group list-group-flush border">
    @for (asset of assets; track asset.id) {
    <button
      type="button"
      (click)="downloadAsset(asset.browser_download_url)"
      class="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-2"
    >
      <div class="d-flex align-items-center text-truncate">
        <i class="bi bi-file-earmark-arrow-down me-2"></i>
        <span class="asset-name text-truncate">{{ asset.name }}</span>
      </div>
      <span class="badge rounded-pill small ms-2"> {{ asset.size | fileSize }} </span>
    </button>
    }
  </div>
  }
</div>

<div class="modal-footer justify-content-between">
  @if (latestRelease; as release) {
  <button
    type="button"
    class="btn btn-dashed-secondary btn-sm btn-split"
    (click)="downloadAsset(release.html_url)"
  >
    <bb-btn-content
      [icon]="icons.faGithub"
      [text]="'components.modals.update-available.button.view-on-github' | translate"
      position="end"
    ></bb-btn-content>
  </button>
  }
  <button
    type="button"
    class="btn btn-link btn-sm btn-split"
    (click)="activeModal.close('ignore')"
    autofocus
  >
    <bb-btn-content
      [icon]="icons.faXmark"
      [text]="'general.button.close' | translate"
      position="end"
    ></bb-btn-content>
  </button>
</div>
```

Notes on what changed from before: the root `@if (update(); as u) { ... }` wrapper is gone (Task 1 made `update` a required input, so it's always present); `.modal-header` and its `btn-close` button are gone; the logo/title/subtitle block that used to live in `.modal-header` is now the first block inside `.modal-body`; `u.releases` became `update().releases`; the footer is now `justify-content-between` with no `border-0` override and the Close button now has `autofocus` (matching `About`'s footer).

- [ ] **Step 2: Replace the stylesheet**

Replace the full contents of `packages/app/src/app/modals/update-available/update-available.scss` with:

```scss
:host {
  display: block;
  color: var(--bs-body-color);
}

.logo-container {
  img {
    width: 50px;
    height: 50px;
  }
}

.modal-title {
  font-weight: 700;
  color: var(--bs-primary);
  letter-spacing: -0.5px;
}

.list-group {
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bb-control-radius);
  overflow: hidden;

  .list-group-item {
    background-color: transparent;
    color: var(--bs-body-color);
    border-color: var(--bs-border-color);
    padding: 0.75rem 1rem;
    transition: all 0.2s ease;
    border-left: 0;
    border-right: 0;

    &:first-child {
      border-top: 0;
    }

    &:last-child {
      border-bottom: 0;
    }

    &:hover {
      background-color: var(--bb-hover-list-item-bg);
      color: var(--bs-primary);
    }

    .asset-name {
      font-size: 0.85rem;
    }

    .badge {
      background-color: var(--bs-secondary) !important;
      color: var(--bb-info-ink) !important;
      font-weight: 600;
    }
  }
}

:host ::ng-deep .accordion-collapse {
  will-change: height;
}

:host ::ng-deep .accordion-collapse.collapsing {
  transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

:host ::ng-deep .accordion-body {
  padding: 0;
}

:host ::ng-deep .markdown-content {
  padding: var(--bs-accordion-body-padding-y, 1rem) var(--bs-accordion-body-padding-x, 1.25rem);
  max-height: 250px;
  overflow-y: auto;
  font-size: 0.95rem;
  line-height: 1.6;

  h1,
  h2,
  h3 {
    color: var(--bs-primary);
    font-size: 1.1rem;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
    font-weight: 600;
    border-bottom: 1px solid var(--bs-border-color);
    padding-bottom: 0.25rem;
  }

  ul,
  ol {
    padding-left: 1.2rem;
    margin-bottom: 0.5rem;

    li {
      color: var(--bs-body-color);
      margin-bottom: 0.4rem;

      &::marker {
        color: var(--bs-secondary);
      }
    }
  }

  code {
    background: var(--bs-body-bg);
    color: var(--bs-secondary);
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-family: monospace;
  }

  p {
    margin-bottom: 0.75rem;
  }

  a {
    color: var(--bs-secondary);
    text-decoration: none;
    font-weight: 500;

    &:hover {
      text-decoration: underline;
      color: var(--bs-link-hover-color);
    }
  }

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--bs-border-color);
    border-radius: 10px;
  }
}

.version {
  font-weight: 600;
}
```

Removed from the old file: the `.modal-footer { border-top; padding; }` override (the footer now uses Bootstrap's default border/padding, same as every other modal), the `:host-context([data-bs-theme='dark']) { .btn-close { ... } }` dark-mode invert rule, and the `.btn-close { opacity; &:hover }` rule - all dead now that there's no close-X in this component.

- [ ] **Step 3: Run the existing test suite to confirm no regressions**

Run: `npm run test --workspace=@bitbutler/app -- --include=src/app/modals/update-available/update-available.spec.ts --watch=false`

Expected: all tests PASS (this task didn't touch `update-available.ts`, so behavior is identical - this just confirms the template/style change didn't break component creation).

- [ ] **Step 4: Run lint**

Run: `npm run lint`

Expected: no errors, no warnings.

- [ ] **Step 5: Manual verification in the running app**

Run: `npm start`

In the running app, trigger the update-available modal (e.g. via whatever path currently surfaces `UI_UPDATE_AVAILABLE` - check for a "Check for Updates" menu/button, or temporarily dispatch the command via the command bus in the dev console) and confirm:

- No header bar with a close-X above the body - the logo, "Update Available" title, and version subtitle appear as the first block inside the body.
- The footer shows "View on GitHub" on the left and "Close" on the right, with a visible top border separating it from the body, matching the `About` modal's footer (open it via the app's About menu entry for a side-by-side comparison).
- Escape and backdrop-click both still close the modal.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/modals/update-available/update-available.html \
        packages/app/src/app/modals/update-available/update-available.scss
git commit -m "$(cat <<'EOF'
#209: move update-available header into a modal-body hero block

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Keep exactly one accordion panel open at all times

**Files:**

- Modify: `packages/app/src/app/modals/update-available/update-available.ts`
- Modify: `packages/app/src/app/modals/update-available/update-available.html`
- Test: `packages/app/src/app/modals/update-available/update-available.spec.ts`

**Interfaces:**

- Produces: `UpdateAvailable.itemId(id: number): string` (pure function, prefixes a release id for use as an `ngbAccordionItem` id); `UpdateAvailable.activeReleaseId: WritableSignal<string | null>` (the currently-open panel's id, or `null` before the first release loads).
- Removes: `UpdateAvailable.isSingleRelease` (fully superseded - see Global Constraints for why disabling only the currently-open item is sufficient for any release count, not just one).

- [ ] **Step 1: Write failing tests for `itemId` and the initial `activeReleaseId`**

In `packages/app/src/app/modals/update-available/update-available.spec.ts`, delete the entire `describe('isSingleRelease', ...)` block (the three `it`s shown in Task 1's Step 1 listing), and add these two new `describe` blocks right after `describe('latestRelease', ...)` (i.e. as the last two blocks before the final closing `});` of the outer `describe('UpdateAvailable', ...)`):

```ts
describe('itemId', () => {
  it('should prefix the release id', () => {
    expect(component.itemId(42)).toBe('release-42');
  });
});

describe('activeReleaseId', () => {
  it('should be null before any releases are set', () => {
    expect(component.activeReleaseId()).toBeNull();
  });

  it('should initialize to the first release id once releases are set', () => {
    fixture.componentRef.setInput('update', {
      releases: [makeRelease({ id: 7 }), makeRelease({ id: 8 })],
      updateAvailable: true,
    } as UpdateCheckResponse);
    fixture.detectChanges();
    expect(component.activeReleaseId()).toBe('release-7');
  });

  it('should not override a value that was already set', () => {
    fixture.componentRef.setInput('update', {
      releases: [makeRelease({ id: 7 })],
      updateAvailable: true,
    } as UpdateCheckResponse);
    fixture.detectChanges();
    component.activeReleaseId.set('release-8');

    fixture.componentRef.setInput('update', {
      releases: [makeRelease({ id: 7 }), makeRelease({ id: 9 })],
      updateAvailable: true,
    } as UpdateCheckResponse);
    fixture.detectChanges();

    expect(component.activeReleaseId()).toBe('release-8');
  });
});
```

(The `'should be null before any releases are set'` test relies on `beforeEach` seeding `update` with `releases: []`, from Task 1 - the initialization effect's `first !== undefined` guard means it never sets `activeReleaseId` in that state.)

- [ ] **Step 2: Run the test file to confirm the three new tests fail**

Run: `npm run test --workspace=@bitbutler/app -- --include=src/app/modals/update-available/update-available.spec.ts --watch=false`

Expected: the `itemId` and `activeReleaseId` tests FAIL with errors like `component.itemId is not a function` / `component.activeReleaseId is not a function` (neither exists yet).

- [ ] **Step 3: Implement - add `itemId` and `activeReleaseId` to `update-available.ts`, remove `isSingleRelease`**

In `packages/app/src/app/modals/update-available/update-available.ts`:

Change the import line from:

```ts
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
```

to:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
```

Replace:

```ts
  public readonly isSingleRelease = computed(() => (this.update().releases?.length ?? 0) === 1);

  get latestRelease(): Release | undefined {
    return this.update().releases?.[0];
  }
```

with:

```ts
  public activeReleaseId = signal<string | null>(null);

  constructor() {
    effect(() => {
      const first = this.update().releases?.[0]?.id;
      if (first !== undefined && this.activeReleaseId() === null) {
        this.activeReleaseId.set(this.itemId(first));
      }
    });
  }

  get latestRelease(): Release | undefined {
    return this.update().releases?.[0];
  }

  public itemId(id: number): string {
    return `release-${id}`;
  }
```

- [ ] **Step 4: Implement - update the accordion bindings in `update-available.html`**

Change:

```html
<div ngbAccordion class="mb-4" [closeOthers]="true">
  @for (release of update().releases ?? []; track release.id; let i = $index) {
  <div ngbAccordionItem [collapsed]="i !== 0" [disabled]="isSingleRelease()"></div>
</div>
```

to:

```html
<div ngbAccordion class="mb-4" [closeOthers]="true" (show)="activeReleaseId.set($event)">
  @for (release of update().releases ?? []; track release.id; let i = $index) {
  <div
    [ngbAccordionItem]="itemId(release.id)"
    [collapsed]="i !== 0"
    [disabled]="itemId(release.id) === activeReleaseId()"
  ></div>
</div>
```

- [ ] **Step 5: Run the test file to confirm all tests pass**

Run: `npm run test --workspace=@bitbutler/app -- --include=src/app/modals/update-available/update-available.spec.ts --watch=false`

Expected: all tests PASS.

- [ ] **Step 6: Run lint**

Run: `npm run lint`

Expected: no errors, no warnings.

- [ ] **Step 7: Manual verification in the running app**

Run: `npm start` (skip if still running from Task 2).

Open the update-available modal with mock data that has at least 3 releases (temporarily, e.g. by dispatching `UI_UPDATE_AVAILABLE` with a multi-release payload via the dev console `commandBusService.emit(...)`, or by pointing the update check at a repo/tag with multiple releases). Confirm:

- The first release's panel is open by default; clicking its own header does nothing (it stays open - the button is visibly disabled/non-interactive while open).
- Clicking a different release's header opens that one and closes the previous one.
- At no point can every panel be collapsed - one is always open.
- With only a single release, the same holds (single panel stays open, its header is non-interactive).

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/app/modals/update-available/update-available.ts \
        packages/app/src/app/modals/update-available/update-available.html \
        packages/app/src/app/modals/update-available/update-available.spec.ts
git commit -m "$(cat <<'EOF'
#209: keep exactly one what's-new accordion panel open

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Remove the spec/plan docs before opening the PR

**Files:**

- Delete: `docs/superpowers/specs/2026-07-08-update-available-modal-refactor-design.md`
- Delete: `docs/superpowers/plans/2026-07-08-update-available-modal-refactor.md`

Per this repo's `CLAUDE.md`, spec/plan files under `docs/superpowers/` must not be merged to `main` - they're removed in their own commit once implementation is done, before opening or merging the PR.

- [ ] **Step 1: Remove the docs folder contents for this feature**

```bash
git rm docs/superpowers/specs/2026-07-08-update-available-modal-refactor-design.md \
       docs/superpowers/plans/2026-07-08-update-available-modal-refactor.md
```

If `docs/superpowers/specs/` and/or `docs/superpowers/plans/` are now empty, they'll simply not be tracked further (git doesn't track empty directories) - no extra cleanup needed.

- [ ] **Step 2: Commit**

```bash
git commit -m "$(cat <<'EOF'
#209: removed spec and plan

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Open the PR**

Follow the repo's PR conventions: read `.github/pull_request_template.md` and use it verbatim as the `--body` structure for `gh pr create`. Title is a clean description (no issue ID prefix). Body must include `Fixes #209`. Do not reference the removed spec/plan files or their paths anywhere in the PR description.
