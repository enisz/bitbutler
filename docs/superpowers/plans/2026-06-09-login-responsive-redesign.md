# Login Responsive Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed-size centered login page with a responsive two-column layout, start the app maximized, and replace the inline server CRUD buttons with a "Manage Servers" modal button.

**Architecture:** ManageServers gets a `hideConnect` input to suppress its connect buttons when opened from login. The Electron main process maximizes the window on startup. The login page is rewritten in three layers - TypeScript (remove CRUD, add modal opener), HTML (two-column hero + form), SCSS (layout styles using existing theme tokens).

**Tech Stack:** Angular 20 (zoneless, signals), Bootstrap 5, `@ng-bootstrap/ng-bootstrap` for modals, `@ng-select/ng-select`, Electron 35, existing CSS variables (`--bb-control-*`, `--bb-hover-list-item-bg`, `--bb-primary-ink`).

---

## File Map

| File                                                                           | Action                                                                                     |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `packages/app/src/app/components/modals/manage-servers/manage-servers.ts`      | Add `@Input() hideConnect = false`                                                         |
| `packages/app/src/app/components/modals/manage-servers/manage-servers.html`    | Wrap connect button in `@if (!hideConnect)`                                                |
| `packages/app/src/app/components/modals/manage-servers/manage-servers.spec.ts` | Create - test hideConnect behavior                                                         |
| `packages/electron/src/main.ts`                                                | Add `mainWindow.maximize()` after window creation                                          |
| `packages/app/src/app/pages/login/login.ts`                                    | Remove CRUD methods/imports; add `openManageServers()`                                     |
| `packages/app/src/app/pages/login/login.html`                                  | Full rewrite - two-column responsive layout                                                |
| `packages/app/src/app/pages/login/login.scss`                                  | Full rewrite - layout styles                                                               |
| `packages/app/src/app/pages/login/login.spec.ts`                               | Remove obsolete tests; add `openManageServers` test                                        |
| `public/i18n/us.json`                                                          | Add `general.button.manage-servers`, `pages.login.form-title`, `pages.login.form-subtitle` |
| `public/i18n/hu.json`                                                          | Add same keys in Hungarian                                                                 |

---

## Task 1: Add `hideConnect` input to ManageServers

**Files:**

- Modify: `packages/app/src/app/components/modals/manage-servers/manage-servers.ts`
- Modify: `packages/app/src/app/components/modals/manage-servers/manage-servers.html`
- Create: `packages/app/src/app/components/modals/manage-servers/manage-servers.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/app/src/app/components/modals/manage-servers/manage-servers.spec.ts`:

```typescript
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { CommandBusService } from '../../../services/command-bus.service';
import { ConfirmService } from '../../../services/confirm.service';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { ManageServers } from './manage-servers';

describe('ManageServers', () => {
  let component: ManageServers;
  let fixture: ComponentFixture<ManageServers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageServers],
      providers: [
        {
          provide: ServerStoreService,
          useValue: {
            servers: signal([]),
            currentServerId: signal(null),
          },
        },
        { provide: CommandBusService, useValue: { emit: vi.fn() } },
        { provide: ConfirmService, useValue: { confirm: vi.fn().mockResolvedValue(false) } },
        { provide: QbService, useValue: { hasCookie: vi.fn(), login: vi.fn() } },
        { provide: ToastService, useValue: { danger: vi.fn() } },
        { provide: TranslateService, useValue: { instant: vi.fn((k: string) => k) } },
        { provide: NgbModal, useValue: { open: vi.fn() } },
        { provide: NgbActiveModal, useValue: { dismiss: vi.fn() } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ManageServers);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('hideConnect', () => {
    it('should default to false', () => {
      expect(component.hideConnect).toBe(false);
    });

    it('should hide the connect button when true', () => {
      component.hideConnect = true;
      fixture.detectChanges();
      const connectBtn = fixture.nativeElement.querySelector('[data-testid="connect-btn"]');
      expect(connectBtn).toBeNull();
    });

    it('should show the connect button when false', () => {
      // Add a server that is not the current server so the action buttons render
      const serverStoreMock = TestBed.inject(ServerStoreService) as any;
      serverStoreMock.servers.set([
        { id: 'srv-1', name: 'Test', host: 'localhost', port: 8080, protocol: 'http' },
      ]);
      serverStoreMock.currentServerId.set('other-id');
      component.hideConnect = false;
      fixture.detectChanges();
      const connectBtn = fixture.nativeElement.querySelector('[data-testid="connect-btn"]');
      expect(connectBtn).not.toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- --project=packages/app --testPathPattern=manage-servers.spec
```

Expected: FAIL - `hideConnect` property not found, connect button selector not found.

- [ ] **Step 3: Add `@Input() hideConnect` to manage-servers.ts**

In `packages/app/src/app/components/modals/manage-servers/manage-servers.ts`, add the `Input` import and the property:

```typescript
import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
```

Inside the class, after the `public readonly icon` line:

```typescript
@Input() hideConnect = false;
```

- [ ] **Step 4: Add `data-testid` and `@if (!hideConnect)` to manage-servers.html**

The connect button is the first `<button>` inside the `@if (currentServerId() !== server.id)` block (lines 67-99 of the current file). Wrap it:

```html
@if (!hideConnect) {
<button
  type="button"
  class="btn btn-link p-1"
  data-testid="connect-btn"
  [ngbTooltip]="'components.modals.manage-servers.button.connect' | translate"
  (click)="switchTo(server)"
  [disabled]="busy()"
>
  @if (connectingId() === server.id) {
  <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
  } @else {
  <fa-icon [icon]="icon.faPlug" />
  }
</button>
}
```

The full updated `@if (currentServerId() !== server.id)` block in `manage-servers.html` becomes:

```html
@if (currentServerId() !== server.id) {
<div class="d-flex gap-1 flex-shrink-0 align-items-center">
  @if (!hideConnect) {
  <button
    type="button"
    class="btn btn-link p-1"
    data-testid="connect-btn"
    [ngbTooltip]="'components.modals.manage-servers.button.connect' | translate"
    (click)="switchTo(server)"
    [disabled]="busy()"
  >
    @if (connectingId() === server.id) {
    <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
    } @else {
    <fa-icon [icon]="icon.faPlug" />
    }
  </button>
  }
  <button
    type="button"
    class="btn btn-link p-1"
    [ngbTooltip]="'general.button.edit' | translate"
    (click)="openEditor(server.id)"
    [disabled]="busy()"
  >
    <fa-icon [icon]="icon.faPenToSquare" />
  </button>
  <button
    type="button"
    class="btn btn-link text-danger p-1"
    [ngbTooltip]="'general.button.delete' | translate"
    (click)="delete(server)"
    [disabled]="busy()"
  >
    <fa-icon [icon]="icon.faTrashCan" />
  </button>
</div>
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm test -- --project=packages/app --testPathPattern=manage-servers.spec
```

Expected: all 3 `hideConnect` tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/components/modals/manage-servers/
git commit -m "#137: add hideConnect input to ManageServers modal"
```

---

## Task 2: Add i18n keys

**Files:**

- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

- [ ] **Step 1: Add keys to us.json**

In `public/i18n/us.json`, inside the `"general"` > `"button"` object (after `"add-server": "Add Server"`), add:

```json
"manage-servers": "Manage Servers",
```

In the same file, inside `"pages"` > `"login"` (after `"tagline"`), add:

```json
"form-title": "Connect to Server",
"form-subtitle": "Select an active host instance to open your remote dashboard.",
```

- [ ] **Step 2: Add keys to hu.json**

In `public/i18n/hu.json`, inside `"general"` > `"button"` (after `"add-server"`), add:

```json
"manage-servers": "Szerverek kezelése",
```

In the same file, inside `"pages"` > `"login"` (after `"tagline"`), add:

```json
"form-title": "Csatlakozás",
"form-subtitle": "Válassz gazdagépet a vezérlőpult megnyitásához.",
```

- [ ] **Step 3: Commit**

```bash
git add public/i18n/
git commit -m "#137: add manage-servers and login form i18n keys"
```

---

## Task 3: Remove window sizing from login

**Files:**

- Modify: `packages/app/src/app/pages/login/login.ts`

- [ ] **Step 1: Remove setSize call from ngOnInit**

In `packages/app/src/app/pages/login/login.ts`, remove line 93:

```typescript
// REMOVE this line:
this.windowService.setSize(600, 750);
```

`ngOnInit` should now start with `try {` immediately after `this.loading.set(true)`.

- [ ] **Step 2: Check for window resize on login success**

Open `connect()` in `login.ts` (around line 127). The method currently calls `this.windowService.setOpenFilesEnabled(true)` and navigates to main. There is no `maximize()` call here - no changes needed.

Also scan the main page component (`packages/app/src/app/pages/main/`) for any `windowService.setSize()` or `windowService.maximize()` called when entering main or leaving it (logout). Run:

```bash
grep -rn "setSize\|\.maximize\(\)\|\.unmaximize\(\)" packages/app/src/app/pages/ packages/app/src/app/services/
```

If any `setSize` or `maximize` calls appear in response to navigation/auth events, remove them. Window state is now fully user-driven.

- [ ] **Step 3: Commit**

```bash
git add packages/app/src/app/pages/login/login.ts
git commit -m "#137: remove programmatic window sizing from login"
```

---

## Task 4: Start app maximized in Electron

**Files:**

- Modify: `packages/electron/src/main.ts`

- [ ] **Step 1: Add maximize call after window creation**

In `packages/electron/src/main.ts`, find the `app.whenReady()` block (around line 79). After the `createOrRestoreMainWindow(startMinimized)` call, add the maximize:

```typescript
app.whenReady().then(() => {
  loadTranslations(getInitialLanguage());
  registerI18nIpcHandlers();

  const { openAtLogin, startMinimized } = getStartupSettings();
  app.setLoginItemSettings({ openAtLogin });
  const mainWindow = createOrRestoreMainWindow(startMinimized);
  if (!startMinimized) mainWindow.maximize();

  app.on('activate', () => {
    createOrRestoreMainWindow();
  });
});
```

Note: `createOrRestoreMainWindow` already returns the `BrowserWindow` instance. Capture it in a `const` to call `.maximize()`. Check that the existing call `createOrRestoreMainWindow(startMinimized)` does not already capture the return value - if it does, just append `.maximize()` to that.

- [ ] **Step 2: Build Electron to verify no TypeScript errors**

```bash
npm run build:electron
```

Expected: exits with code 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/electron/src/main.ts
git commit -m "#137: start app window maximized on startup"
```

---

## Task 5: Rewrite login TypeScript

**Files:**

- Modify: `packages/app/src/app/pages/login/login.ts`

- [ ] **Step 1: Remove unused imports and injected services**

Replace the full import section and class body with the version below. Changes from current:

- **Removed imports:** `faEdit`, `faSquare`, `faSquareCheck`, `faTrashCan` (FA icons), `FontAwesomeModule`, `NgbDropdownModule`, `ConfirmService`
- **Removed injections:** `confirmService`
- **Removed methods:** `addServer`, `editServer`, `deleteServer`, `toggleAutoLogin`
- **Removed property:** `icon`
- **Added method:** `openManageServers()`
- **Added import:** `ManageServers` component

Full `login.ts`:

```typescript
import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ServerRecord } from '@bitbutler/shared';
import { NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { NgLabelTemplateDirective, NgSelectComponent } from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AppLoader } from '../../components/app-loader/app-loader';
import { CredentialPrompt } from '../../components/modals/credential-prompt/credential-prompt';
import { ManageServers } from '../../components/modals/manage-servers/manage-servers';
import { CommandBusService } from '../../services/command-bus.service';
import { ElectronService } from '../../services/electron.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ServerService } from '../../services/server.service';
import { ThemeService } from '../../services/theme.service';
import { ToastService } from '../../services/toast.service';
import { WindowService } from '../../services/window.service';
import { setModalInput } from '../../utils/modal-input';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    NgOptimizedImage,
    ReactiveFormsModule,
    NgbTooltipModule,
    NgSelectComponent,
    NgLabelTemplateDirective,
    TranslatePipe,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login implements OnInit {
  private readonly themeService = inject(ThemeService);
  private readonly modalService = inject(NgbModal);
  private readonly router = inject(Router);
  private readonly qbittorrentService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly windowService = inject(WindowService);
  private readonly toastService = inject(ToastService);
  private readonly serverService = inject(ServerService);
  private readonly electronService = inject(ElectronService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly translateService = inject(TranslateService);

  public readonly logoUrl = computed(
    () => `assets/images/bitbutler-logo-${this.themeService.family()}.png`,
  );

  public servers = this.serverStoreService.servers;
  public loading = this.serverStoreService.loading;

  public serverForm: FormGroup = new FormGroup({
    server: new FormControl<string | null>(this.serverStoreService.currentServerId()),
  });

  public version = this.electronService.getBitButlerVersion();

  public trackByFn = (_index: number, item: ServerRecord) => item?.id || _index;

  constructor() {
    effect(() => {
      const storeId = this.serverStoreService.currentServerId();
      if (this.serverForm.get('server')?.value !== storeId) {
        this.serverForm.get('server')?.patchValue(storeId, { emitEvent: false });
      }
    });
  }

  public async ngOnInit(): Promise<void> {
    try {
      this.loading.set(true);
      await this.serverStoreService.refresh();

      const servers = this.servers();
      const autoLoginServer = servers.find((s) => s.auto_login);
      const isLogoutRedirect = this.serverStoreService.isAutoLoginSuppressed();

      let serverToSelectId: string | null = this.serverStoreService.currentServerId();

      if (autoLoginServer) {
        serverToSelectId = autoLoginServer.id;
      } else if (!serverToSelectId && servers.length > 0) {
        serverToSelectId = servers[0].id;
      }

      this.serverStoreService.select(serverToSelectId);

      this.serverForm.get('server')?.valueChanges.subscribe((id) => {
        this.serverStoreService.select(id ?? null);
      });

      if (autoLoginServer && !isLogoutRedirect) {
        void this.connect();
      }
    } catch (e) {
      console.error(Login.name, 'Initialization failed', e);
    } finally {
      this.loading.set(false);
    }
  }

  public async connect(): Promise<void> {
    const currentServer = this.serverStoreService.currentServer();
    if (!currentServer) return;

    let runtimeUsername: string | undefined;
    let runtimePassword: string | undefined;

    if (!currentServer.username || !currentServer.has_password) {
      const credModalRef = this.modalService.open(CredentialPrompt);
      setModalInput(credModalRef, 'serverName', currentServer.name);
      setModalInput(credModalRef, 'prefillUsername', currentServer.username);

      try {
        const result = (await credModalRef.result) as {
          username: string;
          password: string;
          save: boolean;
        };

        if (result.save && (result.username || result.password)) {
          await this.serverService.update(currentServer.id, {
            username: result.username,
            password: result.password,
          });
          this.commandBusService.emit({ type: 'SERVER_UPDATED', id: currentServer.id });
        } else {
          runtimeUsername = result.username;
          runtimePassword = result.password;
        }
      } catch {
        return;
      }
    }

    this.loading.set(true);
    const loadingModalRef = this.modalService.open(AppLoader, {
      size: 'sm',
      backdrop: 'static',
      keyboard: false,
    });
    setModalInput(
      loadingModalRef,
      'title',
      this.translateService.instant('pages.login.connecting'),
    );
    setModalInput(
      loadingModalRef,
      'message',
      `${currentServer.protocol}://${currentServer.host}:${currentServer.port}`,
    );

    this.qbittorrentService
      .login(currentServer.id, runtimeUsername, runtimePassword)
      .then(async (response) => {
        if (!response.loggedIn) return;
        this.serverStoreService.clearAutoLoginSuppression();
        await this.windowService.setOpenFilesEnabled(true);
        loadingModalRef.close();
        this.router.navigate(['/pages/main']);
      })
      .catch((error) => {
        loadingModalRef.close();
        this.toastService.danger(
          error.message,
          this.translateService.instant('pages.login.error.connection-failed'),
        );
      })
      .finally(() => this.loading.set(false));
  }

  public openManageServers(): void {
    const ref = this.modalService.open(ManageServers);
    setModalInput(ref, 'hideConnect', true);
  }

  public canConnect = () => !this.loading() && this.servers().length > 0;
  public goToRelease = () => this.electronService.goToRelease();
}
```

- [ ] **Step 2: Run lint to catch any missed unused imports**

```bash
npm run lint
```

Expected: 0 warnings, 0 errors. Fix any lint complaints before proceeding.

- [ ] **Step 3: Commit**

```bash
git add packages/app/src/app/pages/login/login.ts
git commit -m "#137: refactor login component - remove CRUD methods, add openManageServers"
```

---

## Task 6: Rewrite login HTML

**Files:**

- Modify: `packages/app/src/app/pages/login/login.html`

- [ ] **Step 1: Replace login.html with the two-column layout**

Full replacement for `packages/app/src/app/pages/login/login.html`:

```html
<div class="login-container">
  <div class="login-hero-side d-none d-md-flex">
    <div class="hero-content">
      <div class="hero-logo-wrapper">
        <img [ngSrc]="logoUrl()" alt="BitButler logo" width="260" height="260" priority />
        <span
          class="hero-version-badge cursor-pointer user-select-none"
          data-testid="version-badge"
          (click)="goToRelease()"
          >v{{ version }}</span
        >
      </div>
      <h1 class="hero-title">BitButler</h1>
      <p class="hero-subtitle mb-0">{{ 'pages.login.tagline' | translate }}</p>
    </div>
  </div>

  <div class="login-form-side">
    <div class="mobile-brand-header d-md-none text-center mb-5">
      <img
        [ngSrc]="logoUrl()"
        alt="BitButler logo"
        width="110"
        height="110"
        priority
        class="mb-3"
      />
      <h2 class="fw-bold mb-1">BitButler</h2>
      <p class="text-body-secondary small mb-0">{{ 'pages.login.tagline' | translate }}</p>
    </div>

    <div class="form-wrapper">
      <div class="mb-4">
        <h3 class="form-title" data-testid="brand-title">
          {{ 'pages.login.form-title' | translate }}
        </h3>
        <p class="text-body-secondary small mb-0">{{ 'pages.login.form-subtitle' | translate }}</p>
      </div>

      <form [formGroup]="serverForm" class="mb-4">
        <div class="form-floating">
          <ng-select
            id="server"
            data-testid="server-select"
            bindLabel="name"
            bindValue="id"
            formControlName="server"
            placeholder="No hosts"
            [searchable]="false"
            [clearable]="false"
            [items]="servers()"
            [fixedPlaceholder]="false"
            [readonly]="servers().length === 0"
            [trackByFn]="trackByFn"
          >
            <ng-template ng-label-tmp let-item="item">{{ item.name }}</ng-template>
          </ng-select>
          <label for="server">{{ 'pages.login.server-form.host' | translate }}</label>
        </div>
      </form>

      <div class="d-flex flex-column gap-3">
        <button
          type="button"
          class="btn btn-lg btn-primary"
          data-testid="connect-button"
          (click)="connect()"
          [disabled]="!canConnect()"
        >
          {{ 'general.button.connect' | translate }}
        </button>
        <button
          type="button"
          class="btn btn-lg btn-outline-secondary"
          data-testid="manage-servers-button"
          (click)="openManageServers()"
        >
          {{ 'general.button.manage-servers' | translate }}
        </button>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: 0 warnings, 0 errors.

- [ ] **Step 3: Commit**

```bash
git add packages/app/src/app/pages/login/login.html
git commit -m "#137: rewrite login template to two-column responsive layout"
```

---

## Task 7: Rewrite login SCSS

**Files:**

- Modify: `packages/app/src/app/pages/login/login.scss`

- [ ] **Step 1: Replace login.scss**

All CSS tokens used below (`--bb-control-placeholder`, `--bs-secondary`, etc.) are already defined in every app theme - no theme changes needed.

Full replacement for `packages/app/src/app/pages/login/login.scss`:

```scss
.login-container {
  display: flex;
  height: 100vh;
  width: 100vw;
}

.login-hero-side {
  flex: 0 0 45%;
  background-color: var(--bs-card-bg);
  border-right: 1px solid var(--bs-border-color);
  align-items: center;
  justify-content: center;
  padding: 3rem;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(
      circle at 30% 30%,
      color-mix(in srgb, var(--bs-secondary) 4%, transparent),
      transparent 70%
    );
    pointer-events: none;
  }
}

.hero-content {
  position: relative;
  text-align: center;
  z-index: 2;
}

.hero-logo-wrapper {
  position: relative;
  display: inline-block;
  margin-bottom: 2rem;
}

.hero-version-badge {
  position: absolute;
  top: 0;
  right: -10px;
  background-color: color-mix(in srgb, var(--bs-card-bg) 60%, #000);
  border: 1px solid var(--bs-border-color);
  color: var(--bs-secondary);
  font-size: 0.75rem;
  padding: 0.25rem 0.6rem;
  border-radius: 20px;
  font-family: monospace;
}

.hero-title {
  color: var(--bs-primary);
  font-size: 2.75rem;
  font-weight: 700;
  letter-spacing: -0.5px;
  margin-bottom: 0.25rem;
}

.hero-subtitle {
  color: var(--bb-control-placeholder);
  font-size: 1.1rem;
}

.login-form-side {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2.5rem;
  background-color: var(--bs-body-bg);
}

.form-wrapper {
  width: 100%;
  max-width: 420px;
  animation: fadeInForm 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.form-title {
  color: var(--bs-primary);
  font-weight: 600;
  font-size: 1.75rem;
  margin-bottom: 0.5rem;
}

@keyframes fadeInForm {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

::ng-deep {
  .tooltip {
    z-index: 10000 !important;
    pointer-events: none;
  }
}
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: 0 warnings, 0 errors.

- [ ] **Step 3: Commit**

```bash
git add packages/app/src/app/pages/login/login.scss
git commit -m "#137: rewrite login styles for two-column responsive layout"
```

---

## Task 8: Update login spec

**Files:**

- Modify: `packages/app/src/app/pages/login/login.spec.ts`

- [ ] **Step 1: Run current tests to establish baseline**

```bash
npm test -- --project=packages/app --testPathPattern=login.spec
```

Note which tests fail due to the changes in Task 5 (removed methods will cause test errors).

- [ ] **Step 2: Rewrite login.spec.ts**

The `editServer`, `deleteServer`, `toggleAutoLogin`, and `addServer` describe blocks are removed since those methods no longer exist. A new `openManageServers` describe block is added. The `WindowService` mock no longer needs `setSize` but it can stay (the mock being present doesn't cause test failures).

Full replacement for `packages/app/src/app/pages/login/login.spec.ts`:

```typescript
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ManageServers } from '../../components/modals/manage-servers/manage-servers';
import { CommandBusService } from '../../services/command-bus.service';
import { ElectronService } from '../../services/electron.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ServerService } from '../../services/server.service';
import { ThemeService } from '../../services/theme.service';
import { ToastService } from '../../services/toast.service';
import { WindowService } from '../../services/window.service';
import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  let serverStoreMock: {
    servers: ReturnType<typeof signal<any[]>>;
    loading: ReturnType<typeof signal<boolean>>;
    currentServerId: ReturnType<typeof signal<string | null>>;
    currentServer: ReturnType<typeof signal<any>>;
    refresh: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    isAutoLoginSuppressed: ReturnType<typeof vi.fn>;
    clearAutoLoginSuppression: ReturnType<typeof vi.fn>;
  };
  let themeMock: {
    family: ReturnType<typeof signal<string>>;
    effectiveMode: ReturnType<typeof signal<'light' | 'dark'>>;
  };
  let electronMock: {
    getBitButlerVersion: ReturnType<typeof vi.fn>;
    goToRelease: ReturnType<typeof vi.fn>;
  };
  let modalMock: { open: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    serverStoreMock = {
      servers: signal([]),
      loading: signal(false),
      currentServerId: signal(null),
      currentServer: signal(null),
      refresh: vi.fn().mockResolvedValue(undefined),
      select: vi.fn(),
      isAutoLoginSuppressed: vi.fn().mockReturnValue(false),
      clearAutoLoginSuppression: vi.fn(),
    };
    themeMock = { family: signal('bitbutler'), effectiveMode: signal<'light' | 'dark'>('dark') };
    electronMock = {
      getBitButlerVersion: vi.fn().mockReturnValue('1.0.0'),
      goToRelease: vi.fn(),
    };
    modalMock = {
      open: vi
        .fn()
        .mockReturnValue({ componentInstance: {}, close: vi.fn(), result: Promise.reject() }),
    };

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        { provide: ServerStoreService, useValue: serverStoreMock },
        { provide: ServerService, useValue: { update: vi.fn().mockResolvedValue(undefined) } },
        { provide: ThemeService, useValue: themeMock },
        { provide: ToastService, useValue: { danger: vi.fn() } },
        { provide: ElectronService, useValue: electronMock },
        { provide: CommandBusService, useValue: { emit: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: NgbModal, useValue: modalMock },
        {
          provide: QbService,
          useValue: { login: vi.fn().mockResolvedValue({ loggedIn: false }) },
        },
        {
          provide: WindowService,
          useValue: {
            setOpenFilesEnabled: vi.fn().mockResolvedValue(undefined),
            maximize: vi.fn(),
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('trackByFn', () => {
    it('should return item id when present', () => {
      expect(component.trackByFn(0, { id: 'abc' } as any)).toBe('abc');
    });

    it('should return the index when item id is absent', () => {
      expect(component.trackByFn(5, {} as any)).toBe(5);
    });

    it('should return the index when item is null', () => {
      expect(component.trackByFn(3, null as any)).toBe(3);
    });
  });

  describe('canConnect', () => {
    it('should return false when loading', () => {
      serverStoreMock.loading.set(true);
      serverStoreMock.servers.set([{ id: '1' }] as any);
      expect(component.canConnect()).toBe(false);
    });

    it('should return false when the server list is empty', () => {
      serverStoreMock.loading.set(false);
      serverStoreMock.servers.set([]);
      expect(component.canConnect()).toBe(false);
    });

    it('should return true when not loading and servers exist', () => {
      serverStoreMock.loading.set(false);
      serverStoreMock.servers.set([{ id: '1' }] as any);
      expect(component.canConnect()).toBe(true);
    });
  });

  describe('logoUrl', () => {
    it('should build a URL from the current theme family', () => {
      themeMock.family.set('aurora');
      expect(component.logoUrl()).toBe('assets/images/bitbutler-logo-aurora.png');
    });
  });

  describe('goToRelease', () => {
    it('should delegate to electronService.goToRelease', () => {
      component.goToRelease();
      expect(electronMock.goToRelease).toHaveBeenCalled();
    });
  });

  describe('openManageServers', () => {
    it('should open the ManageServers modal', () => {
      component.openManageServers();
      expect(modalMock.open).toHaveBeenCalledWith(ManageServers);
    });

    it('should set hideConnect to true on the opened modal', () => {
      const mockRef = { componentInstance: {} as any };
      modalMock.open.mockReturnValue(mockRef);
      component.openManageServers();
      expect(mockRef.componentInstance.hideConnect).toBe(true);
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
npm test -- --project=packages/app --testPathPattern=login.spec
```

Expected: all tests PASS.

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all tests pass across all workspaces.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/pages/login/login.spec.ts
git commit -m "#137: update login spec - remove CRUD tests, add openManageServers test"
```

---

## Task 9: Visual verification

- [ ] **Step 1: Start the app**

```bash
npm start
```

- [ ] **Step 2: Verify startup behavior**

- Window opens maximized (not 600x750)
- Login page shows two columns: hero side on the left (logo, "BitButler", tagline), form on the right
- Version badge appears near the logo in the hero side (not fixed top-right)
- ng-select shows only the server name when selected - no inline edit/delete/auto-login buttons in the dropdown options

- [ ] **Step 3: Verify Manage Servers button**

- Click "Manage Servers" - the ManageServers modal opens
- In the modal, servers listed show only edit and delete buttons - no connect (plug) button
- "Add Server" in the modal footer opens the server editor

- [ ] **Step 4: Verify connect flow**

- Select a server in the ng-select, click "Connect" - connection proceeds normally
- On logout, the window stays maximized (no resize to 600x750)

- [ ] **Step 5: Run lint one final time**

```bash
npm run lint
```

Expected: 0 warnings, 0 errors.
