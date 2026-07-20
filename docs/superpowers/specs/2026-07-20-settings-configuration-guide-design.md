# Settings & Configuration User Guide - Design

## Goal

Replace the placeholder (Lorem-ipsum) VitePress docs content that covers BitButler's
UI settings and configuration surfaces with accurate content sourced from the real
Angular components and `public/i18n/us.json` strings, so `@bitbutler/docs` has a
trustworthy settings/configuration section.

Out of scope: any non-settings guide content (Getting Started, Why BitButler,
Adding Torrents, Pausing/Resuming, Keyboard Shortcuts, FAQ, Glossary,
Troubleshooting). Those stay as-is (placeholder) except where noted below.

## Source of truth

- `packages/app/src/app/modals/settings/**` (BitButler app-level Settings modal:
  General, Server, Status Bar, Torrent List & Grid tabs)
- `packages/app/src/app/modals/qb-settings/**` (qBittorrent-nox server Settings
  modal: Bandwidth, Queue Limits, Seeding Ratios, Storage tabs)
- `packages/app/src/app/modals/manage-servers/**`, `server-editor/**`
- `packages/app/src/app/modals/manage-categories/**`, `manage-tags/**`
- `packages/app/src/app/pages/main/button-bar/button-bar.ts` (toolbar entry points:
  Settings group -> "BitButler" / "qBittorrent"; Manage group -> "Servers" /
  "Tags" / "Categories")
- `public/i18n/us.json` for exact field labels, popover text, and hints (English
  strings only - the docs site is English-only, no i18n needed for docs content)

## Fictional content to remove

Two existing placeholder pages describe features that do not exist anywhere in
the codebase:

- `docs/guide/advanced/automation/scheduled-tasks.md` (no task scheduler exists)
- `docs/guide/advanced/configuration/network-settings.md` (no proxy/TLS/cert
  settings exist)

Both are deleted, along with the "Automation" sidebar group and the
`automation/` directory.

## File & navigation changes

In `packages/docs/docs/.vitepress/config.ts`:

- Remove the "Automation" sidebar group entirely.
- Rename "Configuration" group items from `Server Settings` / `Network Settings`
  to `BitButler Settings` / `qBittorrent Settings`, pointing at the new page
  slugs below.

File changes:

- Delete `docs/guide/advanced/automation/` (whole folder).
- Delete `docs/guide/advanced/configuration/network-settings.md`.
- Rename `docs/guide/advanced/configuration/server-settings.md` to
  `docs/guide/advanced/configuration/bitbutler-settings.md` and rewrite its
  content (see below).
- Add `docs/guide/advanced/configuration/qbittorrent-settings.md` (new).
- Rewrite `docs/guide/connecting-a-server.md` in full.
- Rewrite only the "Categories and Tags" `## ` section of
  `docs/guide/managing-torrents.md`; leave "Adding Torrents" and "Pausing and
  Resuming" untouched (out of scope, not settings/configuration).

## Page content plan

Formatting conventions: H2 per fieldset/major grouping, H3 for subsections,
tables for enumerable option lists (date tokens, status bar widgets, etc.),
prose/bullets otherwise. Keep the existing placehold.co-style placeholder image
convention only where a page already uses one (`connecting-a-server.md`
currently has one placeholder image - keep the same placeholder there, don't
add new placeholder images to new pages per the "keep placeholder images / no
new screenshots" decision - actually: no new images are added to the two new
Configuration pages; the placeholder image already in `connecting-a-server.md`
is kept as-is). No em dashes anywhere (project-wide writing style rule).

### `bitbutler-settings.md`

Intro: how to open (toolbar **Settings > BitButler**), tabbed layout, the
unsaved-changes asterisk indicator per tab, Save/Close behavior.

- **General**
  - Startup: "Start app with the system", "Start minimized" (note: requires
    "Start app with the system" to be enabled), the "no default host configured"
    hint
  - Behavior: "Delete torrent files after adding them to the list", automatic
    updates + "Check for Updates now" button, in-app notification position
    (4 corners)
  - Language: English / Hungarian
  - Date & Time: format presets (Follow language, ISO, US, European, Custom),
    first day of week (Auto/Sunday/Monday/Saturday), custom pattern + token
    guide table (token, description, example - pull rows straight from
    `date-format.token-guide.token.*` keys)
  - Appearance: Theme Family (the 8 themes under `packages/app/src/styles/themes/`),
    Theme Mode (Light/Dark/System)
  - Save Path Input: "select" vs "typeahead" input mode and what differs
- **Server** _(per-connection settings - note this explicitly, distinct from
  qBittorrent Settings)_
  - Polling: foreground/background interval sliders (1000-10000ms), the
    <2000ms warning
  - Path Mappings: remote/local path pairs, "Test mapping" button, why this
    exists (open local paths in the OS file browser from Torrent Details / grid)
- **Status Bar**
  - Drag-and-drop widget pool -> Left/Right columns; list all widgets
    (Connection Status, DHT Nodes, Share Ratio, Global Downloaded, Global
    Uploaded, Download Speed, Upload Speed, Disk Space, Session Stats,
    Selection Info, Polling Indicator)
- **Torrent List & Grid**
  - Grid options: Animate Rows, Pagination, Compact Rows, Pause Polling on
    Modal, Row double-click behavior (Show in Folder/Open Destination incl. its
    Path Mappings dependency, Open Torrent Details, Inline Edit incl. its
    "columns with a direct API endpoint only" caveat, Do nothing)
  - Columns: drag-reorder list + column pool multi-select

### `qbittorrent-settings.md`

Intro: how to open (toolbar **Settings > qBittorrent**), and the key distinction
from BitButler Settings - these are pushed to the qBittorrent-nox server's own
preferences (affect every client connected to that server, not just BitButler).
Note that some fields only appear if the connected qBittorrent-nox version
exposes them (feature-detected from the preferences payload).

- **Bandwidth**: global DL/UP limits (0 = unlimited), alternative
  ("Turtle Mode") limits, speed scheduler (days/time window) - conditional
- **Queue & Limits**: queueing toggle, max active downloads/uploads/torrents,
  "add new torrents to top of queue" - conditional
- **Seeding Ratios**: share ratio limit + action (Pause/Remove torrent),
  seeding time limit (minutes)
- **Storage**: default save path, incomplete-files temp path - conditional,
  `.!qB` extension toggle, torrent content layout - conditional, save
  management (Automatic/Manual TMM + the three "when X changes" behaviors:
  Relocate torrents / Switch to Manual mode)

### `connecting-a-server.md` (full rewrite)

- Adding a Server: Manage Servers modal (toolbar **Manage > Servers**, or from
  the login screen), New Connection form fields (Connection Name, Protocol
  http/https, Host, Port, optional Username/Password, "Set this connection as
  default")
- Switching Servers: Connect button, active-server indicator, filtering the
  server list by name/host
- Setting a Default Server: what "default" means (auto-select + auto-connect
  on startup)
- Editing and Deleting a Server: edit reopens the same form (password field
  shows a "saved, leave blank to keep" hint), delete requires confirmation

### `managing-torrents.md` - "Categories and Tags" section only

- Manage Categories: name + optional save path, filter, edit, delete
  (confirmation shows how many torrents use it)
- Manage Tags: comma-separated multi-add in one go, filter, delete
  (confirmation shows usage count)

## Self-review notes

- Scope boundary is intentional: `managing-torrents.md` will end up with one
  accurate section next to two Lorem-ipsum sections. This is a deliberate,
  user-approved tradeoff to stay within the "settings/configuration" scope of
  this task rather than rewriting the whole guide.
- No screenshots are added; the one pre-existing placeholder image in
  `connecting-a-server.md` is left in place since removing it isn't part of
  this task's scope.
- All field names, labels, and behavioral notes above are drawn directly from
  `public/i18n/us.json` and the component `.ts`/`.html` files, not invented.
