# qBittorrent Settings Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tabbed "qBittorrent Settings" modal that reads and writes remote qBittorrent-nox application preferences via `getAppPreferences` / `setAppPreferences`, with per-tab dirty tracking, an unsaved-changes guard, and a new button-bar entry.

**Architecture:** The modal mirrors the existing `pages/settings/` structure exactly — a shell component owns a `QbSettingsStateService` (preferences signal + dirty tracking + save registry), four lazy-loaded tab components each patch a reactive form from the state service and register their save function. The shell fetches preferences once on init before loading tab components, so every tab's `ngOnInit` sees a populated signal.

**Tech Stack:** Angular 20 (signals, zoneless, reactive forms), NgbModal, NgbTooltip, ng-select, FontAwesome, SpeedLimitPipe, TranslatePipe, ngx-translate, Vitest

---

## File Map

**Create:**

- `packages/app/src/app/pages/qb-settings/qb-settings.interface.ts`
- `packages/app/src/app/pages/qb-settings/qb-settings-state.service.ts`
- `packages/app/src/app/pages/qb-settings/qb-settings-state.service.spec.ts`
- `packages/app/src/app/pages/qb-settings/qb-settings.ts`
- `packages/app/src/app/pages/qb-settings/qb-settings.html`
- `packages/app/src/app/pages/qb-settings/qb-settings.scss`
- `packages/app/src/app/pages/qb-settings/qb-settings.spec.ts`
- `packages/app/src/app/pages/qb-settings/bandwidth/bandwidth.ts`
- `packages/app/src/app/pages/qb-settings/bandwidth/bandwidth.html`
- `packages/app/src/app/pages/qb-settings/bandwidth/bandwidth.scss`
- `packages/app/src/app/pages/qb-settings/bandwidth/bandwidth.spec.ts`
- `packages/app/src/app/pages/qb-settings/storage/storage.ts`
- `packages/app/src/app/pages/qb-settings/storage/storage.html`
- `packages/app/src/app/pages/qb-settings/storage/storage.scss`
- `packages/app/src/app/pages/qb-settings/storage/storage.spec.ts`
- `packages/app/src/app/pages/qb-settings/queue-limits/queue-limits.ts`
- `packages/app/src/app/pages/qb-settings/queue-limits/queue-limits.html`
- `packages/app/src/app/pages/qb-settings/queue-limits/queue-limits.scss`
- `packages/app/src/app/pages/qb-settings/queue-limits/queue-limits.spec.ts`
- `packages/app/src/app/pages/qb-settings/seeding-ratios/seeding-ratios.ts`
- `packages/app/src/app/pages/qb-settings/seeding-ratios/seeding-ratios.html`
- `packages/app/src/app/pages/qb-settings/seeding-ratios/seeding-ratios.scss`
- `packages/app/src/app/pages/qb-settings/seeding-ratios/seeding-ratios.spec.ts`

**Modify:**

- `packages/app/src/app/models/qbittorrent.model.ts` — add 74 fields, make 12 optional, fix `proxy_type`
- `packages/app/src/app/models/command.model.ts` — add `UI_OPEN_QB_SETTINGS` to `UiCommand`
- `packages/app/src/app/services/ui-command-handler.service.ts` — handle new command
- `packages/app/src/app/pages/main/button-bar/button-bar.ts` — add entry + onClick case
- `public/i18n/us.json` — add all new translation keys (English)
- `public/i18n/hu.json` — add all new translation keys (Hungarian)

---

## Task 1: Update `QbAppPreferences` model

**Files:**

- Modify: `packages/app/src/app/models/qbittorrent.model.ts`

- [ ] **Step 1: Replace the `QbAppPreferences` interface**

Open `packages/app/src/app/models/qbittorrent.model.ts` and replace the entire `QbAppPreferences` interface (lines 92–233) with the updated version below. This adds 74 missing fields, makes 12 obsolete fields optional, and fixes `proxy_type`.

```typescript
export interface QbAppPreferences {
  add_to_top_of_queue: boolean;
  add_trackers: string;
  add_trackers_enabled: boolean;
  alt_dl_limit: number;
  alt_up_limit: number;
  alternative_webui_enabled: boolean;
  alternative_webui_path: string;
  announce_ip: string;
  announce_to_all_tiers: boolean;
  announce_to_all_trackers: boolean;
  anonymous_mode: boolean;
  async_io_threads: number;
  auto_delete_mode: number;
  auto_tmm_enabled: boolean;
  autorun_enabled: boolean;
  autorun_on_torrent_added_enabled: boolean;
  autorun_on_torrent_added_program: string;
  autorun_program: string;
  banned_IPs: string;
  bdecode_depth_limit: number;
  bdecode_token_limit: number;
  bittorrent_protocol: number;
  block_peers_on_privileged_ports: boolean;
  bypass_auth_subnet_whitelist: string;
  bypass_auth_subnet_whitelist_enabled: boolean;
  bypass_local_auth: boolean;
  category_changed_tmm_enabled: boolean;
  checking_memory_use: number;
  connection_speed: number;
  current_interface_address: string;
  current_interface_name: string;
  current_network_interface: string;
  dht: boolean;
  disk_cache: number;
  disk_cache_ttl: number;
  disk_io_read_mode: number;
  disk_io_type: number;
  disk_io_write_mode: number;
  disk_queue_size: number;
  dl_limit: number;
  dont_count_slow_torrents: boolean;
  dyndns_domain: string;
  dyndns_enabled: boolean;
  dyndns_password: string;
  dyndns_service: number;
  dyndns_username: string;
  embedded_tracker_port: number;
  embedded_tracker_port_forwarding: boolean;
  enable_coalesce_read_write: boolean;
  enable_embedded_tracker: boolean;
  enable_multi_connections_from_same_ip: boolean;
  enable_os_cache?: boolean;
  enable_piece_extent_affinity: boolean;
  enable_super_seeding?: boolean;
  enable_upload_suggestions: boolean;
  encryption: number;
  excluded_file_names: string;
  excluded_file_names_enabled: boolean;
  export_dir: string;
  export_dir_fin: string;
  file_log_age: number;
  file_log_age_type: number;
  file_log_backup_enabled: boolean;
  file_log_delete_old: boolean;
  file_log_enabled: boolean;
  file_log_max_size: number;
  file_log_path: string;
  file_pool_size: number;
  hashing_threads: number;
  i2p_address: string;
  i2p_enabled: boolean;
  i2p_inbound_length: number;
  i2p_inbound_quantity: number;
  i2p_mixed_mode: boolean;
  i2p_outbound_length: number;
  i2p_outbound_quantity: number;
  i2p_port: number;
  idn_support_enabled: boolean;
  incomplete_files_ext: boolean;
  ip_filter_enabled: boolean;
  ip_filter_path: string;
  ip_filter_trackers: boolean;
  limit_lan_peers: boolean;
  limit_tcp_overhead: boolean;
  limit_utp_rate: boolean;
  listen_port: number;
  locale: string;
  lsd: boolean;
  mail_notification_auth_enabled: boolean;
  mail_notification_email: string;
  mail_notification_enabled: boolean;
  mail_notification_password: string;
  mail_notification_sender: string;
  mail_notification_smtp: string;
  mail_notification_smtp_server?: string;
  mail_notification_ssl_enabled: boolean;
  mail_notification_username: string;
  max_active_checking_torrents: number;
  max_active_downloads: number;
  max_active_torrents: number;
  max_active_uploads: number;
  max_concurrent_http_announces: number;
  max_connec: number;
  max_connec_per_torrent: number;
  max_half_open_connec?: number;
  max_inactive_seeding_time?: number;
  max_inactive_seeding_time_enabled?: boolean;
  max_ratio: number;
  max_ratio_act: number;
  max_ratio_enabled: boolean;
  max_seeding_time: number;
  max_seeding_time_enabled: boolean;
  max_uploads: number;
  max_uploads_per_torrent: number;
  memory_working_set_limit: number;
  merge_trackers: boolean;
  outgoing_ports_max: number;
  outgoing_ports_min: number;
  peer_proportional?: boolean;
  peer_tos: number;
  peer_turnover: number;
  peer_turnover_cutoff: number;
  peer_turnover_interval: number;
  performance_warning: boolean;
  pex: boolean;
  preallocate_all: boolean;
  proxy_auth_enabled: boolean;
  proxy_bittorrent: boolean;
  proxy_hostname_lookup: boolean;
  proxy_ip: string;
  proxy_misc: boolean;
  proxy_password: string;
  proxy_peer_connections: boolean;
  proxy_port: number;
  proxy_rss: boolean;
  proxy_torrents_only?: boolean;
  proxy_type: string | number;
  proxy_username: string;
  queueing_enabled: boolean;
  random_port: boolean;
  reannounce_when_address_changed: boolean;
  recheck_completed_torrents: boolean;
  recheck_torrents_on_completion?: boolean;
  refresh_interval: number;
  request_queue_size: number;
  resolve_peer_countries: boolean;
  resume_data_storage_type: string;
  rss_auto_downloading_enabled: boolean;
  rss_download_repack_proper_episodes: boolean;
  rss_download_rules?: string;
  rss_max_articles_per_feed: number;
  rss_processing_enabled: boolean;
  rss_refresh_interval: number;
  rss_smart_episode_filters: string;
  save_path: string;
  save_path_changed_tmm_enabled: boolean;
  save_resume_data_interval: number;
  scan_dirs: Record<string, string>;
  schedule_from_hour: number;
  schedule_from_min: number;
  schedule_to_hour: number;
  schedule_to_min: number;
  scheduler_days: number;
  scheduler_enabled: boolean;
  send_buffer_low_watermark: number;
  send_buffer_watermark: number;
  send_buffer_watermark_factor: number;
  slow_torrent_dl_rate_threshold: number;
  slow_torrent_inactive_timer: number;
  slow_torrent_ul_rate_threshold: number;
  smtp_server?: string;
  socket_backlog_size: number;
  socket_receive_buffer_size: number;
  socket_send_buffer_size: number;
  ssl_cert?: string;
  ssl_key?: string;
  ssrf_mitigation: boolean;
  start_paused_enabled: boolean;
  stop_tracker_timeout: number;
  temp_path: string;
  temp_path_enabled: boolean;
  torrent_changed_tmm_enabled: boolean;
  torrent_content_layout: string;
  torrent_file_size_limit: number;
  torrent_stop_condition: string;
  up_limit: number;
  upload_choking_algorithm: number;
  upload_slots_behavior: number;
  upnp: boolean;
  upnp_lease_duration: number;
  use_category_paths_in_manual_mode: boolean;
  use_https: boolean;
  use_subcategories: boolean;
  utp_tcp_mixed_mode: number;
  validate_https_tracker_certificate: boolean;
  web_ui_address: string;
  web_ui_ban_duration: number;
  web_ui_ban_subnets?: string;
  web_ui_clickjacking_protection_enabled: boolean;
  web_ui_csrf_protection_enabled: boolean;
  web_ui_custom_http_headers: string;
  web_ui_domain_list: string;
  web_ui_host_header_validation_enabled: boolean;
  web_ui_https_cert_path: string;
  web_ui_https_key_path: string;
  web_ui_max_auth_fail_count: number;
  web_ui_port: number;
  web_ui_reverse_proxies_list: string;
  web_ui_reverse_proxy_enabled: boolean;
  web_ui_secure_cookie_enabled: boolean;
  web_ui_session_timeout: number;
  web_ui_upnp: boolean;
  web_ui_use_custom_http_headers_enabled: boolean;
  web_ui_username: string;
}

export type QbSetAppPreferences = Partial<QbAppPreferences>;
```

- [ ] **Step 2: Run lint to verify no type errors**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Commit**

```bash
git add packages/app/src/app/models/qbittorrent.model.ts
git commit -m "#86: update QbAppPreferences with all missing fields from real API"
```

---

## Task 2: Interface file + command type

**Files:**

- Create: `packages/app/src/app/pages/qb-settings/qb-settings.interface.ts`
- Modify: `packages/app/src/app/models/command.model.ts`

- [ ] **Step 1: Create the interface file**

```typescript
// packages/app/src/app/pages/qb-settings/qb-settings.interface.ts
import { Type } from '@angular/core';

export type QbSettingsTabId = 'bandwidth' | 'storage' | 'queue-limits' | 'seeding-ratios';

export interface QbSettingsTab {
  id: QbSettingsTabId;
  label: string;
  loadComponent: () => Promise<Type<QbSettingsTabComponent>>;
}

export interface QbSettingsTabComponent {}
```

- [ ] **Step 2: Add the command type**

In `packages/app/src/app/models/command.model.ts`, add `{ type: 'UI_OPEN_QB_SETTINGS' }` to the `UiCommand` union (after `UI_OPEN_SETTINGS`):

```typescript
export type UiCommand =
  | { type: 'UI_SERVER_EDITOR_OPEN'; id?: string }
  | { type: 'UI_TORRENT_DELETE_REQUEST'; defaultRemoveFiles?: boolean }
  | { type: 'UI_OPEN_SETTINGS'; tabToOpen?: SettingsTabId }
  | { type: 'UI_OPEN_QB_SETTINGS' }
  | { type: 'UI_OPEN_TORRENT_DETAILS'; hash: string };
// ... rest unchanged
```

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/pages/qb-settings/qb-settings.interface.ts \
        packages/app/src/app/models/command.model.ts
git commit -m "#86: add QbSettingsTabId interface and UI_OPEN_QB_SETTINGS command type"
```

---

## Task 3: `QbSettingsStateService`

**Files:**

- Create: `packages/app/src/app/pages/qb-settings/qb-settings-state.service.ts`
- Create: `packages/app/src/app/pages/qb-settings/qb-settings-state.service.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/app/src/app/pages/qb-settings/qb-settings-state.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { QbSettingsStateService } from './qb-settings-state.service';

const MOCK_PREFS: any = { dl_limit: 0, save_path: '/tmp' };

describe('QbSettingsStateService', () => {
  let service: QbSettingsStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [QbSettingsStateService] });
    service = TestBed.inject(QbSettingsStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('preferences', () => {
    it('should be null initially', () => {
      expect(service.preferences()).toBeNull();
    });

    it('should be set after setPreferences is called', () => {
      service.setPreferences(MOCK_PREFS);
      expect(service.preferences()).toBe(MOCK_PREFS);
    });
  });

  describe('isDirty', () => {
    it('should be false initially', () => {
      expect(service.isDirty()).toBe(false);
    });

    it('should be true after any tab is marked dirty', () => {
      service.markDirty('bandwidth', true);
      expect(service.isDirty()).toBe(true);
    });

    it('should be false once the dirty tab is cleaned', () => {
      service.markDirty('bandwidth', true);
      service.markDirty('bandwidth', false);
      expect(service.isDirty()).toBe(false);
    });
  });

  describe('isDirtyMap', () => {
    it('should start with all tabs clean', () => {
      expect(Object.values(service.isDirtyMap()).every((v) => !v)).toBe(true);
    });

    it('should reflect per-tab dirty state', () => {
      service.markDirty('storage', true);
      expect(service.isDirtyMap()['storage']).toBe(true);
      expect(service.isDirtyMap()['bandwidth']).toBe(false);
    });
  });

  describe('resetDirty', () => {
    it('should reset all dirty tabs to clean', () => {
      service.markDirty('bandwidth', true);
      service.markDirty('storage', true);
      service.resetDirty();
      expect(service.isDirty()).toBe(false);
    });
  });

  describe('registerSave / saveAll', () => {
    it('should call the save fn for dirty tabs only', async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      service.registerSave('bandwidth', fn);
      service.markDirty('bandwidth', true);
      await service.saveAll();
      expect(fn).toHaveBeenCalledOnce();
    });

    it('should not call save fn for clean tabs', async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      service.registerSave('storage', fn);
      await service.saveAll();
      expect(fn).not.toHaveBeenCalled();
    });

    it('should reset dirty state after saving', async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      service.registerSave('bandwidth', fn);
      service.markDirty('bandwidth', true);
      await service.saveAll();
      expect(service.isDirty()).toBe(false);
    });

    it('should call save fns for every dirty tab', async () => {
      const bwFn = vi.fn().mockResolvedValue(undefined);
      const stFn = vi.fn().mockResolvedValue(undefined);
      service.registerSave('bandwidth', bwFn);
      service.registerSave('storage', stFn);
      service.markDirty('bandwidth', true);
      service.markDirty('storage', true);
      await service.saveAll();
      expect(bwFn).toHaveBeenCalledOnce();
      expect(stFn).toHaveBeenCalledOnce();
    });

    it('should resolve without throwing when no fn is registered for a dirty tab', async () => {
      service.markDirty('bandwidth', true);
      await expect(service.saveAll()).resolves.not.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm test
```

Expected: fails with "QbSettingsStateService not found" or similar import error.

- [ ] **Step 3: Implement the service**

```typescript
// packages/app/src/app/pages/qb-settings/qb-settings-state.service.ts
import { Injectable, computed, signal } from '@angular/core';
import { QbAppPreferences } from '../../models/qbittorrent.model';
import { QbSettingsTabId } from './qb-settings.interface';

type DirtyMap = Record<QbSettingsTabId, boolean>;

const INITIAL_DIRTY: DirtyMap = {
  bandwidth: false,
  storage: false,
  'queue-limits': false,
  'seeding-ratios': false,
};

@Injectable()
export class QbSettingsStateService {
  private readonly _preferences = signal<QbAppPreferences | null>(null);
  private readonly _dirtyTabs = signal<DirtyMap>({ ...INITIAL_DIRTY });
  private readonly saveFns = new Map<QbSettingsTabId, () => Promise<void>>();

  public readonly preferences = this._preferences.asReadonly();
  public readonly isDirty = computed(() => Object.values(this._dirtyTabs()).some(Boolean));
  public readonly isDirtyMap = this._dirtyTabs.asReadonly();

  public setPreferences(prefs: QbAppPreferences): void {
    this._preferences.set(prefs);
  }

  public markDirty(id: QbSettingsTabId, dirty: boolean): void {
    this._dirtyTabs.update((tabs) => ({ ...tabs, [id]: dirty }));
  }

  public registerSave(id: QbSettingsTabId, fn: () => Promise<void>): void {
    this.saveFns.set(id, fn);
  }

  public resetDirty(): void {
    this._dirtyTabs.set({ ...INITIAL_DIRTY });
  }

  public async saveAll(): Promise<void> {
    const dirty = this._dirtyTabs();
    await Promise.all(
      (Object.keys(dirty) as QbSettingsTabId[])
        .filter((id) => dirty[id])
        .map((id) => this.saveFns.get(id)?.() ?? Promise.resolve()),
    );
    this.resetDirty();
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: all `QbSettingsStateService` tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/pages/qb-settings/qb-settings-state.service.ts \
        packages/app/src/app/pages/qb-settings/qb-settings-state.service.spec.ts
git commit -m "#86: add QbSettingsStateService with dirty tracking and save registry"
```

---

## Task 4: `QbSettings` modal shell

**Files:**

- Create: `packages/app/src/app/pages/qb-settings/qb-settings.ts`
- Create: `packages/app/src/app/pages/qb-settings/qb-settings.html`
- Create: `packages/app/src/app/pages/qb-settings/qb-settings.scss`
- Create: `packages/app/src/app/pages/qb-settings/qb-settings.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/app/src/app/pages/qb-settings/qb-settings.spec.ts
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ConfirmService } from '../../services/confirm.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';
import { QbSettings } from './qb-settings';
import { QbSettingsStateService } from './qb-settings-state.service';

describe('QbSettings', () => {
  let component: QbSettings;
  let fixture: ComponentFixture<QbSettings>;

  let stateServiceMock: {
    isDirty: ReturnType<typeof signal<boolean>>;
    isDirtyMap: ReturnType<typeof signal<any>>;
    saveAll: ReturnType<typeof vi.fn>;
    resetDirty: ReturnType<typeof vi.fn>;
    setPreferences: ReturnType<typeof vi.fn>;
  };
  let confirmMock: { confirm: ReturnType<typeof vi.fn> };
  let toastMock: { success: ReturnType<typeof vi.fn> };
  let qbMock: { getAppPreferences: ReturnType<typeof vi.fn> };
  let serverStoreMock: { currentServerId: ReturnType<typeof signal<string | null>> };

  beforeEach(async () => {
    stateServiceMock = {
      isDirty: signal(false),
      isDirtyMap: signal({
        bandwidth: false,
        storage: false,
        'queue-limits': false,
        'seeding-ratios': false,
      }),
      saveAll: vi.fn().mockResolvedValue(undefined),
      resetDirty: vi.fn(),
      setPreferences: vi.fn(),
    };
    confirmMock = { confirm: vi.fn().mockResolvedValue(false) };
    toastMock = { success: vi.fn() };
    qbMock = { getAppPreferences: vi.fn().mockResolvedValue({ dl_limit: 0 }) };
    serverStoreMock = { currentServerId: signal('server-1') };

    await TestBed.configureTestingModule({
      imports: [QbSettings],
      providers: [
        { provide: NgbActiveModal, useValue: { close: vi.fn(), dismiss: vi.fn() } },
        { provide: ConfirmService, useValue: confirmMock },
        { provide: ToastService, useValue: toastMock },
        { provide: QbService, useValue: qbMock },
        { provide: ServerStoreService, useValue: serverStoreMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(QbSettings, {
        set: {
          providers: [{ provide: QbSettingsStateService, useValue: stateServiceMock }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(QbSettings);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('tabs', () => {
    it('should define exactly 4 tabs', () => {
      expect(component.tabs).toHaveLength(4);
    });

    it('should contain bandwidth, storage, queue-limits and seeding-ratios tabs', () => {
      const ids = component.tabs.map((t) => t.id);
      expect(ids).toContain('bandwidth');
      expect(ids).toContain('storage');
      expect(ids).toContain('queue-limits');
      expect(ids).toContain('seeding-ratios');
    });
  });

  describe('selectTab', () => {
    it('should update activeTabId signal', () => {
      component.selectTab('storage');
      expect(component.activeTabId()).toBe('storage');
    });
  });

  describe('canDeactivate', () => {
    it('should return true immediately when not dirty', async () => {
      stateServiceMock.isDirty.set(false);
      const result = await component.canDeactivate();
      expect(result).toBe(true);
      expect(confirmMock.confirm).not.toHaveBeenCalled();
    });

    it('should open confirm dialog when dirty', async () => {
      stateServiceMock.isDirty.set(true);
      await component.canDeactivate();
      expect(confirmMock.confirm).toHaveBeenCalled();
    });

    it('should reset dirty and return true when user confirms leave', async () => {
      stateServiceMock.isDirty.set(true);
      confirmMock.confirm.mockResolvedValue(true);
      const result = await component.canDeactivate();
      expect(stateServiceMock.resetDirty).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should not reset dirty and return false when user stays', async () => {
      stateServiceMock.isDirty.set(true);
      confirmMock.confirm.mockResolvedValue(false);
      const result = await component.canDeactivate();
      expect(stateServiceMock.resetDirty).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('onSave', () => {
    it('should call stateService.saveAll', async () => {
      await component.onSave();
      expect(stateServiceMock.saveAll).toHaveBeenCalled();
    });

    it('should show a success toast', async () => {
      await component.onSave();
      expect(toastMock.success).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm test
```

Expected: fails — `QbSettings` does not exist yet.

- [ ] **Step 3: Implement the shell component TypeScript**

```typescript
// packages/app/src/app/pages/qb-settings/qb-settings.ts
import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, Type, inject, signal } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPencil } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { BbSpinner } from '../../components/bb-spinner/bb-spinner';
import { AutofocusDirective } from '../../directives/autofocus';
import { GuardableModal } from '../../models/guardable-modal.interface';
import { ConfirmService } from '../../services/confirm.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';
import { QbSettingsStateService } from './qb-settings-state.service';
import { QbSettingsTab, QbSettingsTabComponent, QbSettingsTabId } from './qb-settings.interface';

@Component({
  selector: 'app-qb-settings',
  imports: [
    CommonModule,
    AutofocusDirective,
    TranslatePipe,
    BbSpinner,
    FontAwesomeModule,
    NgbTooltipModule,
  ],
  providers: [QbSettingsStateService],
  templateUrl: './qb-settings.html',
  styleUrl: './qb-settings.scss',
})
export class QbSettings implements OnInit, GuardableModal {
  public readonly activeModal = inject(NgbActiveModal);
  public readonly stateService = inject(QbSettingsStateService);
  private readonly confirmService = inject(ConfirmService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);

  public activeTabId = signal<QbSettingsTabId>('bandwidth');
  public loadedComponents = signal<Map<QbSettingsTabId, Type<QbSettingsTabComponent>>>(new Map());

  public icon = { faPencil };

  public tabs: QbSettingsTab[] = [
    {
      id: 'bandwidth',
      label: 'pages.qb-settings.tab.bandwidth.title',
      loadComponent: () => import('./bandwidth/bandwidth').then((m) => m.Bandwidth),
    },
    {
      id: 'storage',
      label: 'pages.qb-settings.tab.storage.title',
      loadComponent: () => import('./storage/storage').then((m) => m.Storage),
    },
    {
      id: 'queue-limits',
      label: 'pages.qb-settings.tab.queue-limits.title',
      loadComponent: () => import('./queue-limits/queue-limits').then((m) => m.QueueLimits),
    },
    {
      id: 'seeding-ratios',
      label: 'pages.qb-settings.tab.seeding-ratios.title',
      loadComponent: () => import('./seeding-ratios/seeding-ratios').then((m) => m.SeedingRatios),
    },
  ];

  public async ngOnInit(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    if (serverId) {
      const prefs = await this.qbService.getAppPreferences(serverId);
      this.stateService.setPreferences(prefs);
    }

    const results = await Promise.all(
      this.tabs.map((t) => t.loadComponent().then((c) => [t.id, c] as const)),
    );
    this.loadedComponents.set(
      new Map(results) as Map<QbSettingsTabId, Type<QbSettingsTabComponent>>,
    );
  }

  public selectTab(tabId: QbSettingsTabId): void {
    this.activeTabId.set(tabId);
  }

  public async canDeactivate(): Promise<boolean> {
    if (!this.stateService.isDirty()) return true;

    const confirmed = await this.confirmService.confirm(
      'components.modals.guard.unsaved-title',
      'components.modals.guard.unsaved-message',
      'components.modals.guard.btn-leave',
      'components.modals.guard.btn-stay',
    );

    if (confirmed) this.stateService.resetDirty();

    return confirmed;
  }

  public async onSave(): Promise<void> {
    await this.stateService.saveAll();
    const message = await firstValueFrom(
      this.translateService.get('pages.qb-settings.success.saved'),
    );
    this.toastService.success(message);
    this.activeModal.close();
  }
}
```

- [ ] **Step 4: Create the HTML template**

```html
<!-- packages/app/src/app/pages/qb-settings/qb-settings.html -->
<div class="modal-header bb-modal-header">
  <div class="bb-modal-header__text">
    <h5 class="modal-title bb-title-clamp">{{ 'pages.qb-settings.title' | translate }}</h5>

    <ul class="nav nav-tabs bb-modal-tabs">
      @for (tab of tabs; track tab.id) {
      <li class="nav-item">
        <button
          class="nav-link"
          [class.active]="activeTabId() === tab.id"
          (click)="selectTab(tab.id)"
        >
          {{ tab.label | translate }} @if (stateService.isDirtyMap()[tab.id]) {
          <fa-icon
            [icon]="icon.faPencil"
            class="ms-2"
            [ngbTooltip]="'components.modals.guard.unsaved-indicator' | translate"
          ></fa-icon>
          }
        </button>
      </li>
      }
    </ul>
  </div>

  <button
    type="button"
    class="btn-close"
    aria-label="Close"
    (click)="activeModal.dismiss()"
  ></button>
</div>

<div class="modal-body">
  @if (loadedComponents().size > 0) {
  <div class="bb-tab-panels">
    @for (tab of tabs; track tab.id) {
    <div class="bb-tab-panel" [class.bb-tab-panel--active]="activeTabId() === tab.id">
      <ng-container *ngComponentOutlet="loadedComponents().get(tab.id)!"></ng-container>
    </div>
    }
  </div>
  } @else {
  <app-bb-spinner></app-bb-spinner>
  }
</div>

<div class="modal-footer">
  <button
    type="button"
    class="btn btn-secondary"
    [disabled]="!stateService.isDirty()"
    (click)="onSave()"
  >
    {{ 'general.button.save' | translate }}
  </button>
  <button type="button" class="btn btn-link" (click)="activeModal.dismiss()" autofocus>
    {{ 'general.button.close' | translate }}
  </button>
</div>
```

- [ ] **Step 5: Create the SCSS file**

```scss
// packages/app/src/app/pages/qb-settings/qb-settings.scss
.bb-tab-panels {
  position: relative;
  min-height: 200px;
}

.bb-tab-panel {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  overflow: hidden;
  transition: opacity 0.2s ease;

  &--active {
    position: relative;
    overflow: visible;
    opacity: 1;
    pointer-events: auto;
  }
}
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
npm test
```

Expected: all `QbSettings` tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/pages/qb-settings/qb-settings.ts \
        packages/app/src/app/pages/qb-settings/qb-settings.html \
        packages/app/src/app/pages/qb-settings/qb-settings.scss \
        packages/app/src/app/pages/qb-settings/qb-settings.spec.ts
git commit -m "#86: add QbSettings modal shell with tab switching and canDeactivate guard"
```

---

## Task 5: Wire button bar and command handler

**Files:**

- Modify: `packages/app/src/app/pages/main/button-bar/button-bar.ts`
- Modify: `packages/app/src/app/services/ui-command-handler.service.ts`

- [ ] **Step 1: Add the toolbar entry**

In `packages/app/src/app/pages/main/button-bar/button-bar.ts`, add `faGears` to the icon imports:

```typescript
import {
  faArrowDown,
  faArrowUp,
  faArrowsDownToLine,
  faArrowsUpToLine,
  faFileArrowUp,
  faGear,
  faGears,
  faLink,
  faPause,
  faPlay,
  faPlayCircle,
  faSearch,
  faStopCircle,
  faTrashCan,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
```

Then in the `entries` computed, add the new entry immediately before `settings.open`:

```typescript
{ kind: 'divider' },
{
  kind: 'action',
  id: 'qb-settings.open',
  label: 'pages.main.button-bar.button.qb-settings',
  icon: faGears,
  variant: 'default',
},
{
  kind: 'action',
  id: 'settings.open',
  label: 'pages.main.button-bar.button.settings',
  icon: faGear,
  variant: 'default',
},
```

- [ ] **Step 2: Add the onClick case**

In the same file, add a case in the `onClick` switch before `'settings.open'`:

```typescript
case 'qb-settings.open':
  this.commandBusService.emit({ type: 'UI_OPEN_QB_SETTINGS' });
  break;
```

- [ ] **Step 3: Handle the command in `UiCommandHandlerService`**

In `packages/app/src/app/services/ui-command-handler.service.ts`, add the import:

```typescript
import { QbSettings } from '../pages/qb-settings/qb-settings';
```

Then add a case in the `switch` block (after `UI_OPEN_SETTINGS`):

```typescript
case 'UI_OPEN_QB_SETTINGS':
  if (this.isModalOpen(QbSettings)) break;
  let qbSettingsModalRef: NgbModalRef;
  qbSettingsModalRef = this.modalService.open(QbSettings, {
    size: 'xl',
    centered: false,
    scrollable: true,
    beforeDismiss: () => qbSettingsModalRef.componentInstance.canDeactivate(),
  });
  qbSettingsModalRef.result.then(() => {}).catch(() => {});
  break;
```

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/pages/main/button-bar/button-bar.ts \
        packages/app/src/app/services/ui-command-handler.service.ts
git commit -m "#86: wire UI_OPEN_QB_SETTINGS to button bar and command handler"
```

---

## Task 6: i18n translation keys

**Files:**

- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

- [ ] **Step 1: Add English keys to `us.json`**

Add the following block inside the `"pages"` object (after the `"settings"` entry):

```json
"qb-settings": {
  "title": "qBittorrent Settings",
  "success": {
    "saved": "qBittorrent Settings Saved"
  },
  "tab": {
    "bandwidth": {
      "title": "Bandwidth",
      "label": {
        "global-rate-limits": "Global Rate Limits",
        "alt-rate-limits": "Alternative Rate Limits (Turtle Mode)",
        "scheduler": "Speed Scheduler"
      },
      "field": {
        "dl-limit": "Download Limit (KB/s)",
        "up-limit": "Upload Limit (KB/s)",
        "alt-dl-limit": "Alternative Download Limit (KB/s)",
        "alt-up-limit": "Alternative Upload Limit (KB/s)",
        "scheduler-enabled": "Enable speed scheduler",
        "schedule-from": "From",
        "schedule-to": "To",
        "scheduler-days": "Active on"
      },
      "scheduler-days": {
        "every-day": "Every day",
        "every-weekday": "Every weekday",
        "every-weekend": "Every weekend",
        "monday": "Monday",
        "tuesday": "Tuesday",
        "wednesday": "Wednesday",
        "thursday": "Thursday",
        "friday": "Friday",
        "saturday": "Saturday",
        "sunday": "Sunday"
      }
    },
    "storage": {
      "title": "Storage",
      "label": {
        "default-paths": "Default Paths",
        "temp-files": "Temporary Files",
        "file-management": "File Management"
      },
      "field": {
        "save-path": "Default Save Path",
        "temp-path-enabled": "Keep incomplete torrents in a separate folder",
        "temp-path": "Incomplete Save Path",
        "incomplete-files-ext": "Append .!qB extension to incomplete files",
        "torrent-content-layout": "Torrent content layout"
      },
      "content-layout": {
        "original": "Original",
        "subfolder": "Create subfolder",
        "no-subfolder": "Don't create subfolder"
      }
    },
    "queue-limits": {
      "title": "Queue & Limits",
      "label": {
        "active-torrents": "Active Torrent Management",
        "download-behavior": "Download Behavior"
      },
      "field": {
        "queueing-enabled": "Enable torrent queuing constraints",
        "max-active-downloads": "Maximum active downloads",
        "max-active-uploads": "Maximum active uploads",
        "max-active-torrents": "Maximum total active torrents",
        "add-to-top-of-queue": "Add new torrents to the top of the queue"
      }
    },
    "seeding-ratios": {
      "title": "Seeding Ratios",
      "label": {
        "share-ratio": "Share Ratio Limits",
        "seeding-time": "Seeding Time Limits"
      },
      "field": {
        "max-ratio-enabled": "Enable Share Ratio Limit",
        "max-ratio": "Stop seeding when ratio reaches",
        "max-ratio-act": "Action when limit is reached",
        "max-seeding-time-enabled": "Enable Seeding Time Limit",
        "max-seeding-time": "Stop seeding after (minutes)"
      },
      "ratio-act": {
        "pause": "Pause torrent",
        "remove": "Remove torrent"
      }
    }
  }
}
```

Also add the button label inside `"pages"."main"."button-bar"."button"`:

```json
"qb-settings": "qBittorrent Settings"
```

- [ ] **Step 2: Add Hungarian keys to `hu.json`**

Add the following block inside the `"pages"` object in `hu.json` (after `"settings"`):

```json
"qb-settings": {
  "title": "qBittorrent Beállítások",
  "success": {
    "saved": "qBittorrent Beállítások Mentve"
  },
  "tab": {
    "bandwidth": {
      "title": "Sávszélesség",
      "label": {
        "global-rate-limits": "Globális Sebességkorlátok",
        "alt-rate-limits": "Alternatív Sebességkorlátok (Teknős Mód)",
        "scheduler": "Sebesség Ütemező"
      },
      "field": {
        "dl-limit": "Letöltési Korlát (KB/s)",
        "up-limit": "Feltöltési Korlát (KB/s)",
        "alt-dl-limit": "Alternatív Letöltési Korlát (KB/s)",
        "alt-up-limit": "Alternatív Feltöltési Korlát (KB/s)",
        "scheduler-enabled": "Sebesség ütemező engedélyezése",
        "schedule-from": "Tól",
        "schedule-to": "Ig",
        "scheduler-days": "Aktív ekkor"
      },
      "scheduler-days": {
        "every-day": "Minden nap",
        "every-weekday": "Minden hétköznap",
        "every-weekend": "Minden hétvégén",
        "monday": "Hétfő",
        "tuesday": "Kedd",
        "wednesday": "Szerda",
        "thursday": "Csütörtök",
        "friday": "Péntek",
        "saturday": "Szombat",
        "sunday": "Vasárnap"
      }
    },
    "storage": {
      "title": "Tárhely",
      "label": {
        "default-paths": "Alapértelmezett Útvonalak",
        "temp-files": "Ideiglenes Fájlok",
        "file-management": "Fájlkezelés"
      },
      "field": {
        "save-path": "Alapértelmezett Mentési Útvonal",
        "temp-path-enabled": "Befejezetlen torrentek külön mappában tartása",
        "temp-path": "Befejezetlen Fájlok Mentési Útvonala",
        "incomplete-files-ext": ".!qB kiterjesztés hozzáfűzése befejezetlen fájlokhoz",
        "torrent-content-layout": "Torrent tartalomszerkezet"
      },
      "content-layout": {
        "original": "Eredeti",
        "subfolder": "Almappa létrehozása",
        "no-subfolder": "Ne hozzon létre almappát"
      }
    },
    "queue-limits": {
      "title": "Sor és Korlátok",
      "label": {
        "active-torrents": "Aktív Torrent Kezelés",
        "download-behavior": "Letöltési Viselkedés"
      },
      "field": {
        "queueing-enabled": "Torrent sorba állítási korlátok engedélyezése",
        "max-active-downloads": "Maximális aktív letöltések",
        "max-active-uploads": "Maximális aktív feltöltések",
        "max-active-torrents": "Maximális összes aktív torrent",
        "add-to-top-of-queue": "Új torrentek hozzáadása a sor elejéhez"
      }
    },
    "seeding-ratios": {
      "title": "Terjesztési Arányok",
      "label": {
        "share-ratio": "Megosztási Arány Korlátok",
        "seeding-time": "Terjesztési Idő Korlátok"
      },
      "field": {
        "max-ratio-enabled": "Megosztási Arány Korlát Engedélyezése",
        "max-ratio": "Terjesztés leállítása, ha az arány eléri",
        "max-ratio-act": "Teendő korlát elérésekor",
        "max-seeding-time-enabled": "Terjesztési Idő Korlát Engedélyezése",
        "max-seeding-time": "Terjesztés leállítása ennyi perc után"
      },
      "ratio-act": {
        "pause": "Torrent szüneteltetése",
        "remove": "Torrent eltávolítása"
      }
    }
  }
}
```

Also add inside `"pages"."main"."button-bar"."button"` in `hu.json`:

```json
"qb-settings": "qBittorrent Beállítások"
```

- [ ] **Step 3: Run lint (Prettier checks JSON format)**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "#86: add i18n keys for qBittorrent settings modal (en + hu)"
```

---

## Task 7: Bandwidth tab

**Files:**

- Create: `packages/app/src/app/pages/qb-settings/bandwidth/bandwidth.ts`
- Create: `packages/app/src/app/pages/qb-settings/bandwidth/bandwidth.html`
- Create: `packages/app/src/app/pages/qb-settings/bandwidth/bandwidth.scss`
- Create: `packages/app/src/app/pages/qb-settings/bandwidth/bandwidth.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/app/src/app/pages/qb-settings/bandwidth/bandwidth.spec.ts
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { QbSettingsStateService } from '../qb-settings-state.service';
import { Bandwidth } from './bandwidth';

const MOCK_PREFS: any = {
  dl_limit: 5120000,
  up_limit: 1024000,
  alt_dl_limit: 102400,
  alt_up_limit: 51200,
  scheduler_enabled: true,
  schedule_from_hour: 8,
  schedule_from_min: 0,
  schedule_to_hour: 20,
  schedule_to_min: 30,
  scheduler_days: 1,
};

describe('Bandwidth', () => {
  let component: Bandwidth;
  let fixture: ComponentFixture<Bandwidth>;
  let stateServiceMock: {
    preferences: ReturnType<typeof signal<any>>;
    registerSave: ReturnType<typeof vi.fn>;
    markDirty: ReturnType<typeof vi.fn>;
  };
  let qbMock: { setAppPreferences: ReturnType<typeof vi.fn> };
  let serverStoreMock: { currentServerId: ReturnType<typeof signal<string>> };

  beforeEach(async () => {
    stateServiceMock = {
      preferences: signal(MOCK_PREFS),
      registerSave: vi.fn(),
      markDirty: vi.fn(),
    };
    qbMock = { setAppPreferences: vi.fn().mockResolvedValue(undefined) };
    serverStoreMock = { currentServerId: signal('server-1') };

    await TestBed.configureTestingModule({
      imports: [Bandwidth],
      providers: [
        { provide: QbSettingsStateService, useValue: stateServiceMock },
        { provide: QbService, useValue: qbMock },
        { provide: ServerStoreService, useValue: serverStoreMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(Bandwidth);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should register a save function on init', () => {
    expect(stateServiceMock.registerSave).toHaveBeenCalledWith('bandwidth', expect.any(Function));
  });

  it('should patch form from preferences on init (converting bytes to KB/s)', () => {
    // dl_limit: 5120000 bytes → 5000 KB/s
    expect(component.form.getRawValue().dl_limit).toBe(5000);
    expect(component.form.getRawValue().up_limit).toBe(1000);
    expect(component.form.getRawValue().alt_dl_limit).toBe(100);
    expect(component.form.getRawValue().alt_up_limit).toBe(50);
  });

  it('should patch scheduler fields from preferences', () => {
    const v = component.form.getRawValue();
    expect(v.scheduler_enabled).toBe(true);
    expect(v.schedule_from_hour).toBe(8);
    expect(v.schedule_from_min).toBe(0);
    expect(v.schedule_to_hour).toBe(20);
    expect(v.schedule_to_min).toBe(30);
    expect(v.scheduler_days).toBe(1);
  });

  it('should mark dirty when form value changes', () => {
    component.form.controls.dl_limit.setValue(9999);
    expect(stateServiceMock.markDirty).toHaveBeenCalledWith('bandwidth', true);
  });

  it('should expose hasScheduler as true when scheduler_enabled is in prefs', () => {
    expect(component.hasScheduler()).toBe(true);
  });

  it('should expose hasScheduler as false when scheduler_enabled is not in prefs', () => {
    stateServiceMock.preferences.set({ dl_limit: 0 });
    expect(component.hasScheduler()).toBe(false);
  });

  it('should disable scheduler sub-fields when scheduler_enabled is false', () => {
    component.form.controls.scheduler_enabled.setValue(false);
    expect(component.form.controls.schedule_from_hour.disabled).toBe(true);
    expect(component.form.controls.schedule_to_hour.disabled).toBe(true);
    expect(component.form.controls.scheduler_days.disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm test
```

Expected: fails — `Bandwidth` does not exist yet.

- [ ] **Step 3: Implement the Bandwidth component TypeScript**

```typescript
// packages/app/src/app/pages/qb-settings/bandwidth/bandwidth.ts
import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgSelectComponent } from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SpeedLimitPipe } from '../../../pipes/speed-limit-pipe';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { QbSettingsStateService } from '../qb-settings-state.service';
import { QbSettingsTabComponent } from '../qb-settings.interface';

interface SchedulerDayOption {
  value: number;
  label: string;
}

@Component({
  selector: 'app-qb-settings-bandwidth',
  imports: [CommonModule, ReactiveFormsModule, NgSelectComponent, TranslatePipe, SpeedLimitPipe],
  templateUrl: './bandwidth.html',
  styleUrl: './bandwidth.scss',
})
export class Bandwidth implements QbSettingsTabComponent, OnInit {
  private readonly stateService = inject(QbSettingsStateService);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translateService = inject(TranslateService);

  public readonly hasScheduler = computed(
    () => 'scheduler_enabled' in (this.stateService.preferences() ?? {}),
  );

  public readonly schedulerDays = computed<SchedulerDayOption[]>(() => [
    {
      value: 0,
      label: this.translateService.instant(
        'pages.qb-settings.tab.bandwidth.scheduler-days.every-day',
      ),
    },
    {
      value: 1,
      label: this.translateService.instant(
        'pages.qb-settings.tab.bandwidth.scheduler-days.every-weekday',
      ),
    },
    {
      value: 2,
      label: this.translateService.instant(
        'pages.qb-settings.tab.bandwidth.scheduler-days.every-weekend',
      ),
    },
    {
      value: 3,
      label: this.translateService.instant('pages.qb-settings.tab.bandwidth.scheduler-days.monday'),
    },
    {
      value: 4,
      label: this.translateService.instant(
        'pages.qb-settings.tab.bandwidth.scheduler-days.tuesday',
      ),
    },
    {
      value: 5,
      label: this.translateService.instant(
        'pages.qb-settings.tab.bandwidth.scheduler-days.wednesday',
      ),
    },
    {
      value: 6,
      label: this.translateService.instant(
        'pages.qb-settings.tab.bandwidth.scheduler-days.thursday',
      ),
    },
    {
      value: 7,
      label: this.translateService.instant('pages.qb-settings.tab.bandwidth.scheduler-days.friday'),
    },
    {
      value: 8,
      label: this.translateService.instant(
        'pages.qb-settings.tab.bandwidth.scheduler-days.saturday',
      ),
    },
    {
      value: 9,
      label: this.translateService.instant('pages.qb-settings.tab.bandwidth.scheduler-days.sunday'),
    },
  ]);

  public readonly hours = Array.from({ length: 24 }, (_, i) => i);
  public readonly minutes = Array.from({ length: 60 }, (_, i) => i);

  public form = new FormGroup({
    dl_limit: new FormControl<number>(0, { nonNullable: true }),
    up_limit: new FormControl<number>(0, { nonNullable: true }),
    alt_dl_limit: new FormControl<number>(0, { nonNullable: true }),
    alt_up_limit: new FormControl<number>(0, { nonNullable: true }),
    scheduler_enabled: new FormControl<boolean>(false, { nonNullable: true }),
    schedule_from_hour: new FormControl<number>(0, { nonNullable: true }),
    schedule_from_min: new FormControl<number>(0, { nonNullable: true }),
    schedule_to_hour: new FormControl<number>(0, { nonNullable: true }),
    schedule_to_min: new FormControl<number>(0, { nonNullable: true }),
    scheduler_days: new FormControl<number>(0, { nonNullable: true }),
  });

  public ngOnInit(): void {
    const prefs = this.stateService.preferences();
    if (prefs) {
      this.form.patchValue(
        {
          dl_limit: Math.round(prefs.dl_limit / 1024),
          up_limit: Math.round(prefs.up_limit / 1024),
          alt_dl_limit: Math.round(prefs.alt_dl_limit / 1024),
          alt_up_limit: Math.round(prefs.alt_up_limit / 1024),
          scheduler_enabled: prefs.scheduler_enabled,
          schedule_from_hour: prefs.schedule_from_hour,
          schedule_from_min: prefs.schedule_from_min,
          schedule_to_hour: prefs.schedule_to_hour,
          schedule_to_min: prefs.schedule_to_min,
          scheduler_days: prefs.scheduler_days,
        },
        { emitEvent: false },
      );
      this.updateSchedulerState(prefs.scheduler_enabled);
    }

    this.stateService.registerSave('bandwidth', () => this.save());

    this.form.controls.scheduler_enabled.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((enabled) => this.updateSchedulerState(enabled));

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.stateService.markDirty('bandwidth', true));
  }

  private updateSchedulerState(enabled: boolean): void {
    const subControls = [
      this.form.controls.schedule_from_hour,
      this.form.controls.schedule_from_min,
      this.form.controls.schedule_to_hour,
      this.form.controls.schedule_to_min,
      this.form.controls.scheduler_days,
    ];
    subControls.forEach((c) =>
      enabled ? c.enable({ emitEvent: false }) : c.disable({ emitEvent: false }),
    );
  }

  private async save(): Promise<void> {
    const v = this.form.getRawValue();
    await this.qbService.setAppPreferences(this.serverStoreService.currentServerId()!, {
      dl_limit: v.dl_limit * 1024,
      up_limit: v.up_limit * 1024,
      alt_dl_limit: v.alt_dl_limit * 1024,
      alt_up_limit: v.alt_up_limit * 1024,
      scheduler_enabled: v.scheduler_enabled,
      schedule_from_hour: v.schedule_from_hour,
      schedule_from_min: v.schedule_from_min,
      schedule_to_hour: v.schedule_to_hour,
      schedule_to_min: v.schedule_to_min,
      scheduler_days: v.scheduler_days,
    });
  }
}
```

- [ ] **Step 4: Create the HTML template**

```html
<!-- packages/app/src/app/pages/qb-settings/bandwidth/bandwidth.html -->
<form [formGroup]="form">
  <div class="container-fluid">
    <fieldset class="bb-fieldset">
      <legend>{{ 'pages.qb-settings.tab.bandwidth.label.global-rate-limits' | translate }}</legend>
      <div class="container">
        <div class="row mb-3">
          <div class="col-6 d-flex align-items-center">
            {{ 'pages.qb-settings.tab.bandwidth.field.dl-limit' | translate }}
          </div>
          <div class="col-6">
            <input type="number" class="form-control" formControlName="dl_limit" min="0" />
            <div class="form-text">
              @if (form.controls.dl_limit.value) { {{ form.controls.dl_limit.value * 1024 |
              speedLimit }} } @else { {{ 'general.limit.no-limit' | translate }} }
            </div>
          </div>
        </div>
        <div class="row mb-3">
          <div class="col-6 d-flex align-items-center">
            {{ 'pages.qb-settings.tab.bandwidth.field.up-limit' | translate }}
          </div>
          <div class="col-6">
            <input type="number" class="form-control" formControlName="up_limit" min="0" />
            <div class="form-text">
              @if (form.controls.up_limit.value) { {{ form.controls.up_limit.value * 1024 |
              speedLimit }} } @else { {{ 'general.limit.no-limit' | translate }} }
            </div>
          </div>
        </div>
      </div>
    </fieldset>

    <fieldset class="bb-fieldset">
      <legend>{{ 'pages.qb-settings.tab.bandwidth.label.alt-rate-limits' | translate }}</legend>
      <div class="container">
        <div class="row mb-3">
          <div class="col-6 d-flex align-items-center">
            {{ 'pages.qb-settings.tab.bandwidth.field.alt-dl-limit' | translate }}
          </div>
          <div class="col-6">
            <input type="number" class="form-control" formControlName="alt_dl_limit" min="0" />
            <div class="form-text">
              @if (form.controls.alt_dl_limit.value) { {{ form.controls.alt_dl_limit.value * 1024 |
              speedLimit }} } @else { {{ 'general.limit.no-limit' | translate }} }
            </div>
          </div>
        </div>
        <div class="row mb-3">
          <div class="col-6 d-flex align-items-center">
            {{ 'pages.qb-settings.tab.bandwidth.field.alt-up-limit' | translate }}
          </div>
          <div class="col-6">
            <input type="number" class="form-control" formControlName="alt_up_limit" min="0" />
            <div class="form-text">
              @if (form.controls.alt_up_limit.value) { {{ form.controls.alt_up_limit.value * 1024 |
              speedLimit }} } @else { {{ 'general.limit.no-limit' | translate }} }
            </div>
          </div>
        </div>
      </div>
    </fieldset>

    @if (hasScheduler()) {
    <fieldset class="bb-fieldset">
      <legend>{{ 'pages.qb-settings.tab.bandwidth.label.scheduler' | translate }}</legend>
      <div class="container">
        <div class="row mb-3">
          <div class="col-12">
            <div class="form-check form-switch">
              <input
                class="form-check-input"
                type="checkbox"
                role="switch"
                id="scheduler-enabled"
                formControlName="scheduler_enabled"
              />
              <label class="form-check-label" for="scheduler-enabled">
                {{ 'pages.qb-settings.tab.bandwidth.field.scheduler-enabled' | translate }}
              </label>
            </div>
          </div>
        </div>
        <div class="row mb-3">
          <div class="col-6 d-flex align-items-center">
            {{ 'pages.qb-settings.tab.bandwidth.field.schedule-from' | translate }}
          </div>
          <div class="col-6 d-flex gap-2">
            <select class="form-select" formControlName="schedule_from_hour">
              @for (h of hours; track h) {
              <option [value]="h">{{ h | number: '2.0-0' }}</option>
              }
            </select>
            <select class="form-select" formControlName="schedule_from_min">
              @for (m of minutes; track m) {
              <option [value]="m">{{ m | number: '2.0-0' }}</option>
              }
            </select>
          </div>
        </div>
        <div class="row mb-3">
          <div class="col-6 d-flex align-items-center">
            {{ 'pages.qb-settings.tab.bandwidth.field.schedule-to' | translate }}
          </div>
          <div class="col-6 d-flex gap-2">
            <select class="form-select" formControlName="schedule_to_hour">
              @for (h of hours; track h) {
              <option [value]="h">{{ h | number: '2.0-0' }}</option>
              }
            </select>
            <select class="form-select" formControlName="schedule_to_min">
              @for (m of minutes; track m) {
              <option [value]="m">{{ m | number: '2.0-0' }}</option>
              }
            </select>
          </div>
        </div>
        <div class="row mb-3">
          <div class="col-6 d-flex align-items-center">
            {{ 'pages.qb-settings.tab.bandwidth.field.scheduler-days' | translate }}
          </div>
          <div class="col-6">
            <ng-select
              [items]="schedulerDays()"
              [clearable]="false"
              [searchable]="false"
              bindLabel="label"
              bindValue="value"
              formControlName="scheduler_days"
              appendTo="ngb-modal-window"
            ></ng-select>
          </div>
        </div>
      </div>
    </fieldset>
    }
  </div>
</form>
```

- [ ] **Step 5: Create the SCSS file**

```scss
// packages/app/src/app/pages/qb-settings/bandwidth/bandwidth.scss
```

(Empty — no component-specific styles needed.)

- [ ] **Step 6: Run tests to confirm they pass**

```bash
npm test
```

Expected: all `Bandwidth` tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/pages/qb-settings/bandwidth/
git commit -m "#86: add Bandwidth tab for qBittorrent settings"
```

---

## Task 8: Storage tab

**Files:**

- Create: `packages/app/src/app/pages/qb-settings/storage/storage.ts`
- Create: `packages/app/src/app/pages/qb-settings/storage/storage.html`
- Create: `packages/app/src/app/pages/qb-settings/storage/storage.scss`
- Create: `packages/app/src/app/pages/qb-settings/storage/storage.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/app/src/app/pages/qb-settings/storage/storage.spec.ts
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { QbSettingsStateService } from '../qb-settings-state.service';
import { Storage } from './storage';

const MOCK_PREFS: any = {
  save_path: '/mnt/storage',
  temp_path_enabled: true,
  temp_path: '/mnt/tmp',
  incomplete_files_ext: true,
  torrent_content_layout: 'Subfolder',
};

describe('Storage', () => {
  let component: Storage;
  let fixture: ComponentFixture<Storage>;
  let stateServiceMock: {
    preferences: ReturnType<typeof signal<any>>;
    registerSave: ReturnType<typeof vi.fn>;
    markDirty: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    stateServiceMock = {
      preferences: signal(MOCK_PREFS),
      registerSave: vi.fn(),
      markDirty: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Storage],
      providers: [
        { provide: QbSettingsStateService, useValue: stateServiceMock },
        {
          provide: QbService,
          useValue: { setAppPreferences: vi.fn().mockResolvedValue(undefined) },
        },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(Storage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should register a save function on init', () => {
    expect(stateServiceMock.registerSave).toHaveBeenCalledWith('storage', expect.any(Function));
  });

  it('should patch form from preferences on init', () => {
    const v = component.form.getRawValue();
    expect(v.save_path).toBe('/mnt/storage');
    expect(v.temp_path_enabled).toBe(true);
    expect(v.temp_path).toBe('/mnt/tmp');
    expect(v.incomplete_files_ext).toBe(true);
    expect(v.torrent_content_layout).toBe('Subfolder');
  });

  it('should mark dirty when form value changes', () => {
    component.form.controls.save_path.setValue('/new/path');
    expect(stateServiceMock.markDirty).toHaveBeenCalledWith('storage', true);
  });

  it('should disable temp_path when temp_path_enabled is false', () => {
    component.form.controls.temp_path_enabled.setValue(false);
    expect(component.form.controls.temp_path.disabled).toBe(true);
  });

  it('should enable temp_path when temp_path_enabled is true', () => {
    component.form.controls.temp_path_enabled.setValue(false);
    component.form.controls.temp_path_enabled.setValue(true);
    expect(component.form.controls.temp_path.enabled).toBe(true);
  });

  it('should expose hasTempPath as true when temp_path_enabled is in prefs', () => {
    expect(component.hasTempPath()).toBe(true);
  });

  it('should expose hasContentLayout as true when torrent_content_layout is in prefs', () => {
    expect(component.hasContentLayout()).toBe(true);
  });

  it('should expose hasContentLayout as false when torrent_content_layout is not in prefs', () => {
    stateServiceMock.preferences.set({ save_path: '/tmp' });
    expect(component.hasContentLayout()).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm test
```

Expected: fails — `Storage` does not exist yet.

- [ ] **Step 3: Implement the Storage component TypeScript**

```typescript
// packages/app/src/app/pages/qb-settings/storage/storage.ts
import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgSelectComponent } from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { QbSettingsStateService } from '../qb-settings-state.service';
import { QbSettingsTabComponent } from '../qb-settings.interface';

interface ContentLayoutOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-qb-settings-storage',
  imports: [CommonModule, ReactiveFormsModule, NgSelectComponent, TranslatePipe],
  templateUrl: './storage.html',
  styleUrl: './storage.scss',
})
export class Storage implements QbSettingsTabComponent, OnInit {
  private readonly stateService = inject(QbSettingsStateService);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translateService = inject(TranslateService);

  public readonly hasTempPath = computed(
    () => 'temp_path_enabled' in (this.stateService.preferences() ?? {}),
  );

  public readonly hasContentLayout = computed(
    () => 'torrent_content_layout' in (this.stateService.preferences() ?? {}),
  );

  public readonly contentLayouts = computed<ContentLayoutOption[]>(() => [
    {
      value: 'Original',
      label: this.translateService.instant('pages.qb-settings.tab.storage.content-layout.original'),
    },
    {
      value: 'Subfolder',
      label: this.translateService.instant(
        'pages.qb-settings.tab.storage.content-layout.subfolder',
      ),
    },
    {
      value: 'NoSubfolder',
      label: this.translateService.instant(
        'pages.qb-settings.tab.storage.content-layout.no-subfolder',
      ),
    },
  ]);

  public form = new FormGroup({
    save_path: new FormControl<string>('', { nonNullable: true }),
    temp_path_enabled: new FormControl<boolean>(false, { nonNullable: true }),
    temp_path: new FormControl<string>('', { nonNullable: true }),
    incomplete_files_ext: new FormControl<boolean>(false, { nonNullable: true }),
    torrent_content_layout: new FormControl<string>('Original', { nonNullable: true }),
  });

  public ngOnInit(): void {
    const prefs = this.stateService.preferences();
    if (prefs) {
      this.form.patchValue(
        {
          save_path: prefs.save_path,
          temp_path_enabled: prefs.temp_path_enabled,
          temp_path: prefs.temp_path,
          incomplete_files_ext: prefs.incomplete_files_ext,
          torrent_content_layout: prefs.torrent_content_layout,
        },
        { emitEvent: false },
      );
      this.updateTempPathState(prefs.temp_path_enabled);
    }

    this.stateService.registerSave('storage', () => this.save());

    this.form.controls.temp_path_enabled.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((enabled) => this.updateTempPathState(enabled));

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.stateService.markDirty('storage', true));
  }

  private updateTempPathState(enabled: boolean): void {
    enabled
      ? this.form.controls.temp_path.enable({ emitEvent: false })
      : this.form.controls.temp_path.disable({ emitEvent: false });
  }

  private async save(): Promise<void> {
    const v = this.form.getRawValue();
    await this.qbService.setAppPreferences(this.serverStoreService.currentServerId()!, {
      save_path: v.save_path,
      temp_path_enabled: v.temp_path_enabled,
      temp_path: v.temp_path,
      incomplete_files_ext: v.incomplete_files_ext,
      torrent_content_layout: v.torrent_content_layout,
    });
  }
}
```

- [ ] **Step 4: Create the HTML template**

```html
<!-- packages/app/src/app/pages/qb-settings/storage/storage.html -->
<form [formGroup]="form">
  <div class="container-fluid">
    <fieldset class="bb-fieldset">
      <legend>{{ 'pages.qb-settings.tab.storage.label.default-paths' | translate }}</legend>
      <div class="container">
        <div class="row mb-3">
          <div class="col-4 d-flex align-items-center">
            {{ 'pages.qb-settings.tab.storage.field.save-path' | translate }}
          </div>
          <div class="col-8">
            <input type="text" class="form-control" formControlName="save_path" />
          </div>
        </div>
      </div>
    </fieldset>

    @if (hasTempPath()) {
    <fieldset class="bb-fieldset">
      <legend>{{ 'pages.qb-settings.tab.storage.label.temp-files' | translate }}</legend>
      <div class="container">
        <div class="row mb-3">
          <div class="col-12">
            <div class="form-check form-switch">
              <input
                class="form-check-input"
                type="checkbox"
                role="switch"
                id="temp-path-enabled"
                formControlName="temp_path_enabled"
              />
              <label class="form-check-label" for="temp-path-enabled">
                {{ 'pages.qb-settings.tab.storage.field.temp-path-enabled' | translate }}
              </label>
            </div>
          </div>
        </div>
        <div class="row mb-3">
          <div class="col-4 d-flex align-items-center">
            {{ 'pages.qb-settings.tab.storage.field.temp-path' | translate }}
          </div>
          <div class="col-8">
            <input type="text" class="form-control" formControlName="temp_path" />
          </div>
        </div>
      </div>
    </fieldset>
    }

    <fieldset class="bb-fieldset">
      <legend>{{ 'pages.qb-settings.tab.storage.label.file-management' | translate }}</legend>
      <div class="container">
        <div class="row mb-3">
          <div class="col-12">
            <div class="form-check form-switch">
              <input
                class="form-check-input"
                type="checkbox"
                role="switch"
                id="incomplete-files-ext"
                formControlName="incomplete_files_ext"
              />
              <label class="form-check-label" for="incomplete-files-ext">
                {{ 'pages.qb-settings.tab.storage.field.incomplete-files-ext' | translate }}
              </label>
            </div>
          </div>
        </div>
        @if (hasContentLayout()) {
        <div class="row mb-3">
          <div class="col-6 d-flex align-items-center">
            {{ 'pages.qb-settings.tab.storage.field.torrent-content-layout' | translate }}
          </div>
          <div class="col-6">
            <ng-select
              [items]="contentLayouts()"
              [clearable]="false"
              [searchable]="false"
              bindLabel="label"
              bindValue="value"
              formControlName="torrent_content_layout"
              appendTo="ngb-modal-window"
            ></ng-select>
          </div>
        </div>
        }
      </div>
    </fieldset>
  </div>
</form>
```

- [ ] **Step 5: Create the SCSS file**

```scss
// packages/app/src/app/pages/qb-settings/storage/storage.scss
```

(Empty — no component-specific styles needed.)

- [ ] **Step 6: Run tests to confirm they pass**

```bash
npm test
```

Expected: all `Storage` tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/pages/qb-settings/storage/
git commit -m "#86: add Storage tab for qBittorrent settings"
```

---

## Task 9: Queue & Limits tab

**Files:**

- Create: `packages/app/src/app/pages/qb-settings/queue-limits/queue-limits.ts`
- Create: `packages/app/src/app/pages/qb-settings/queue-limits/queue-limits.html`
- Create: `packages/app/src/app/pages/qb-settings/queue-limits/queue-limits.scss`
- Create: `packages/app/src/app/pages/qb-settings/queue-limits/queue-limits.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/app/src/app/pages/qb-settings/queue-limits/queue-limits.spec.ts
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { QbSettingsStateService } from '../qb-settings-state.service';
import { QueueLimits } from './queue-limits';

const MOCK_PREFS: any = {
  queueing_enabled: true,
  max_active_downloads: 5,
  max_active_uploads: 10,
  max_active_torrents: 20,
  add_to_top_of_queue: false,
};

describe('QueueLimits', () => {
  let component: QueueLimits;
  let fixture: ComponentFixture<QueueLimits>;
  let stateServiceMock: {
    preferences: ReturnType<typeof signal<any>>;
    registerSave: ReturnType<typeof vi.fn>;
    markDirty: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    stateServiceMock = {
      preferences: signal(MOCK_PREFS),
      registerSave: vi.fn(),
      markDirty: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [QueueLimits],
      providers: [
        { provide: QbSettingsStateService, useValue: stateServiceMock },
        {
          provide: QbService,
          useValue: { setAppPreferences: vi.fn().mockResolvedValue(undefined) },
        },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(QueueLimits);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should register a save function on init', () => {
    expect(stateServiceMock.registerSave).toHaveBeenCalledWith(
      'queue-limits',
      expect.any(Function),
    );
  });

  it('should patch form from preferences on init', () => {
    const v = component.form.getRawValue();
    expect(v.queueing_enabled).toBe(true);
    expect(v.max_active_downloads).toBe(5);
    expect(v.max_active_uploads).toBe(10);
    expect(v.max_active_torrents).toBe(20);
    expect(v.add_to_top_of_queue).toBe(false);
  });

  it('should mark dirty when form value changes', () => {
    component.form.controls.max_active_downloads.setValue(3);
    expect(stateServiceMock.markDirty).toHaveBeenCalledWith('queue-limits', true);
  });

  it('should disable active-count fields when queueing_enabled is false', () => {
    component.form.controls.queueing_enabled.setValue(false);
    expect(component.form.controls.max_active_downloads.disabled).toBe(true);
    expect(component.form.controls.max_active_uploads.disabled).toBe(true);
    expect(component.form.controls.max_active_torrents.disabled).toBe(true);
  });

  it('should expose hasAddToTop as true when add_to_top_of_queue is in prefs', () => {
    expect(component.hasAddToTop()).toBe(true);
  });

  it('should expose hasAddToTop as false when add_to_top_of_queue is not in prefs', () => {
    stateServiceMock.preferences.set({ queueing_enabled: false });
    expect(component.hasAddToTop()).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm test
```

Expected: fails — `QueueLimits` does not exist yet.

- [ ] **Step 3: Implement the QueueLimits component TypeScript**

```typescript
// packages/app/src/app/pages/qb-settings/queue-limits/queue-limits.ts
import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { QbSettingsStateService } from '../qb-settings-state.service';
import { QbSettingsTabComponent } from '../qb-settings.interface';

@Component({
  selector: 'app-qb-settings-queue-limits',
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './queue-limits.html',
  styleUrl: './queue-limits.scss',
})
export class QueueLimits implements QbSettingsTabComponent, OnInit {
  private readonly stateService = inject(QbSettingsStateService);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly destroyRef = inject(DestroyRef);

  public readonly hasAddToTop = computed(
    () => 'add_to_top_of_queue' in (this.stateService.preferences() ?? {}),
  );

  public form = new FormGroup({
    queueing_enabled: new FormControl<boolean>(false, { nonNullable: true }),
    max_active_downloads: new FormControl<number>(5, { nonNullable: true }),
    max_active_uploads: new FormControl<number>(5, { nonNullable: true }),
    max_active_torrents: new FormControl<number>(10, { nonNullable: true }),
    add_to_top_of_queue: new FormControl<boolean>(false, { nonNullable: true }),
  });

  public ngOnInit(): void {
    const prefs = this.stateService.preferences();
    if (prefs) {
      this.form.patchValue(
        {
          queueing_enabled: prefs.queueing_enabled,
          max_active_downloads: prefs.max_active_downloads,
          max_active_uploads: prefs.max_active_uploads,
          max_active_torrents: prefs.max_active_torrents,
          add_to_top_of_queue: prefs.add_to_top_of_queue,
        },
        { emitEvent: false },
      );
      this.updateQueueingState(prefs.queueing_enabled);
    }

    this.stateService.registerSave('queue-limits', () => this.save());

    this.form.controls.queueing_enabled.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((enabled) => this.updateQueueingState(enabled));

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.stateService.markDirty('queue-limits', true));
  }

  private updateQueueingState(enabled: boolean): void {
    const subControls = [
      this.form.controls.max_active_downloads,
      this.form.controls.max_active_uploads,
      this.form.controls.max_active_torrents,
    ];
    subControls.forEach((c) =>
      enabled ? c.enable({ emitEvent: false }) : c.disable({ emitEvent: false }),
    );
  }

  private async save(): Promise<void> {
    const v = this.form.getRawValue();
    await this.qbService.setAppPreferences(this.serverStoreService.currentServerId()!, {
      queueing_enabled: v.queueing_enabled,
      max_active_downloads: v.max_active_downloads,
      max_active_uploads: v.max_active_uploads,
      max_active_torrents: v.max_active_torrents,
      add_to_top_of_queue: v.add_to_top_of_queue,
    });
  }
}
```

- [ ] **Step 4: Create the HTML template**

```html
<!-- packages/app/src/app/pages/qb-settings/queue-limits/queue-limits.html -->
<form [formGroup]="form">
  <div class="container-fluid">
    <fieldset class="bb-fieldset">
      <legend>{{ 'pages.qb-settings.tab.queue-limits.label.active-torrents' | translate }}</legend>
      <div class="container">
        <div class="row mb-3">
          <div class="col-12">
            <div class="form-check form-switch">
              <input
                class="form-check-input"
                type="checkbox"
                role="switch"
                id="queueing-enabled"
                formControlName="queueing_enabled"
              />
              <label class="form-check-label" for="queueing-enabled">
                {{ 'pages.qb-settings.tab.queue-limits.field.queueing-enabled' | translate }}
              </label>
            </div>
          </div>
        </div>
        <div class="row mb-3">
          <div class="col-6 d-flex align-items-center">
            {{ 'pages.qb-settings.tab.queue-limits.field.max-active-downloads' | translate }}
          </div>
          <div class="col-6">
            <input
              type="number"
              class="form-control"
              formControlName="max_active_downloads"
              min="0"
            />
          </div>
        </div>
        <div class="row mb-3">
          <div class="col-6 d-flex align-items-center">
            {{ 'pages.qb-settings.tab.queue-limits.field.max-active-uploads' | translate }}
          </div>
          <div class="col-6">
            <input
              type="number"
              class="form-control"
              formControlName="max_active_uploads"
              min="0"
            />
          </div>
        </div>
        <div class="row mb-3">
          <div class="col-6 d-flex align-items-center">
            {{ 'pages.qb-settings.tab.queue-limits.field.max-active-torrents' | translate }}
          </div>
          <div class="col-6">
            <input
              type="number"
              class="form-control"
              formControlName="max_active_torrents"
              min="0"
            />
          </div>
        </div>
      </div>
    </fieldset>

    @if (hasAddToTop()) {
    <fieldset class="bb-fieldset">
      <legend>
        {{ 'pages.qb-settings.tab.queue-limits.label.download-behavior' | translate }}
      </legend>
      <div class="container">
        <div class="row mb-3">
          <div class="col-12">
            <div class="form-check form-switch">
              <input
                class="form-check-input"
                type="checkbox"
                role="switch"
                id="add-to-top-of-queue"
                formControlName="add_to_top_of_queue"
              />
              <label class="form-check-label" for="add-to-top-of-queue">
                {{ 'pages.qb-settings.tab.queue-limits.field.add-to-top-of-queue' | translate }}
              </label>
            </div>
          </div>
        </div>
      </div>
    </fieldset>
    }
  </div>
</form>
```

- [ ] **Step 5: Create the SCSS file**

```scss
// packages/app/src/app/pages/qb-settings/queue-limits/queue-limits.scss
```

(Empty — no component-specific styles needed.)

- [ ] **Step 6: Run tests to confirm they pass**

```bash
npm test
```

Expected: all `QueueLimits` tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/pages/qb-settings/queue-limits/
git commit -m "#86: add Queue and Limits tab for qBittorrent settings"
```

---

## Task 10: Seeding Ratios tab

**Files:**

- Create: `packages/app/src/app/pages/qb-settings/seeding-ratios/seeding-ratios.ts`
- Create: `packages/app/src/app/pages/qb-settings/seeding-ratios/seeding-ratios.html`
- Create: `packages/app/src/app/pages/qb-settings/seeding-ratios/seeding-ratios.scss`
- Create: `packages/app/src/app/pages/qb-settings/seeding-ratios/seeding-ratios.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/app/src/app/pages/qb-settings/seeding-ratios/seeding-ratios.spec.ts
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { QbSettingsStateService } from '../qb-settings-state.service';
import { SeedingRatios } from './seeding-ratios';

const MOCK_PREFS: any = {
  max_ratio_enabled: true,
  max_ratio: 2.0,
  max_ratio_act: 0,
  max_seeding_time_enabled: true,
  max_seeding_time: 1440,
};

describe('SeedingRatios', () => {
  let component: SeedingRatios;
  let fixture: ComponentFixture<SeedingRatios>;
  let stateServiceMock: {
    preferences: ReturnType<typeof signal<any>>;
    registerSave: ReturnType<typeof vi.fn>;
    markDirty: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    stateServiceMock = {
      preferences: signal(MOCK_PREFS),
      registerSave: vi.fn(),
      markDirty: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [SeedingRatios],
      providers: [
        { provide: QbSettingsStateService, useValue: stateServiceMock },
        {
          provide: QbService,
          useValue: { setAppPreferences: vi.fn().mockResolvedValue(undefined) },
        },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SeedingRatios);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should register a save function on init', () => {
    expect(stateServiceMock.registerSave).toHaveBeenCalledWith(
      'seeding-ratios',
      expect.any(Function),
    );
  });

  it('should patch form from preferences on init', () => {
    const v = component.form.getRawValue();
    expect(v.max_ratio_enabled).toBe(true);
    expect(v.max_ratio).toBe(2.0);
    expect(v.max_ratio_act).toBe(0);
    expect(v.max_seeding_time_enabled).toBe(true);
    expect(v.max_seeding_time).toBe(1440);
  });

  it('should mark dirty when form value changes', () => {
    component.form.controls.max_ratio.setValue(3.5);
    expect(stateServiceMock.markDirty).toHaveBeenCalledWith('seeding-ratios', true);
  });

  it('should disable max_ratio and max_ratio_act when max_ratio_enabled is false', () => {
    component.form.controls.max_ratio_enabled.setValue(false);
    expect(component.form.controls.max_ratio.disabled).toBe(true);
    expect(component.form.controls.max_ratio_act.disabled).toBe(true);
  });

  it('should disable max_seeding_time when max_seeding_time_enabled is false', () => {
    component.form.controls.max_seeding_time_enabled.setValue(false);
    expect(component.form.controls.max_seeding_time.disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm test
```

Expected: fails — `SeedingRatios` does not exist yet.

- [ ] **Step 3: Implement the SeedingRatios component TypeScript**

```typescript
// packages/app/src/app/pages/qb-settings/seeding-ratios/seeding-ratios.ts
import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgSelectComponent } from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { QbSettingsStateService } from '../qb-settings-state.service';
import { QbSettingsTabComponent } from '../qb-settings.interface';

interface RatioActOption {
  value: number;
  label: string;
}

@Component({
  selector: 'app-qb-settings-seeding-ratios',
  imports: [CommonModule, ReactiveFormsModule, NgSelectComponent, TranslatePipe],
  templateUrl: './seeding-ratios.html',
  styleUrl: './seeding-ratios.scss',
})
export class SeedingRatios implements QbSettingsTabComponent, OnInit {
  private readonly stateService = inject(QbSettingsStateService);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translateService = inject(TranslateService);

  public readonly ratioActOptions = computed<RatioActOption[]>(() => [
    {
      value: 0,
      label: this.translateService.instant('pages.qb-settings.tab.seeding-ratios.ratio-act.pause'),
    },
    {
      value: 1,
      label: this.translateService.instant('pages.qb-settings.tab.seeding-ratios.ratio-act.remove'),
    },
  ]);

  public form = new FormGroup({
    max_ratio_enabled: new FormControl<boolean>(false, { nonNullable: true }),
    max_ratio: new FormControl<number>(0, { nonNullable: true }),
    max_ratio_act: new FormControl<number>(0, { nonNullable: true }),
    max_seeding_time_enabled: new FormControl<boolean>(false, { nonNullable: true }),
    max_seeding_time: new FormControl<number>(0, { nonNullable: true }),
  });

  public ngOnInit(): void {
    const prefs = this.stateService.preferences();
    if (prefs) {
      this.form.patchValue(
        {
          max_ratio_enabled: prefs.max_ratio_enabled,
          max_ratio: prefs.max_ratio,
          max_ratio_act: prefs.max_ratio_act,
          max_seeding_time_enabled: prefs.max_seeding_time_enabled,
          max_seeding_time: prefs.max_seeding_time,
        },
        { emitEvent: false },
      );
      this.updateRatioState(prefs.max_ratio_enabled);
      this.updateSeedingTimeState(prefs.max_seeding_time_enabled);
    }

    this.stateService.registerSave('seeding-ratios', () => this.save());

    this.form.controls.max_ratio_enabled.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((enabled) => this.updateRatioState(enabled));

    this.form.controls.max_seeding_time_enabled.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((enabled) => this.updateSeedingTimeState(enabled));

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.stateService.markDirty('seeding-ratios', true));
  }

  private updateRatioState(enabled: boolean): void {
    [this.form.controls.max_ratio, this.form.controls.max_ratio_act].forEach((c) =>
      enabled ? c.enable({ emitEvent: false }) : c.disable({ emitEvent: false }),
    );
  }

  private updateSeedingTimeState(enabled: boolean): void {
    enabled
      ? this.form.controls.max_seeding_time.enable({ emitEvent: false })
      : this.form.controls.max_seeding_time.disable({ emitEvent: false });
  }

  private async save(): Promise<void> {
    const v = this.form.getRawValue();
    await this.qbService.setAppPreferences(this.serverStoreService.currentServerId()!, {
      max_ratio_enabled: v.max_ratio_enabled,
      max_ratio: v.max_ratio,
      max_ratio_act: v.max_ratio_act,
      max_seeding_time_enabled: v.max_seeding_time_enabled,
      max_seeding_time: v.max_seeding_time,
    });
  }
}
```

- [ ] **Step 4: Create the HTML template**

```html
<!-- packages/app/src/app/pages/qb-settings/seeding-ratios/seeding-ratios.html -->
<form [formGroup]="form">
  <div class="container-fluid">
    <fieldset class="bb-fieldset">
      <legend>{{ 'pages.qb-settings.tab.seeding-ratios.label.share-ratio' | translate }}</legend>
      <div class="container">
        <div class="row mb-3">
          <div class="col-12">
            <div class="form-check form-switch">
              <input
                class="form-check-input"
                type="checkbox"
                role="switch"
                id="max-ratio-enabled"
                formControlName="max_ratio_enabled"
              />
              <label class="form-check-label" for="max-ratio-enabled">
                {{ 'pages.qb-settings.tab.seeding-ratios.field.max-ratio-enabled' | translate }}
              </label>
            </div>
          </div>
        </div>
        <div class="row mb-3">
          <div class="col-6 d-flex align-items-center">
            {{ 'pages.qb-settings.tab.seeding-ratios.field.max-ratio' | translate }}
          </div>
          <div class="col-6">
            <input
              type="number"
              class="form-control"
              formControlName="max_ratio"
              min="0"
              step="0.1"
            />
          </div>
        </div>
        <div class="row mb-3">
          <div class="col-6 d-flex align-items-center">
            {{ 'pages.qb-settings.tab.seeding-ratios.field.max-ratio-act' | translate }}
          </div>
          <div class="col-6">
            <ng-select
              [items]="ratioActOptions()"
              [clearable]="false"
              [searchable]="false"
              bindLabel="label"
              bindValue="value"
              formControlName="max_ratio_act"
              appendTo="ngb-modal-window"
            ></ng-select>
          </div>
        </div>
      </div>
    </fieldset>

    <fieldset class="bb-fieldset">
      <legend>{{ 'pages.qb-settings.tab.seeding-ratios.label.seeding-time' | translate }}</legend>
      <div class="container">
        <div class="row mb-3">
          <div class="col-12">
            <div class="form-check form-switch">
              <input
                class="form-check-input"
                type="checkbox"
                role="switch"
                id="max-seeding-time-enabled"
                formControlName="max_seeding_time_enabled"
              />
              <label class="form-check-label" for="max-seeding-time-enabled">
                {{ 'pages.qb-settings.tab.seeding-ratios.field.max-seeding-time-enabled' | translate
                }}
              </label>
            </div>
          </div>
        </div>
        <div class="row mb-3">
          <div class="col-6 d-flex align-items-center">
            {{ 'pages.qb-settings.tab.seeding-ratios.field.max-seeding-time' | translate }}
          </div>
          <div class="col-6">
            <input type="number" class="form-control" formControlName="max_seeding_time" min="0" />
          </div>
        </div>
      </div>
    </fieldset>
  </div>
</form>
```

- [ ] **Step 5: Create the SCSS file**

```scss
// packages/app/src/app/pages/qb-settings/seeding-ratios/seeding-ratios.scss
```

(Empty — no component-specific styles needed.)

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: all tests pass across all workspaces.

- [ ] **Step 7: Run lint**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/app/pages/qb-settings/seeding-ratios/
git commit -m "#86: add Seeding Ratios tab for qBittorrent settings"
```
