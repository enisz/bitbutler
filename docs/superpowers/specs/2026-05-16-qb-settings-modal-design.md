# qBittorrent Settings Modal — Design Spec

**Date:** 2026-05-16
**Branch:** 84-category-manager (to be implemented on a new branch)

---

## Overview

A new tabbed modal — "qBittorrent Settings" — that lets the user read and write
remote qBittorrent-nox application preferences via `getAppPreferences` /
`setAppPreferences` on `QbService`. It lives alongside the existing BitButler
settings modal but is a completely separate component with its own state service,
command type, and button-bar entry.

---

## Architecture

The modal mirrors the existing `pages/settings/` structure exactly.

```
packages/app/src/app/pages/qb-settings/
  qb-settings.ts                     ← modal shell
  qb-settings.html
  qb-settings.scss
  qb-settings.interface.ts           ← QbSettingsTabId, Tab, QbSettingsTabComponent
  qb-settings-state.service.ts       ← preferences signal, dirty tracking, save registry
  bandwidth/
    bandwidth.ts / .html / .scss
  storage/
    storage.ts / .html / .scss
  queue-limits/
    queue-limits.ts / .html / .scss
  seeding-ratios/
    seeding-ratios.ts / .html / .scss
```

### Touch-points in existing files

| File                                     | Change                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| `models/qbittorrent.model.ts`            | Add 74 missing fields, make 12 obsolete fields optional, fix `proxy_type` type |
| `models/command.model.ts`                | Add `{ type: 'UI_OPEN_QB_SETTINGS' }` to `UiCommand`                           |
| `services/ui-command-handler.service.ts` | Handle `UI_OPEN_QB_SETTINGS`, open modal                                       |
| `pages/main/button-bar/button-bar.ts`    | Add toolbar entry + `onClick` case                                             |

---

## Data Flow

1. **Load** — `QbSettings.ngOnInit()` calls `qbService.getAppPreferences(serverId)` once
   and pushes the result into `QbSettingsStateService.setPreferences(prefs)`.
2. **Tab init** — each lazy-loaded tab reads `stateService.preferences()` (a
   `signal<QbAppPreferences | null>`) and patches its reactive form.
3. **Dirty tracking** — each tab calls `stateService.markDirty(tabId, true)` on
   `form.valueChanges`, and registers its save function with
   `stateService.registerSave(tabId, fn)`.
4. **Save** — the modal footer Save button calls `stateService.saveAll()`, which
   runs only the dirty tabs' save functions. Each save function calls
   `qbService.setAppPreferences(serverId, partialPrefs)` with only its own fields
   (using `QbSetAppPreferences = Partial<QbAppPreferences>`).
5. **Guard** — `canDeactivate()` mirrors the settings modal: if any tab is dirty,
   a confirm dialog asks "You have unsaved changes. Leave anyway?" before dismissing.

### Speed limit conversion

| Direction    | Formula                                                                        |
| ------------ | ------------------------------------------------------------------------------ |
| API → form   | `apiBytes / 1024` → KB/s number input                                          |
| Form → API   | `formKbps * 1024` → bytes/sec                                                  |
| Display hint | `formValue * 1024 \| speedLimit` (0 = "No limit" via `general.limit.no-limit`) |

---

## `QbSettingsStateService`

```typescript
@Injectable()
export class QbSettingsStateService {
  private readonly _preferences = signal<QbAppPreferences | null>(null);
  private readonly _dirtyTabs = signal<DirtyMap>({ ... });
  private readonly saveFns = new Map<QbSettingsTabId, () => Promise<void>>();

  readonly preferences = this._preferences.asReadonly();
  readonly isDirty = computed(() => Object.values(this._dirtyTabs()).some(Boolean));
  readonly isDirtyMap = this._dirtyTabs.asReadonly();

  setPreferences(prefs: QbAppPreferences): void { ... }
  markDirty(id: QbSettingsTabId, dirty: boolean): void { ... }
  registerSave(id: QbSettingsTabId, fn: () => Promise<void>): void { ... }
  resetDirty(): void { ... }
  async saveAll(): Promise<void> { ... }
}
```

---

## Conditional Rendering

Because qBittorrent-nox field availability varies by version, every fieldset is
conditionally rendered by checking whether its key(s) exist in the raw preferences
object. This prevents broken/empty inputs for unsupported fields.

Each tab exposes computed signals for fieldset-level guards:

```typescript
// bandwidth.ts
readonly hasScheduler = computed(() =>
  'scheduler_enabled' in (this.stateService.preferences() ?? {})
);
```

```html
@if (hasScheduler()) {
<fieldset class="bb-fieldset">...</fieldset>
}
```

Guards are applied at the **fieldset level**, not per individual field, so the layout
never has isolated gaps.

---

## Button Bar

New entry placed immediately before the existing `settings.open` button:

```typescript
{
  kind: 'action',
  id: 'qb-settings.open',
  label: 'pages.main.button-bar.button.qb-settings',
  icon: faGears,
  variant: 'default',
}
```

`onClick` case emits `{ type: 'UI_OPEN_QB_SETTINGS' }` on the command bus.
`UiCommandHandlerService` opens `QbSettings` with `size: 'xl'`, `scrollable: true`,
`centered: false`, and a `beforeDismiss` guard identical to the settings modal.

---

## Tab Definitions

### Tab 1 — Bandwidth (`bandwidth`)

| Fieldset                | Fields                                                | Notes                                                        |
| ----------------------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| Global Rate Limits      | `dl_limit`, `up_limit`                                | KB/s number inputs; SpeedLimitPipe hint below; 0 = unlimited |
| Alternative Rate Limits | `alt_dl_limit`, `alt_up_limit`                        | Same pattern                                                 |
| Speed Scheduler         | `scheduler_enabled`, schedule times, `scheduler_days` | Whole fieldset guarded by `'scheduler_enabled' in prefs`     |

**Speed Scheduler detail:**

- `scheduler_enabled` — toggle switch; when off, all sub-fields are `disabled` (not hidden)
- `schedule_from_hour` / `schedule_from_min` — two `<select>` elements side-by-side (hours 0–23, minutes 0–59)
- `schedule_to_hour` / `schedule_to_min` — same
- `scheduler_days` — `ng-select` dropdown:

| Value | Label         |
| ----- | ------------- |
| 0     | Every day     |
| 1     | Every weekday |
| 2     | Every weekend |
| 3     | Monday        |
| 4     | Tuesday       |
| 5     | Wednesday     |
| 6     | Thursday      |
| 7     | Friday        |
| 8     | Saturday      |
| 9     | Sunday        |

---

### Tab 2 — Storage (`storage`)

| Fieldset        | Fields                                           | Guard                                               |
| --------------- | ------------------------------------------------ | --------------------------------------------------- |
| Default Paths   | `save_path`                                      | none (core field)                                   |
| Temporary Files | `temp_path_enabled`, `temp_path`                 | `'temp_path_enabled' in prefs`                      |
| File Management | `incomplete_files_ext`, `torrent_content_layout` | `torrent_content_layout` input guarded individually |

**Details:**

- `temp_path` text input is `disabled` when `temp_path_enabled` toggle is off
- `torrent_content_layout` — `ng-select` with string values:

| Value           | Label                  |
| --------------- | ---------------------- |
| `"Original"`    | Original               |
| `"Subfolder"`   | Create subfolder       |
| `"NoSubfolder"` | Don't create subfolder |

---

### Tab 3 — Queue & Limits (`queue`)

| Fieldset                  | Fields                                                                                  | Guard                            |
| ------------------------- | --------------------------------------------------------------------------------------- | -------------------------------- |
| Active Torrent Management | `queueing_enabled`, `max_active_downloads`, `max_active_uploads`, `max_active_torrents` | none                             |
| Download Behavior         | `add_to_top_of_queue`                                                                   | `'add_to_top_of_queue' in prefs` |

**Details:**

- `max_active_downloads`, `max_active_uploads`, `max_active_torrents` are `disabled`
  when `queueing_enabled` is off

---

### Tab 4 — Seeding Ratios (`seeding`)

| Fieldset            | Fields                                            | Guard |
| ------------------- | ------------------------------------------------- | ----- |
| Share Ratio Limits  | `max_ratio_enabled`, `max_ratio`, `max_ratio_act` | none  |
| Seeding Time Limits | `max_seeding_time_enabled`, `max_seeding_time`    | none  |

**Details:**

- `max_ratio` (decimal) and `max_ratio_act` are `disabled` when `max_ratio_enabled` is off
- `max_seeding_time` (number, minutes) is `disabled` when `max_seeding_time_enabled` is off
- `max_ratio_act` — `ng-select`:

| Value | Label          |
| ----- | -------------- |
| 0     | Pause torrent  |
| 1     | Remove torrent |

---

## `QbAppPreferences` Model Update

### Fields to add (74 — present in real API, missing from interface)

```typescript
add_to_top_of_queue: boolean;
anonymous_mode: boolean;
autorun_on_torrent_added_enabled: boolean;
autorun_on_torrent_added_program: string;
bdecode_depth_limit: number;
bdecode_token_limit: number;
block_peers_on_privileged_ports: boolean;
connection_speed: number;
current_interface_name: string;
disk_io_read_mode: number;
disk_io_type: number;
disk_io_write_mode: number;
disk_queue_size: number;
embedded_tracker_port: number;
embedded_tracker_port_forwarding: boolean;
excluded_file_names: string;
excluded_file_names_enabled: boolean;
file_log_age: number;
file_log_age_type: number;
file_log_backup_enabled: boolean;
file_log_delete_old: boolean;
file_log_enabled: boolean;
file_log_max_size: number;
file_log_path: string;
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
mail_notification_smtp: string;
max_active_checking_torrents: number;
max_uploads: number;
max_uploads_per_torrent: number;
memory_working_set_limit: number;
merge_trackers: boolean;
peer_turnover: number;
peer_turnover_cutoff: number;
peer_turnover_interval: number;
performance_warning: boolean;
proxy_bittorrent: boolean;
proxy_hostname_lookup: boolean;
proxy_misc: boolean;
proxy_rss: boolean;
reannounce_when_address_changed: boolean;
recheck_completed_torrents: boolean;
refresh_interval: number;
request_queue_size: number;
resume_data_storage_type: string;
rss_download_repack_proper_episodes: boolean;
rss_smart_episode_filters: string;
save_resume_data_interval: number;
socket_backlog_size: number;
socket_receive_buffer_size: number;
socket_send_buffer_size: number;
ssrf_mitigation: boolean;
start_paused_enabled: boolean;
torrent_content_layout: string;
torrent_file_size_limit: number;
torrent_stop_condition: string;
upload_choking_algorithm: number;
upload_slots_behavior: number;
upnp_lease_duration: number;
use_category_paths_in_manual_mode: boolean;
use_subcategories: boolean;
validate_https_tracker_certificate: boolean;
web_ui_ban_duration: number;
web_ui_max_auth_fail_count: number;
web_ui_reverse_proxies_list: string;
web_ui_reverse_proxy_enabled: boolean;
```

### Fields to make optional (12 — in model, absent from real API)

`enable_os_cache?`, `enable_super_seeding?`, `max_half_open_connec?`,
`peer_proportional?`, `proxy_torrents_only?`, `recheck_torrents_on_completion?`,
`smtp_server?`, `ssl_cert?`, `ssl_key?`, `web_ui_ban_subnets?`,
`rss_download_rules?`, `mail_notification_smtp_server?`

### Type correction

`proxy_type: number` → `proxy_type: string | number`

---

## Form Patterns

All tab templates use the existing `bb-fieldset` / `bb-fieldset` CSS pattern from
`pages/settings/general/general.html`:

```html
<fieldset class="bb-fieldset">
  <legend>...</legend>
  <div class="container">
    <div class="row mb-3">
      <div class="col-6 d-flex align-items-center">Label</div>
      <div class="col-6">Control</div>
    </div>
  </div>
</fieldset>
```

Toggle switches use Bootstrap's `form-check form-switch` pattern.
Dropdowns use `ng-select` with `appendTo="ngb-modal-window"`.
Speed hint text uses `<div class="form-text">`.

---

## Out of Scope

- i18n translation keys — the implementation plan will enumerate these
- Unit tests — follow existing modal test patterns
- Any qBittorrent preference fields not listed in the four tabs above
