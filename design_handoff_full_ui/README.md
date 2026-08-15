# Handoff: BitButler UI — Full Application (All Screens & Modals)

## Overview

BitButler is a qBittorrent-nox remote client (desktop app, built on Angular & Electron per its About screen). This package covers the complete UI surface designed in this project: the login/connect screen, the main torrent list window, every settings surface, and all modal dialogs (add/import/export torrents, torrent details, torrent-exists, server management, connection setup, and about).

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes showing intended look, layout, and behavior, not production code to copy directly. The task is to **recreate these designs in the target codebase's existing environment** (the app's screenshots show Angular; if the real codebase is Angular + Electron, rebuild there using its component library and state patterns — otherwise choose the most appropriate framework and implement there). Copy the visual spec and behavior, not the markup. Note the HTML source uses a small custom templating syntax (`{{ }}` bindings, `<sc-if>`/`<sc-for>` control-flow tags) — treat these purely as authoring shorthand for conditionals/loops, not a library to install.

## Fidelity

**High-fidelity.** Colors, typography, spacing, radii, and interaction states are final. Recreate pixel-accurately using the codebase's own primitives (or the chosen framework's). All data shown (torrent names, sizes, speeds, dates) is sample/placeholder data — wire it to the real qBittorrent Web API.

---

## Screens / Views

### 1. Login / Connect to Server

**File:** `login/Login.dc.html`
**Purpose:** Landing screen shown before connecting to a qBittorrent server; pick a saved host and connect, or manage saved servers.
**Layout:** Full viewport, two-panel split. Left ~55%: radial-gradient background, centered logo (150×150 circular image) above app name (34px/750) and tagline (14px, `--text-tertiary`). Right ~45%: bordered-left panel, centered 340px-wide column with vertical gap 22px.
**Components:**

- Heading block: "Connect to Server" (22px/700) + helper text "Select a host to connect to." (13px, `--text-secondary`).
- **Host selector**: label "Host" (11px, tertiary) above a clickable field (padding 11×13, radius 9px, border `--border-strong`, background `--bg-input`) showing the selected host name (14px/600) with a chevron-down icon. Click opens a dropdown (absolute, top+6px, background `--bg-elevated`, border, radius 9px, padding 5px, shadow) listing hosts; selected item gets an accent-tinted pill background.
- **Connect** button: full-width, padding 13px, radius 9px, filled accent (`--accent` bg, `--accent-ink` text), plug icon + "Connect", 14.5px/700.
- **Manage Servers** button: same shape, outlined (accent border, transparent bg, accent text), server-rack icon + "Manage Servers".
- Footer row: version link ("v1.2.0", underlined accent) on the left; on the right, three icon buttons (30×30, radius 7px) for Language, Theme Family (opens an upward swatch-list dropdown of 8 named theme colors), and Contrast.
  **Content/copy:** App name "BitButler", tagline "qBittorrent-nox Remote Client", version "v1.2.0".

### 2. Torrent List (Main Window)

**File:** `torrent-list/TorrentList.dc.html`
**Purpose:** Primary application window — browse, filter, and act on all torrents on the connected server.
**Layout:** Full viewport column: content row (sidebar + main) filling available height.

- **Sidebar** (262px, `--bg-panel`, right border): brand row (34×34 rounded-square "B" mark + app name + green dot "test-qb" status), then five collapsible filter groups — **Status**, **Trackers**, **Categories**, **Tags**, **Save paths** — each with an uppercase label + count, an optional "Manage" link (Categories/Tags), a filter input (all groups except Status), and a list of clickable rows (icon + name + count) where the active row gets an accent-tinted pill background.
- **Main column**: a toolbar, the torrent grid, and a status bar.
  - **Toolbar**: "Add Torrent" primary button; a segmented button-group (Start, Pause, divider, Top/Up/Down/Bottom reordering, divider, Delete in danger red) all on a bordered pill background; right-aligned search input (270px) and Settings/Manage dropdown buttons.
  - **Grid**: sticky uppercase header row (10.5px/700) over 12 columns (status dot, Name, Size, Progress, Down, Up, ETA, Downloaded, Uploaded, Ratio, Added on, Save path). Rows are 44px tall with hairline bottom borders; the selected row gets an accent left-edge stripe + tinted background. Status dot color: green (done), accent (downloading), dark gray (idle/stopped). Progress cell = 6px rounded bar + percentage caption below.
  - **Status bar** (38px, `--bg-panel`, top border): left cluster (Connected indicator, DHT node count, global ratio), a divider, session/total download and upload totals, then a right-aligned cluster (live down/up speed, free disk space, a "Turtle off" pill toggle). Several stat groups hide responsively below named breakpoints (1399/1179/909/860/820px).
    **Content/copy:** Sample torrents are Ubuntu ISO files; sample categories/tags are placeholders ("test category", "test 1", etc.).

### 3. Add Torrent (modal)

**File:** `add-torrent/AddTorrent.dc.html`
**Purpose:** Add a new torrent from a file, magnet link, or folder of .torrent files, configure its options/limits, and choose which files to download.
**Layout:** Centered modal, max-width 760px, header + 4-tab bar (General / Options / Limits / Files) + scrolling body + footer, matching the shared modal shell (see Design Tokens).
**Components:**

- **General tab**: "Source" panel with a 3-way segmented picker (File/Link/Folder — active segment fills accent), a path/value field with a "Browse" button; "Torrent" panel showing Name, Size, Free space, an accent-outlined Save path row, and Category/Tags rows (all with chevron affordance to open pickers).
- **Options tab**: "Layout" panel (Root folder picker) and "Behaviour" panel — 5 toggle rows (Skip hash checking, Add in paused state, Use Auto TMM, Enable sequential download, Prioritise first/last piece), each with a label, a "?" hint circle, a sub-line, and a toggle switch.
- **Limits tab**: "Transfer rate limits" (Download/Upload, each a value field + No limit/Custom segmented control) and "Share limits" (Ratio/Seeding time/Inactive seeding time, each Global/No limit/Custom).
- **Files tab**: summary line + "Rename files" toggle button + filter input, then a file tree panel (Name/Size/Priority columns) with per-row checkboxes (checked/mixed/unchecked states), folder/file icons, indentation by depth, and a priority pill per row.
- **Footer**: "Cancel" (outlined) and a split "Add torrent" button (main action + caret opening "Add and start immediately" / "Add in paused state").
  **Content/copy:** Sample torrent "ubuntu-26.04-release" (12.4 GB, 5 files in 1 folder).

### 4. Export Torrents (modal)

**File:** `export/Export.dc.html`
**Purpose:** Export a set of torrents (with their trackers/categories/tags) to a `.bbe` archive file.
**Layout:** Centered modal, max-width 760px, three stacked panels in the body.
**Components:**

- **Connection** panel: read-only key/value rows — Server, URL, WebUI version, qBittorrent version, and Export type (success-green with an info icon).
- **Export scope** panel: three rows of segmented pickers — Torrents (All / Filtered / Selected, each with a count), Categories (All / Assigned, each with a count) plus a help line, Tags (same pattern).
- **Save location** panel: Directory field + Browse button; Filename field with a fixed `.bbe` suffix chip.
- **Footer**: underlined "Cancel" + filled accent "Export" button (download icon).
  **Content/copy:** Sample server "test-qb" at `http://localhost:9020`.

### 5. Import Torrents (modal)

**File:** `import/Import.dc.html`
**Purpose:** Import a previously exported `.bbe` archive back onto a server, choosing which torrents to restore and how to handle conflicts.
**Layout & components:** Mirrors the Export modal's shell and panel structure (Connection info, scope segmented controls, Save/location controls) but its torrent table adds a per-row **restore strategy** control with three states — **Keep** / **Replace** / **Skip** — for torrents that already exist on the target server, plus checkboxes for which torrents to include. Same footer pattern with a primary "Import" action.

### 6. Torrent Details (modal)

**File:** `torrent-details/TorrentDetails.dc.html`
**Purpose:** Full inspector for one torrent — progress, metadata, options, trackers, peers, and file selection — without leaving the torrent list.
**Layout:** Centered modal, max-width 1020px, max-height 100vh. Vertical stack: header (title + monospace hash chip + size + relative added time + close button) → 4-tab bar (General / Trackers / Peers / Content) → scrolling body → footer.
**Tab 1 — General:**

- **Hero card**: large percentage (26px/600) + "X of Y" sub-label, right-aligned state sentence; a 10px gradient-fill progress bar; a pieces/ETA caption row; a 4-column KPI grid (Download, Upload, Swarm, Ratio tiles — each with an uppercase tinted label, a 17px value, and a sub-line).
- **Torrent** panel: label/value row-list (Name, Save path, Remote path, Category, Tags, Comment).
- **Options** panel: 2-column grid of 4 toggle rows (Auto TMM, Sequential download, Force start, Super seeding), each with a hint sub-line.
- **Transfer** panel: 3-column cell grid, 15 cells (Time active, ETA, Connections, Downloaded, Uploaded, Seeds, Download/Upload limit, Wasted, Share ratio, Reannounce in, Last seen complete, Ratio/Seeding/Inactive-seeding limits).
- **Information** panel: 3-column cell grid, 6 cells (Total size, Pieces, Created by, Added on, Completed on, Created on).
  **Tab 2 — Trackers:** a table (Tier, URL, Status, Peers, Seeds, Leeches) — protocol rows (DHT/PeX/LSD) show tier "-1" and a "Working" pill (green); the real announce URL shows tier 0 and a "Not contacted" pill (muted) when idle.
  **Tab 3 — Peers:** the same table header, with an empty state below it (dashed circle icon, "No peers connected" heading, explanatory body text) when the swarm has no connections.
  **Tab 4 — Content:** a summary line + a file tree panel (Name / Size / Progress / Priority columns) with per-row minibar progress and a priority pill.
  **Footer:** five grouped action buttons — **Resume** (primary, reflects Pause when running), **Files**, **Manage**, **Limits**, **Maintenance** — each a split button whose caret opens a menu of related actions (see interaction notes below); plus right-aligned **Delete** (danger) and **Close**.
  **Content/copy:** Sample torrent "ubuntu-26.04-desktop-arm64.iso", hash `59ec6454b48d0cb232cc3ad67f66c4327c1a1092`.

### 7. Torrent Exists (modal)

**File:** `torrent-exists/TorrentExists.dc.html`
**Purpose:** Shown when the user tries to add a torrent that's already in their list — surfaces its current status instead of re-adding it.
**Layout:** Centered modal, max-width 520px.
**Components:**

- Header: 34×34 rounded "duplicate" icon chip, title "Torrent already added", sub-line "This torrent is already in your list", close button.
- **File card**: file icon + filename, a percentage/sub-label row with a right-aligned colored state label (e.g. green "Downloading"), a progress bar, and a rates row (download/upload rate icons + "N seeds · M leechers").
- A 3-column stat grid (Size, Downloaded, Uploaded / Ratio, Seeds/Leechers, Added on).
- A Save path row (monospace value).
- Footer: "Close" (outlined) + filled accent "Open details" (info icon).

### 8. Manage Servers (modal)

**File:** `manage-servers/ManageServers.dc.html`
**Purpose:** View, filter, add, edit, delete, and set the default among saved server connections.
**Layout:** Centered modal, max-width 480px.
**Components:**

- Header ("Manage Servers" + close button), a "Filter by name or host..." input.
- A list of server rows — each shows name (14px/650) + host (12px, tertiary), and three actions: a star/checkmark "set default" button (accent-filled when this server is the default), an edit (pencil) icon, and a delete (trash, danger-tinted) icon.
- Empty state: "No servers match "…"" when the filter has no results.
- Footer: filled accent "Add Server" (plus icon) on the left, underlined "Close" on the right.
  **Content/copy:** Sample servers "qb5" (`http://localhost:9020`) and "threadripper" (`http://threadripper:8090`, marked default).

### 9. New Connection (modal)

**File:** `new-connection/NewConnection.dc.html`
**Purpose:** Add or edit a single saved server connection's credentials.
**Layout:** Centered modal, max-width 520px.
**Components:**

- Header ("New Connection" + close), then a form: Connection Name (full-width input); a 3-column row (Protocol select [http/https], Host input, Port input); a 2-column row (Username optional, Password optional — masked).
- "Set this connection as default" row: a labeled toggle switch + an info-hint icon.
- Footer: underlined "Cancel" + "Save" (filled accent only once Name and Host are non-empty; otherwise disabled/muted styling).

### 10. About (modal)

**File:** `about/About.dc.html`
**Purpose:** App identity/version panel with links to source and author.
**Layout:** Centered modal, max-width 460px.
**Components:**

- Header row: circular 60×60 app logo, app name (22px/750), uppercase tagline, and two pills — version ("v1.2.0", accent) and build hash ("#e102502", info-blue).
- A 2-column info grid: Released (date/time) and Platform ("Angular & Electron").
- Footer: two dashed-border link chips (GitHub icon + "github@bitbutler", person icon + "@enisz") on the left, "Close" button on the right.

### 11. BitButler Settings (modal)

**File:** `settings/BitButlerSettings.dc.html`
**Purpose:** Application-level preferences, independent of any one server.
**Layout:** Centered modal with a 4-tab bar — **General**, **Server**, **Torrent List Grid**, **Status Bar** — over a scrolling body of grouped panels, matching the shared modal shell.
**Tab contents:**

- **General**: Startup (Start app with system / Start minimized toggles); Behavior (delete-torrent-files toggles, Automatic updates toggle + "Check for Updates now" link, in-app notification position select); Language (UI language select); Date & Time (date format select with live preview, first-day-of-week select); Appearance (Theme Family select, Theme Mode select); Save Path Input section (continues below the fold).
- **Server**: Polling (Foreground/Background polling interval sliders, each paired with a numeric "Seconds" field); Path Mappings (Remote Path select + Local Path input + Browse button + add-mapping "+" button).
- **Torrent List Grid**: Grid Options (Animate Rows / Pagination / Compact Rows / Pause on Modal toggles, Row double-click behavior select); Columns (a reorderable "Order" list with per-row up/top/down/bottom/remove icon buttons, and a "Column Pool" showing Visible Columns as removable chips with a Reset link).
- **Status Bar**: intro copy + "Reset to Defaults" link; a Widget Pool of draggable chips (Selection Info, Global Total Ratio, Global Total Downloaded, Global Total Uploaded); two drop zones labeled Left/Right showing the currently active widgets as pills with live sample values (Connected status, DHT count, ratio, totals, speeds, free space, turtle-mode icon).
  Every tab shares the same footer: disabled "Save" (enables on change) + "Close".

### 12. qBittorrent Settings (modal)

**File:** `qbittorrent-settings/QbittorrentSettings.dc.html`
**Purpose:** Server-side qBittorrent preferences (proxied through the qBittorrent Web API), separate from BitButler's own app settings.
**Layout:** Same modal shell/tab-bar pattern, tabs **Bandwidth**, **Storage**, **Queue & Limits**, **Seeding Ratios**.
**Tab contents:**

- **Bandwidth**: Global Rate Limits (Download/Upload KB/s inputs, "No Limit" hint when 0); Alternative Rate Limits / Turtle Mode (Alternative Download/Upload KB/s inputs); Speed Scheduler (enable toggle, Active-on select, From/To hour+minute selects).
- **Storage**: Default Paths (Default Save Path); Temporary Files (keep-incomplete toggle + Incomplete Save Path); File Management (append `.!qB` toggle, Torrent content layout select); Save Management (default torrent management mode select, three "when X changes" behavior selects).
- **Queue & Limits** / **Seeding Ratios**: same panel/row visual pattern as the other tabs (not fully detailed in this pass — apply the identical toggle/select/input row styling documented above).
  Shared footer: "Save" (disabled until dirty) + "Close".

---

## Interactions & Behavior (shared across the app)

- **Modals**: all dialogs use the same shell — centered, `rgba(10,8,5,.62)` scrim, `--bg-modal` panel, `18px` radius, header/tab-bar/footer are fixed, body scrolls (`overflow-y:auto; min-height:0`). Close via the header ✕ button, a "Close"/"Cancel" footer button, or (recommended) Escape.
- **Tabs**: click switches `activeTab` state; only the active pane renders; active tab gets accent text + a 2px accent bottom border sitting on the divider (`margin-bottom:-1px`).
- **Toggles**: 40×23 (or 38×22 for smaller forms) pill switches; off = `--bg-input` track / `--text-tertiary` knob at 2px inset; on = `--accent` track+border / `--accent-ink` knob translated to the right; transition `.15s ease`.
- **Segmented pickers** (scope selectors, protocol, restore strategy): each option is a full-opacity accent-filled pill when active, an outlined/muted pill when inactive; clicking swaps the active key.
- **Split buttons** (Torrent Details footer, Add Torrent's "Add torrent"): a main action segment + a caret segment that opens an upward or downward popover menu of related actions; a document-level click closes any open menu; only one menu open at a time.
- **File trees** (Add Torrent Files tab, Torrent Details Content tab): checkbox states are checked / unchecked / mixed (partial-selection dash); folder rows can be collapsed (chevron rotates -90° when collapsed); indentation = depth × ~22px; priority is a pill that opens a High/Normal/Low/Do not download menu, and setting a folder's priority cascades to its children.
- **Sidebar filter groups** (Torrent List): each group (Status/Trackers/Categories/Tags/Save paths) is independently collapsible via its chevron; the active filter item across all groups gets an accent-tinted pill background; typing in a group's filter input narrows its item list.
- **Toast-free error banner** (Torrent Details): collapsible — header row toggles a raw-log `<pre>` block; chevron rotates 180° when open.
- **Live data**: rates, ETA, peers/seeds counts, and progress bars should poll the qBittorrent Web API (qBittorrent's own WebUI uses a ~1.5s sync interval) and animate width/number changes rather than snapping.
- **Responsive**: the Torrent List status bar hides secondary stat groups at named breakpoints (1399 / 1179 / 909 / 860 / 820px) to avoid wrapping; Torrent Details' non-primary footer buttons should collapse to icon-only below ~1000px modal width.

## State Management

Suggested state shape per screen (adapt to the target framework's conventions):

- **Login**: `hosts[]`, `selectedHost`, `hostDropdownOpen`, `themeDropdownOpen`, `themeIdx`.
- **Torrent List**: `filterGroups` (per-group open/closed + text query + active selection), `search`, `torrents[]` (polled), `selectedRowIndex` or `selectedIds[]`.
- **Add Torrent**: `activeTab`, `source` ('File'|'Link'|'Folder') + its value, `options{skipHash,paused,autoTMM,sequential,firstLast}`, `rateLimits{download,upload}`, `shareLimits{ratio,seedingTime,inactiveSeedingTime}`, `fileTree` (with selection/priority/expanded state), `addMenuOpen`.
- **Export/Import**: `scope` ('all'|'filtered'|'selected'), `categoryScope`, `tagScope`, `directory`, `filename`, and for Import a per-torrent `restoreStrategy` ('keep'|'replace'|'skip') plus per-row `included` checkbox.
- **Torrent Details**: `activeTab`, `errorExpanded`, polled `torrent` object (see the Torrent Details section above for its full field list), `options{autoTMM,sequential,forceStart,superSeeding}`, `files` tree, `trackers[]`, `peers[]`, `openMenu`.
- **Manage Servers**: `servers[]`, `filterQuery`, `defaultServerId`.
- **New Connection**: `name`, `protocol`, `host`, `port`, `username`, `password`, `isDefault`; `canSave` derived from non-empty name+host.
- **Settings (both)**: one state slice per tab's fields, plus a `dirty` flag that enables the footer's Save button; persisted only on Save.
- Any mutating action (resume/pause/recheck/rename/delete/save-settings/etc.) should optimistically update local state and reconcile against the next server poll.

## Design Tokens

Colors (all screens share this palette):

```
--bg: #16120e            --bg-panel: #1b1610       --bg-elevated: #221b14
--bg-surface: #1e1911    --bg-input: #1f1912       --bg-modal: #1c160f
--border: rgba(240,225,200,0.08)      --border-strong: rgba(240,225,200,0.15)
hairline dividers: rgba(240,225,200,0.05)
--text: #f3e9d8          --text-secondary: #a99c86  --text-tertiary: #7c705d
--accent: #e3bd87        --accent-strong: #dd9a4c    --accent-ink: #241a0f
--success: #8fbf8a       --danger: #d67866 (danger text on dark: #e8a595)
--info: #87b0d4
Overlay scrim: rgba(10,8,5,.62)
```

Radius: `--radius-lg: 18px` (modals) · `--radius-md: 12px` (panels, menus) · `--radius-sm: 8px` (controls, tiles) · `999px` pills.
Spacing: 26px modal gutter · 18–22px panel padding · 16–18px gaps between panels/sections · 12px KPI/grid gaps · 9–13px control padding.
Typography: system stack `-apple-system, "Segoe UI", system-ui, sans-serif` (monospace `ui-monospace, SFMono-Regular, Menlo, monospace`), base 13.5px. Titles 19–22px/650–750. Hero/stat values use `font-variant-numeric: tabular-nums`. Uppercase section/column labels: 10–10.5px/700, letter-spacing .08–.1em.
Shadows: modal `0 40px 90px -30px rgba(0,0,0,.75)` · dropdown/menu `0 12–20px 30–46px rgba(0,0,0,.4–.8)`.

## Assets

- `login/logo.png`, `about/logo.png` — the BitButler mascot/logo (a butler holding a covered dish), used at 150×150 (login) and 60×60 circular (about).
- All other icons are inline stroke SVGs (stroke-width ~1.7–2.4, round caps/joins) drawn directly in each file — no external icon library is required; substitute the target codebase's existing icon set if it matches this stroke style.

## Files

This handoff bundles every screen's design source, plus the shared token sheet:

```
login/Login.dc.html
torrent-list/TorrentList.dc.html
add-torrent/AddTorrent.dc.html
export/Export.dc.html
import/Import.dc.html
torrent-details/TorrentDetails.dc.html
torrent-exists/TorrentExists.dc.html
manage-servers/ManageServers.dc.html
new-connection/NewConnection.dc.html
about/About.dc.html
settings/BitButlerSettings.dc.html
qbittorrent-settings/QbittorrentSettings.dc.html
styles.css   — shared design-token sheet the above variables come from
```

Note: the `.dc.html` files are authored in this project's internal design-component format (custom `{{ }}` bindings / `<sc-if>` / `<sc-for>` tags, loaded via a small `support.js`/`ds-base.js` runtime). Read them as annotated HTML/CSS specs — the markup structure, inline styles, and literal copy are the source of truth; the templating syntax itself is not meant to be ported.
