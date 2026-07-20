# Settings & Configuration User Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace placeholder VitePress docs content in `@bitbutler/docs` with accurate settings/configuration documentation sourced from the real Angular components and `public/i18n/us.json`, and remove the two fictional pages (Network Settings, Scheduled Tasks) that describe features that don't exist.

**Architecture:** Pure content change inside `packages/docs/docs/`. No app code changes. `packages/docs/docs/.vitepress/config.ts` sidebar/nav is updated to match the new page set; VitePress's built-in dead-link check (`npm run build:docs`) is the verification mechanism for every task, since it fails the build on any broken internal link.

**Tech Stack:** VitePress 1.6 (Markdown + frontmatter), npm workspaces (`@bitbutler/docs`), Husky/lint-staged (Prettier auto-formats `*.md` on commit).

## Global Constraints

- Use `-` (hyphen), never `—` (em dash), anywhere in doc content (CLAUDE.md writing style rule).
- Commit format: `#231: short description` (current branch is `231-vitepress-docs-app`).
- Every task must end with `npm run build:docs` (run from repo root) succeeding with no dead-link errors.
- Content must be traceable to `public/i18n/us.json` string keys or the component `.ts`/`.html` files under `packages/app/src/app/modals/` - do not invent field names or behavior.
- Do not touch `docs/guide/getting-started.md`, `why-bitbutler.md`, `keyboard-shortcuts.md`, `faq.md`, `glossary.md`, `advanced/troubleshooting.md`, or the "Adding Torrents" / "Pausing and Resuming" sections of `managing-torrents.md` - out of scope per the design spec.
- Do not add screenshots or new placeholder images; keep the single existing placehold.co image in `connecting-a-server.md` as-is.

---

## Task 1: Update sidebar navigation and remove fictional pages

**Files:**

- Modify: `packages/docs/docs/.vitepress/config.ts`
- Delete: `packages/docs/docs/guide/advanced/configuration/network-settings.md`
- Delete: `packages/docs/docs/guide/advanced/automation/scheduled-tasks.md` (and the now-empty `automation/` directory)
- Rename: `packages/docs/docs/guide/advanced/configuration/server-settings.md` -> `packages/docs/docs/guide/advanced/configuration/bitbutler-settings.md`

**Interfaces:**

- Produces: the sidebar link slugs `/guide/advanced/configuration/bitbutler-settings` and `/guide/advanced/configuration/qbittorrent-settings`, which Task 2 and Task 3 depend on for their frontmatter/content to resolve correctly. The `qbittorrent-settings` page does not exist yet after this task - that's expected, it's created in Task 3, but its sidebar link is added now so Task 3 only has to add the file.

- [ ] **Step 1: Delete the fictional Network Settings page**

```bash
git rm packages/docs/docs/guide/advanced/configuration/network-settings.md
```

- [ ] **Step 2: Delete the fictional Scheduled Tasks page and its directory**

```bash
git rm packages/docs/docs/guide/advanced/automation/scheduled-tasks.md
```

Confirm the now-empty `packages/docs/docs/guide/advanced/automation/` directory is gone (git doesn't track empty directories, so no further action is needed once the file is removed).

- [ ] **Step 3: Rename server-settings.md to bitbutler-settings.md**

```bash
git mv packages/docs/docs/guide/advanced/configuration/server-settings.md packages/docs/docs/guide/advanced/configuration/bitbutler-settings.md
```

(Its content is still the old placeholder text at this point - that's rewritten in Task 2. This step is a pure rename so the history stays clean.)

- [ ] **Step 4: Update the sidebar config**

Read `packages/docs/docs/.vitepress/config.ts` first, then apply this edit - replace the `'Advanced'` sidebar group:

```ts
        {
          text: 'Advanced',
          items: [
            {
              text: 'Configuration',
              collapsed: false,
              items: [
                { text: 'Server Settings', link: '/guide/advanced/configuration/server-settings' },
                {
                  text: 'Network Settings',
                  link: '/guide/advanced/configuration/network-settings',
                },
              ],
            },
            {
              text: 'Automation',
              collapsed: false,
              items: [
                { text: 'Scheduled Tasks', link: '/guide/advanced/automation/scheduled-tasks' },
              ],
            },
            { text: 'Troubleshooting', link: '/guide/advanced/troubleshooting' },
          ],
        },
```

with:

```ts
        {
          text: 'Advanced',
          items: [
            {
              text: 'Configuration',
              collapsed: false,
              items: [
                {
                  text: 'BitButler Settings',
                  link: '/guide/advanced/configuration/bitbutler-settings',
                },
                {
                  text: 'qBittorrent Settings',
                  link: '/guide/advanced/configuration/qbittorrent-settings',
                },
              ],
            },
            { text: 'Troubleshooting', link: '/guide/advanced/troubleshooting' },
          ],
        },
```

- [ ] **Step 5: Build and verify**

From the repo root:

```bash
npm run build:docs
```

Expected: the build **fails** at this point with a VitePress dead-link error for `/guide/advanced/configuration/qbittorrent-settings` (the page doesn't exist yet - it's created in Task 3). Confirm the failure is specifically that missing link and not something else (e.g. a leftover reference to `network-settings` or `scheduled-tasks`).

- [ ] **Step 6: Commit**

```bash
git add packages/docs/docs/.vitepress/config.ts
git commit -m "$(cat <<'EOF'
#231: remove fictional settings pages, add real settings nav

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Write BitButler Settings page content

**Files:**

- Modify (full rewrite): `packages/docs/docs/guide/advanced/configuration/bitbutler-settings.md`

**Interfaces:**

- Consumes: nothing from other tasks.
- Produces: the `#path-mappings` and `#setting-a-default-server`-referencing prose that Task 4 and Task 5 link into; and this page itself links to `./qbittorrent-settings` (created in Task 3) and `../../connecting-a-server` (rewritten in Task 4) - those links are expected to be dead until those tasks land, which Task 1's partial build already demonstrated is how VitePress reports it.

- [ ] **Step 1: Replace the file content**

Write the following as the complete content of `packages/docs/docs/guide/advanced/configuration/bitbutler-settings.md`:

```markdown
---
title: BitButler Settings
description: Configure BitButler's application-level settings - startup behavior, appearance, per-server connection behavior, the status bar, and the torrent list grid.
---

# BitButler Settings

BitButler Settings control the application itself: startup behavior, appearance, per-server connection behavior, the status bar, and the torrent list grid. They are stored locally by BitButler and are independent of the qBittorrent-nox server you connect to - for the server's own preferences, see [qBittorrent Settings](./qbittorrent-settings).

Open the dialog from the toolbar: **Settings > BitButler**. The dialog has four tabs; a tab with unsaved changes shows a small asterisk next to its label. Changes across all tabs are saved together with the **Save** button.

## General

### Startup

| Setting                   | Description                                                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Start app with the system | Automatically launches BitButler when the operating system starts.                                                                            |
| Start minimized           | Hides the application window on startup; BitButler stays accessible from the system tray. Requires "Start app with the system" to be enabled. |

If no server is marked as the default connection, a warning hint appears here reminding you that the app will start without logging in automatically. See [Setting a Default Server](../../connecting-a-server#setting-a-default-server).

### Behavior

| Setting                                            | Description                                                                                                                                     |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Delete torrent files after adding them to the list | Removes the local `.torrent` file from disk once it has been added successfully.                                                                |
| Automatic updates                                  | Checks for BitButler updates automatically every time the app starts. A **Check for Updates now** button next to it triggers a check on demand. |
| In-application notification position               | Where toast notifications appear: Top Left, Top Right, Bottom Right, or Bottom Left.                                                            |

### Language

Sets the UI language: **English** or **Hungarian**. Changing it updates the renderer immediately and also rebuilds the tray and application menu labels.

### Date & Time

| Setting           | Description                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Date format       | A preset: Follow language, ISO, US, European, or Custom.                                                                |
| First day of week | Auto, Sunday, Monday, or Saturday.                                                                                      |
| Custom pattern    | Only shown when the date format preset is Custom. A free-text pattern built from the tokens below, with a live preview. |

Custom pattern tokens (example values below are for a sample date of Tuesday, April 5th 2026, 14:05:09 PM):

| Token  | Description              | Example |
| ------ | ------------------------ | ------- |
| `yyyy` | 4-digit year             | 2026    |
| `yy`   | 2-digit year             | 26      |
| `MMMM` | Full month name          | April   |
| `MMM`  | Abbreviated month name   | Apr     |
| `MM`   | 2-digit month            | 04      |
| `M`    | Month number             | 4       |
| `EEEE` | Full weekday name        | Tuesday |
| `EEE`  | Abbreviated weekday name | Tue     |
| `dd`   | 2-digit day of month     | 05      |
| `d`    | Day of month             | 5       |
| `HH`   | 2-digit hour (24h)       | 14      |
| `H`    | Hour (24h)               | 14      |
| `hh`   | 2-digit hour (12h)       | 02      |
| `h`    | Hour (12h)               | 2       |
| `mm`   | 2-digit minute           | 05      |
| `ss`   | 2-digit second           | 09      |
| `a`    | AM/PM marker             | PM      |

Wrap literal text in single quotes (e.g. `'at'`) to include it in the pattern as-is.

### Appearance

| Setting      | Description                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Theme Family | The overall color palette: BitButler, Aurora, Crimson Ember, Deep Sea, Mint Green, Ocean Breeze, Pumpkin Spice, or Purple Haze. |
| Theme Mode   | Light, Dark, or System (follows the OS theme).                                                                                  |

### Save Path Input

Controls how save-path fields behave throughout the app (when adding torrents, moving torrents, editing categories, and so on):

- **select** - a dropdown populated with folders discovered on the connected server.
- **typeahead** - a free-text field with autocomplete suggestions as you type.

## Server

Unlike the General tab, Server settings are stored **per connection** - each server you add in [Manage Servers](../../connecting-a-server) has its own polling interval and path-mapping configuration.

### Polling

BitButler polls the qBittorrent Web API to keep the torrent list in sync.

| Setting                     | Description                                                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Foreground polling interval | How often to poll while the app window is open, from 1 to 10 seconds.                                                                    |
| Background polling interval | How often to poll while the app is minimized to the system tray - set this higher to reduce network traffic while the app isn't in view. |

Setting either interval below 2 seconds shows a warning, since polling too aggressively can cause problems.

### Path Mappings

If a server's torrent download folders are also mounted locally (for example, a network share), you can map the server's remote path to its local equivalent. This lets BitButler open the correct local folder in your operating system's native file browser from the Torrent Details view, or from the torrent list when [row double-click behavior](#torrent-list-grid) is set to "Show in Folder / Open Destination".

Each row maps a **Remote Path** to a **Local Path**. Use **Test mapping** to confirm a mapping resolves to a real local folder, and the add/remove buttons next to each row to manage the list.

## Status Bar

Configure the visibility and order of the widgets shown in the status bar at the bottom of the main window. Drag widgets between the **Widget Pool** (disabled/unused) and the **Left** or **Right** column to enable, disable, or reorder them.

Available widgets:

- Connection Status
- DHT Nodes
- Share Ratio
- Global Downloaded
- Global Uploaded
- Download Speed
- Upload Speed
- Disk Space
- Session Stats
- Selection Info
- Polling Indicator

## Torrent List Grid

### Grid Options

| Setting                | Description                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| Animate Rows           | Animates rows when their values change. Turn off if you notice performance issues on large lists.            |
| Pagination             | Paginates the torrent list instead of rendering every row at once - helps performance with very large lists. |
| Compact Rows           | Reduces row height and cell padding for a denser view.                                                       |
| Pause Polling on Modal | Pauses background polling whenever any modal dialog is open; polling resumes automatically when it closes.   |

Row double-click behavior controls what happens when you double-click a torrent row:

- **Show in Folder / Open Destination** - opens the destination folder (and selects the file, for single-file torrents). Requires [Path Mappings](#path-mappings) to be configured for that server.
- **Open Torrent Details** - opens the Torrent Details view.
- **Inline Edit** - makes eligible cells directly editable in the grid: double-click a cell to edit, Enter to confirm, Escape to cancel. Only columns backed directly by a qBittorrent API field (no computed/formatted value) are editable.
- **Do nothing** - disables the double-click action.

### Columns

- **Column Pool** - a searchable multi-select of every available column.
- **Order** - drag to reorder the columns you've enabled; this is also the left-to-right order shown in the torrent grid.
```

- [ ] **Step 2: Build and verify**

```bash
npm run build:docs
```

Expected: still **fails**, but now only on the dead link to `/guide/advanced/configuration/qbittorrent-settings` (created in Task 3) and `/guide/connecting-a-server#setting-a-default-server` if `connecting-a-server.md` doesn't yet have that heading (it's rewritten with that exact heading in Task 4). Confirm no other dead links are reported - if there are, fix the relative paths in the file above before continuing.

- [ ] **Step 3: Commit**

```bash
git add packages/docs/docs/guide/advanced/configuration/bitbutler-settings.md
git commit -m "$(cat <<'EOF'
#231: write BitButler Settings guide content

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Write qBittorrent Settings page content

**Files:**

- Create: `packages/docs/docs/guide/advanced/configuration/qbittorrent-settings.md`

**Interfaces:**

- Consumes: links back to `./bitbutler-settings` (exists after Task 2).
- Produces: `#save-management` heading anchor that Task 5 links into.

- [ ] **Step 1: Create the file**

Write the following as the complete content of `packages/docs/docs/guide/advanced/configuration/qbittorrent-settings.md`:

```markdown
---
title: qBittorrent Settings
description: Configure the connected qBittorrent-nox server's own bandwidth, queue, seeding ratio, and storage preferences.
---

# qBittorrent Settings

Open this dialog from the toolbar: **Settings > qBittorrent**. Unlike [BitButler Settings](./bitbutler-settings), these preferences live on the qBittorrent-nox server itself - changing them affects every client connected to that server, not just BitButler.

Some fields only appear if the connected qBittorrent-nox version reports support for them. If you don't see a field described below, your server's version likely predates it.

## Bandwidth

### Global Rate Limits

Sets the maximum combined download and upload speed across all torrents. Enter `0` for unlimited.

| Field                 | Description                               |
| --------------------- | ----------------------------------------- |
| Download Limit (KB/s) | Maximum combined download speed, in KB/s. |
| Upload Limit (KB/s)   | Maximum combined upload speed, in KB/s.   |

### Alternative Rate Limits (Turtle Mode)

Throttled speed limits used when Turtle Mode is manually enabled or activated by the scheduler below.

| Field                             | Description                                             |
| --------------------------------- | ------------------------------------------------------- |
| Alternative Download Limit (KB/s) | Download speed cap applied while Turtle Mode is active. |
| Alternative Upload Limit (KB/s)   | Upload speed cap applied while Turtle Mode is active.   |

### Speed Scheduler

_(Only shown if your qBittorrent-nox version supports scheduling.)_

Automatically switches to the alternative rate limits during a configured time window on selected days.

- **Enable speed scheduler** - turns the schedule on or off.
- **Active on** - Every day, Every weekday, Every weekend, or a specific day of the week.
- **From / To** - the hour and minute the alternative limits start and stop applying.

## Queue & Limits

Control how many torrents can be active at once and how new torrents are queued.

### Active Torrent Management

| Field                              | Description                                                    |
| ---------------------------------- | -------------------------------------------------------------- |
| Enable torrent queuing constraints | Turns queuing on; without it, every torrent runs concurrently. |
| Maximum active downloads           | Cap on simultaneously downloading torrents.                    |
| Maximum active uploads             | Cap on simultaneously seeding torrents.                        |
| Maximum total active torrents      | Combined cap across downloads and uploads.                     |

### Download Behavior

_(Only shown if your qBittorrent-nox version supports it.)_

- **Add new torrents to the top of the queue** - new torrents jump ahead of already-queued ones instead of joining at the bottom.

## Seeding Ratios

Automatically stop seeding based on a share ratio target, a time threshold, or both.

### Share Ratio Limits

| Field                           | Description                                               |
| ------------------------------- | --------------------------------------------------------- |
| Enable Share Ratio Limit        | Turns the ratio limit on.                                 |
| Stop seeding when ratio reaches | The upload/download ratio that triggers the action below. |
| Action when limit is reached    | Pause torrent or Remove torrent.                          |

### Seeding Time Limits

| Field                        | Description                                        |
| ---------------------------- | -------------------------------------------------- |
| Enable Seeding Time Limit    | Turns the time limit on.                           |
| Stop seeding after (minutes) | How long to seed before the action above is taken. |

## Storage

### Default Paths

- **Default Save Path** - where new torrents are saved unless overridden by a category or a per-torrent choice.

### Temporary Files

_(Only shown if your qBittorrent-nox version supports a separate incomplete-files path.)_

- **Keep incomplete torrents in a separate folder** - toggles a dedicated **Incomplete Save Path** used while a torrent is still downloading; once complete, files move to the default (or category) save path.

### File Management

- **Append `.!qB` extension to incomplete files** - marks in-progress files so other tools can distinguish them from finished downloads.
- **Torrent content layout** _(only shown if supported by your server)_ - Original, Create subfolder, or Don't create subfolder, controlling whether multi-file torrents get wrapped in an extra folder.

### Save Management

| Field                           | Options                                   | Description                                                                                                                                  |
| ------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Default torrent management mode | Automatic / Manual                        | Automatic mode lets qBittorrent relocate torrent files when a category's save path changes; Manual leaves file locations entirely up to you. |
| When torrent category changes   | Relocate torrents / Switch to Manual mode | Behavior applied when a torrent's category is reassigned.                                                                                    |
| When category save path changes | Relocate torrents / Switch to Manual mode | Behavior applied when a category's own save path is edited.                                                                                  |
| When default save path changes  | Relocate torrents / Switch to Manual mode | Behavior applied when the server's default save path (above) is edited.                                                                      |
```

- [ ] **Step 2: Build and verify**

```bash
npm run build:docs
```

Expected: still **fails** only on the dead link from `bitbutler-settings.md` to `../../connecting-a-server#setting-a-default-server` (rewritten in Task 4). Confirm no dead links point at `qbittorrent-settings` anymore.

- [ ] **Step 3: Commit**

```bash
git add packages/docs/docs/guide/advanced/configuration/qbittorrent-settings.md
git commit -m "$(cat <<'EOF'
#231: write qBittorrent Settings guide content

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Rewrite Connecting a Server

**Files:**

- Modify (full rewrite): `packages/docs/docs/guide/connecting-a-server.md`

**Interfaces:**

- Produces: the `#setting-a-default-server` heading anchor that Task 2's `bitbutler-settings.md` links to, and the `#path-mappings`-referencing prose target lives on `bitbutler-settings.md` (already created).

- [ ] **Step 1: Replace the file content**

Write the following as the complete content of `packages/docs/docs/guide/connecting-a-server.md`:

```markdown
---
title: Connecting a Server
description: Add, switch between, and manage the qBittorrent-nox servers BitButler connects to.
---

# Connecting a Server

BitButler connects to one or more remote qBittorrent-nox instances over its Web API. Each connection is stored locally (passwords are encrypted at rest) and managed from the **Manage Servers** dialog.

## Adding a Server

Open **Manage Servers** either from the login screen, or from the main window's toolbar: **Manage > Servers**. Click **Add Server** to open the connection editor.

![Add server dialog placeholder](https://placehold.co/600x400/EEE/31343C?text=Add+Server)

### Connection Fields

| Field                          | Description                                                                                                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Connection Name                | A label for this server, shown throughout the UI.                                                                                                                                                                                                |
| Protocol                       | `http` or `https`.                                                                                                                                                                                                                               |
| Host                           | The server's hostname or IP address.                                                                                                                                                                                                             |
| Port                           | The qBittorrent Web UI port, from 1 to 65535.                                                                                                                                                                                                    |
| Username (optional)            | Leave blank if the Web UI doesn't require authentication.                                                                                                                                                                                        |
| Password (optional)            | Leave blank if the Web UI doesn't require authentication. When editing a server with a saved password, this field shows a hint that a password is already saved - leave it blank to keep the existing password, or type a new one to replace it. |
| Set this connection as default | See [Setting a Default Server](#setting-a-default-server) below.                                                                                                                                                                                 |

Click **Save** to add the connection to your server list.

## Switching Servers

The Manage Servers list shows every configured connection, its protocol/host/port, and a plug icon next to whichever one is currently active. Click **Connect** on any other server to switch to it. Use the filter box at the top of the list to search by name or host.

## Setting a Default Server

Marking a connection as default (the checkbox icon next to each server in the list, or the "Set this connection as default" option in the editor) tells BitButler to automatically select and connect to that server on startup, instead of showing the login screen. Only one server can be default at a time - marking a new one clears the previous default.

## Editing and Deleting a Server

From the Manage Servers list, use the pencil icon to reopen a connection in the editor, or the trash icon to delete it. Deleting asks for confirmation first, since it also discards that server's saved [Path Mappings](./advanced/configuration/bitbutler-settings#path-mappings) and polling settings.
```

- [ ] **Step 2: Build and verify**

```bash
npm run build:docs
```

Expected: **succeeds** with no dead-link errors. If it still fails, check the exact relative path from `packages/docs/docs/guide/connecting-a-server.md` to `packages/docs/docs/guide/advanced/configuration/bitbutler-settings.md` (should be `./advanced/configuration/bitbutler-settings`) and from `bitbutler-settings.md` back (should be `../../connecting-a-server`).

- [ ] **Step 3: Commit**

```bash
git add packages/docs/docs/guide/connecting-a-server.md
git commit -m "$(cat <<'EOF'
#231: rewrite Connecting a Server guide with real content

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Rewrite the Categories and Tags section of Managing Torrents

**Files:**

- Modify: `packages/docs/docs/guide/managing-torrents.md`

**Interfaces:**

- Consumes: `#save-management` anchor on `qbittorrent-settings.md` (exists after Task 3).

- [ ] **Step 1: Read the current file**

Read `packages/docs/docs/guide/managing-torrents.md` to confirm the exact current text of the `## Categories and Tags` section (it should be the last `##` section in the file, currently one paragraph of placeholder Lorem ipsum with no subheadings).

- [ ] **Step 2: Replace only the Categories and Tags section**

Using the Edit tool, replace:

```markdown
## Categories and Tags

Qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident.
```

with:

```markdown
## Categories and Tags

Categories and tags help you organize torrents. Both are managed from the toolbar's **Manage** group.

### Categories

Open **Manage > Categories**. Each category has a name and an optional save path - assigning a category to a torrent can automatically relocate it to that path, depending on your qBittorrent [Save Management](./advanced/configuration/qbittorrent-settings#save-management) settings. Use the filter box to search existing categories, the pencil icon to edit a category's save path, and the trash icon to delete one; deleting shows how many torrents currently use that category before you confirm.

### Tags

Open **Manage > Tags**. Unlike categories, a torrent can have multiple tags. Add several at once by entering a comma-separated list in the name field. Use the filter box to search, and the trash icon to delete a tag - the confirmation shows how many torrents currently use it.
```

Do not modify the "Adding Torrents" or "Pausing and Resuming" sections above it - they stay as placeholder content, out of scope for this change.

- [ ] **Step 3: Build and verify**

```bash
npm run build:docs
```

Expected: **succeeds** with no dead-link errors.

- [ ] **Step 4: Commit**

```bash
git add packages/docs/docs/guide/managing-torrents.md
git commit -m "$(cat <<'EOF'
#231: rewrite Categories and Tags section with real content

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Final verification sweep

**Files:** none (verification only)

**Interfaces:** none.

- [ ] **Step 1: Full clean build**

```bash
npm run build:docs
```

Expected: succeeds with no warnings about dead links.

- [ ] **Step 2: Search for stray references to deleted pages**

```bash
grep -rn "network-settings\|scheduled-tasks" packages/docs/docs packages/docs/docs/.vitepress/config.ts
```

Expected: no matches (the `.vitepress/cache` and `.vitepress/dist` build-output directories may still contain stale references from earlier builds - only files under `packages/docs/docs/guide/` and `config.ts` matter; if `dist`/`cache` show matches, that's fine, they're regenerated by the build in Step 1 and are gitignored).

- [ ] **Step 3: Confirm gitignore covers build output**

```bash
git status --porcelain packages/docs
```

Expected: clean (no untracked `dist`/`cache` output staged) - if anything under `.vitepress/dist` or `.vitepress/cache` shows as untracked/modified, do not add it; it's build output.

- [ ] **Step 4: Spot-check the rendered site**

```bash
npm run serve:docs
```

Open the printed local URL in a browser (or use the `run` skill if available) and confirm:

- The sidebar's "Advanced > Configuration" group shows "BitButler Settings" and "qBittorrent Settings" (no "Automation" group).
- Both new pages render with working H2/H3 navigation in the "On this page" outline.
- The "Connecting a Server" and "Managing Torrents" pages render correctly, including the cross-links added in Tasks 2-5.

Stop the dev server once confirmed (Ctrl+C).

No commit for this task - it's verification-only. If any issue is found, fix it in the relevant file and amend that task's earlier commit is _not_ appropriate per project convention (never amend); instead make a small follow-up commit:

```bash
git add <fixed-file>
git commit -m "$(cat <<'EOF'
#231: fix <describe the specific issue found>

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
