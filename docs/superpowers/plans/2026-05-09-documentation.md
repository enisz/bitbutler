# Documentation Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all placeholder content in the Analog.js docs site with real end-user documentation, and build a dynamic Changelog page that fetches release history from the GitHub API at runtime.

**Architecture:** Twenty markdown content pages organized into six task-oriented sections, plus one standalone Angular component (`ChangelogPageComponent`) served at `/changelog` with a dedicated route. The right sidebar's existing `MutationObserver` already handles dynamic headings, so no extra wiring is needed for the TOC. The left sidebar gets one hardcoded static link for the changelog.

**Tech Stack:** Analog.js (Angular 20, signals, zoneless), `marked` (already configured), `ngx-timeago` (already in root `node_modules`), `HttpClient` (needs to be provided), Vitest (node environment, existing spec pattern).

---

## File Map

### Delete

- `packages/docs/src/content/features.md`
- `packages/docs/src/content/architecture.md`
- `packages/docs/src/content/ipc-reference.md`
- `packages/docs/src/content/development.md`
- `packages/docs/src/content/01-getting-started/` (entire folder)
- `packages/docs/src/content/02-lorem-ipsum/` (entire folder)

### Rewrite

- `packages/docs/src/content/index.md` — welcome page with section links

### Create (content)

- `packages/docs/src/content/01-getting-started/installation.md`
- `packages/docs/src/content/01-getting-started/adding-your-first-server.md`
- `packages/docs/src/content/01-getting-started/logging-in.md`
- `packages/docs/src/content/01-getting-started/adding-your-first-torrent.md`
- `packages/docs/src/content/02-managing-servers/index.md`
- `packages/docs/src/content/02-managing-servers/test-connection.md`
- `packages/docs/src/content/02-managing-servers/switching-servers.md`
- `packages/docs/src/content/03-adding-torrents/index.md`
- `packages/docs/src/content/03-adding-torrents/magnet-link.md`
- `packages/docs/src/content/03-adding-torrents/options.md`
- `packages/docs/src/content/04-monitoring-downloads/main-screen.md`
- `packages/docs/src/content/04-monitoring-downloads/torrent-grid.md`
- `packages/docs/src/content/04-monitoring-downloads/filtering.md`
- `packages/docs/src/content/04-monitoring-downloads/status-bar.md`
- `packages/docs/src/content/04-monitoring-downloads/actions.md`
- `packages/docs/src/content/05-customizing/general.md`
- `packages/docs/src/content/05-customizing/server.md`
- `packages/docs/src/content/05-customizing/torrent-grid.md`
- `packages/docs/src/content/05-customizing/status-bar.md`

### Create (Angular)

- `packages/docs/src/app/pages/changelog-page.component.ts`

### Modify (Angular)

- `packages/docs/src/app/app.config.ts` — add `provideHttpClient()` and `provideTimeago()`
- `packages/docs/src/app/app.routes.ts` — add `/changelog` route before `**`
- `packages/docs/src/app/left-sidebar.component.ts` — add static Changelog nav link
- `packages/docs/package.json` — add `ngx-timeago` dependency

---

## Task 1: Clean up placeholder content

**Files:**

- Delete: `packages/docs/src/content/features.md`
- Delete: `packages/docs/src/content/architecture.md`
- Delete: `packages/docs/src/content/ipc-reference.md`
- Delete: `packages/docs/src/content/development.md`
- Delete: `packages/docs/src/content/01-getting-started/` (folder)
- Delete: `packages/docs/src/content/02-lorem-ipsum/` (folder)

- [ ] **Step 1: Delete placeholder files and folders**

```bash
cd packages/docs/src/content
rm features.md architecture.md ipc-reference.md development.md
rm -rf 01-getting-started 02-lorem-ipsum
```

- [ ] **Step 2: Verify the docs dev server still starts without errors**

```bash
npm run docs:dev
```

Expected: Dev server starts. The left sidebar shows only "Home". No console errors about missing files.

- [ ] **Step 3: Commit**

```bash
git add -A packages/docs/src/content/
git commit -m "#74: remove placeholder docs content"
```

---

## Task 2: Rewrite the homepage

**Files:**

- Rewrite: `packages/docs/src/content/index.md`

- [ ] **Step 1: Replace `packages/docs/src/content/index.md` with this content**

```markdown
---
title: 'Home'
order: 0
slug: 'index'
---

# BitButler Documentation

BitButler is a desktop application for managing remote
[qBittorrent-nox](<https://github.com/qbittorrent/qBittorrent/wiki/Running-qBittorrent-without-X-server-(WebUI-only,-daemon-mode,-no-X-deps)>)
instances from a clean, native interface on Windows, macOS, and Linux.

## New to BitButler?

Start with the Getting Started guide:

1. [Installation](./getting-started/installation) — download and install the app
2. [Adding your first server](./getting-started/adding-your-first-server) — connect to a qBittorrent instance
3. [Logging in](./getting-started/logging-in) — select a server and connect
4. [Adding your first torrent](./getting-started/adding-your-first-torrent) — download something

## What's in these docs

| Section                                                    | What you'll find                                          |
| ---------------------------------------------------------- | --------------------------------------------------------- |
| [Getting Started](./getting-started/installation)          | Install, connect, and download your first torrent         |
| [Managing Servers](./managing-servers/index)               | Add, edit, remove, and switch between qBittorrent servers |
| [Adding Torrents](./adding-torrents/index)                 | From .torrent files, magnet links, and URLs               |
| [Monitoring Downloads](./monitoring-downloads/main-screen) | The main interface, filters, grid columns, and status bar |
| [Customizing the Interface](./customizing/general)         | Themes, language, grid settings, and status bar widgets   |
| [Changelog](./changelog)                                   | Release history                                           |
```

- [ ] **Step 2: Verify the homepage renders correctly in the browser**

Navigate to `http://localhost:5173` (or whatever port the dev server uses). Confirm the Home page title, intro, and table all appear. Confirm the left sidebar still shows "Home".

- [ ] **Step 3: Commit**

```bash
git add packages/docs/src/content/index.md
git commit -m "#74: rewrite docs homepage"
```

---

## Task 3: Getting Started section

**Files:**

- Create: `packages/docs/src/content/01-getting-started/installation.md`
- Create: `packages/docs/src/content/01-getting-started/adding-your-first-server.md`
- Create: `packages/docs/src/content/01-getting-started/logging-in.md`
- Create: `packages/docs/src/content/01-getting-started/adding-your-first-torrent.md`

- [ ] **Step 1: Create `packages/docs/src/content/01-getting-started/installation.md`**

````markdown
---
title: 'Installation'
order: 1
---

# Installation

Download and install BitButler on your operating system.

## System requirements

- **qBittorrent-nox** running on a reachable host with the Web UI enabled
- One of the following operating systems:
  - Windows 10 or later
  - macOS 12 (Monterey) or later
  - Linux (AppImage, DEB, RPM, Snap, or tar.gz)

## Download

Go to the [Releases page](https://github.com/enisz/bitbutler/releases) on GitHub and download
the installer for your platform:

| Platform | File to download                                   |
| -------- | -------------------------------------------------- |
| Windows  | `.exe` (NSIS installer) or `.zip` (portable)       |
| macOS    | `.dmg`                                             |
| Linux    | `.AppImage`, `.deb`, `.rpm`, `.snap`, or `.tar.gz` |

## Install

### Windows

Run the downloaded `.exe` installer and follow the prompts. The app installs to `%LOCALAPPDATA%\Programs\BitButler` by default.

For a portable install, extract the `.zip` and run `BitButler.exe` directly — no installation required.

### macOS

Open the `.dmg` file and drag BitButler to your Applications folder.

### Linux

**AppImage** — mark the file as executable and run it:

```bash
chmod +x BitButler-*.AppImage
./BitButler-*.AppImage
```
````

**DEB (Debian/Ubuntu):**

```bash
sudo dpkg -i bitbutler_*.deb
```

**RPM (Fedora/RHEL):**

```bash
sudo rpm -i bitbutler-*.rpm
```

**Snap:**

```bash
sudo snap install bitbutler_*.snap --dangerous
```

## Next step

Once BitButler is running, [add your first server](./adding-your-first-server).

````

- [ ] **Step 2: Create `packages/docs/src/content/01-getting-started/adding-your-first-server.md`**

```markdown
---
title: 'Adding Your First Server'
order: 2
---

# Adding Your First Server

Before you can manage torrents, you need to connect BitButler to a qBittorrent-nox instance.

<!-- screenshot: login-screen-overview -->
![Login screen overview](./screenshots/login-screen-overview.png)

> **Callouts:**
>
> 1. **Server dropdown** — shows the currently selected server, or "No server selected" if none exist yet
> 2. **Add server button** — opens the add server form
> 3. **Edit / Delete buttons** — modify or remove the selected server
> 4. **Check connection button** — tests whether the selected server is reachable

## What you need

Before adding a server, have the following ready:

- The **hostname or IP address** of the machine running qBittorrent-nox
- The **port** the Web UI is listening on (default: `8080`)
- Your qBittorrent **username and password**

## Steps

1. Click the **Add server** button (callout 2 above).

<!-- screenshot: add-server-form -->
![Add server form](./screenshots/add-server-form.png)

> **Callouts:**
>
> 1. **Name** — a friendly label for this server (e.g. "Home NAS")
> 2. **Host** — hostname or IP address (e.g. `192.168.1.10` or `nas.local`)
> 3. **Port** — Web UI port (default `8080`)
> 4. **Username / Password** — your qBittorrent Web UI credentials
> 5. **Use HTTPS** — enable if your qBittorrent instance uses TLS

2. Fill in the server details and click **Save**.
3. The new server appears in the dropdown. Click **Check connection** to verify it is reachable.

## Next step

With your server added, [log in](./logging-in).
````

- [ ] **Step 3: Create `packages/docs/src/content/01-getting-started/logging-in.md`**

```markdown
---
title: 'Logging In'
order: 3
---

# Logging In

Once you have added at least one server, you can log in to start managing torrents.

<!-- screenshot: login-screen-server-selected -->

![Login screen with a server selected](./screenshots/login-screen-server-selected.png)

> **Callouts:**
>
> 1. **Server dropdown** — select the server you want to connect to
> 2. **Connect button** — authenticates with the selected server and opens the main screen

## Steps

1. Open the server dropdown and select the server you want to connect to.
2. Click **Connect**.

BitButler authenticates with qBittorrent and navigates to the main screen. If authentication fails, check that your username and password are correct and that the qBittorrent Web UI is reachable.

## Switching servers

You can switch to a different server at any time from the [Managing Servers](../managing-servers/switching-servers) page.

## Next step

You are now connected. [Add your first torrent](./adding-your-first-torrent).
```

- [ ] **Step 4: Create `packages/docs/src/content/01-getting-started/adding-your-first-torrent.md`**

```markdown
---
title: 'Adding Your First Torrent'
order: 4
---

# Adding Your First Torrent

With BitButler connected to a server, you can add torrents from the toolbar.

<!-- screenshot: toolbar-add-buttons -->

![Toolbar add buttons](./screenshots/toolbar-add-buttons.png)

> **Callouts:**
>
> 1. **Add file** — opens a file picker to select a `.torrent` file on your computer
> 2. **Add link** — opens a text field to paste a magnet link or a `.torrent` URL

## From a .torrent file

1. Click the **Add file** button (callout 1 above).
2. Select a `.torrent` file from your computer.
3. The add torrent dialog opens. Confirm the save path and click **Add**.

## From a magnet link or URL

1. Click the **Add link** button (callout 2 above).
2. Paste a magnet link (e.g. `magnet:?xt=urn:btih:...`) or a direct URL to a `.torrent` file.
3. Click **Add** or press Enter.

## What happens next

The torrent appears in the grid and starts downloading according to your qBittorrent settings.

For more options when adding a torrent (save path, category, tags, sequential download), see [Torrent Options](../adding-torrents/options).
```

- [ ] **Step 5: Verify all four pages appear in the left sidebar under "Getting Started" and render correctly**

In the dev server, expand the "Getting Started" group and confirm all four pages appear and display their content.

- [ ] **Step 6: Commit**

```bash
git add packages/docs/src/content/01-getting-started/
git commit -m "#74: add Getting Started section"
```

---

## Task 4: Managing Servers section

**Files:**

- Create: `packages/docs/src/content/02-managing-servers/index.md`
- Create: `packages/docs/src/content/02-managing-servers/test-connection.md`
- Create: `packages/docs/src/content/02-managing-servers/switching-servers.md`

- [ ] **Step 1: Create `packages/docs/src/content/02-managing-servers/index.md`**

```markdown
---
title: 'Managing Servers'
order: 1
---

# Managing Servers

The login screen is where you add, edit, remove, and test qBittorrent server connections.
To return to the login screen from the main view, disconnect from the current server (see
[Switching Servers](./switching-servers)).

<!-- screenshot: login-screen-full -->

![Login screen full view](./screenshots/login-screen-full.png)

> **Callouts:**
>
> 1. **Server dropdown** — lists all saved servers; select one to make it active
> 2. **Add button** — opens the add server form
> 3. **Edit button** — opens the edit form for the currently selected server
> 4. **Delete button** — removes the selected server (cannot be undone)
> 5. **Check connection button** — tests whether the selected server is currently reachable
> 6. **Connect button** — logs in to the selected server and opens the main screen

## Adding a server

Click **Add** to open the server form. Fill in:

| Field     | Description                                                   |
| --------- | ------------------------------------------------------------- |
| Name      | A friendly label (e.g. "Home NAS", "VPS")                     |
| Host      | Hostname or IP address of the machine running qBittorrent-nox |
| Port      | Web UI port (default: `8080`)                                 |
| Username  | qBittorrent Web UI username                                   |
| Password  | qBittorrent Web UI password                                   |
| Use HTTPS | Enable if the Web UI is behind TLS                            |

Click **Save** to store the server. Passwords are encrypted using the operating system's
secure storage (Keychain on macOS, DPAPI on Windows, libsecret on Linux).

## Editing a server

Select a server in the dropdown, then click **Edit**. Update any fields and click **Save**.

## Deleting a server

Select a server and click **Delete**. The server is removed immediately — there is no undo.
```

- [ ] **Step 2: Create `packages/docs/src/content/02-managing-servers/test-connection.md`**

```markdown
---
title: 'Testing a Connection'
order: 2
---

# Testing a Connection

Use the **Check connection** button on the login screen to verify that BitButler can reach a server
before logging in.

<!-- screenshot: check-connection-result -->

![Check connection result](./screenshots/check-connection-result.png)

> **Callouts:**
>
> 1. **Check connection button** — click to test the selected server
> 2. **Result indicator** — shows success (green) or failure (red) with a brief message

## What the check verifies

The check sends an authentication request to the qBittorrent Web UI. It confirms that:

- The host and port are reachable from your machine
- The username and password are accepted by qBittorrent

## Common failure reasons

| Symptom               | Likely cause                                                 |
| --------------------- | ------------------------------------------------------------ |
| "Connection refused"  | Wrong port, or qBittorrent-nox is not running                |
| "Network unreachable" | Wrong host, VPN not connected, or firewall blocking the port |
| "Unauthorized"        | Wrong username or password                                   |
| Timeout               | Host is unreachable or behind a firewall                     |
```

- [ ] **Step 3: Create `packages/docs/src/content/02-managing-servers/switching-servers.md`**

```markdown
---
title: 'Switching Servers'
order: 3
---

# Switching Servers

You can disconnect from the current server and connect to a different one without closing the app.

## Disconnect and go back to the login screen

<!-- screenshot: disconnect-menu -->

![Disconnect option in the window menu](./screenshots/disconnect-menu.png)

> **Callouts:**
>
> 1. **Application menu** — the system menu bar (or the hamburger menu on Windows/Linux)
> 2. **Disconnect option** — logs out and returns to the login screen

Use **File → Disconnect** (or the equivalent in your OS's application menu) to log out of the
current server. You return to the login screen where you can select a different server.

## Connect to a different server

On the login screen, open the server dropdown, select a different server, and click **Connect**.
```

- [ ] **Step 4: Verify all three pages appear under "Managing Servers" in the left sidebar**

- [ ] **Step 5: Commit**

```bash
git add packages/docs/src/content/02-managing-servers/
git commit -m "#74: add Managing Servers section"
```

---

## Task 5: Adding Torrents section

**Files:**

- Create: `packages/docs/src/content/03-adding-torrents/index.md`
- Create: `packages/docs/src/content/03-adding-torrents/magnet-link.md`
- Create: `packages/docs/src/content/03-adding-torrents/options.md`

- [ ] **Step 1: Create `packages/docs/src/content/03-adding-torrents/index.md`**

```markdown
---
title: 'From a .torrent File'
order: 1
---

# Adding a Torrent from a File

Click the **Add file** button in the toolbar to add a torrent from a `.torrent` file stored on your computer.

<!-- screenshot: toolbar-add-file -->

![Add file button in the toolbar](./screenshots/toolbar-add-file.png)

> **Callouts:**
>
> 1. **Add file button** — click to open the file picker

## Steps

1. Click the **Add file** button.
2. A file picker opens. Navigate to and select a `.torrent` file.
3. The [Add Torrent dialog](./options) opens, pre-filled with information from the file.
4. Review the options and click **Add**.

The torrent is sent to qBittorrent and appears in the grid.

## After adding

The torrent starts in whatever state your qBittorrent settings specify (usually downloading immediately).
You can pause it right away from the grid if you want to configure it further before it starts.
```

- [ ] **Step 2: Create `packages/docs/src/content/03-adding-torrents/magnet-link.md`**

```markdown
---
title: 'From a Magnet Link or URL'
order: 2
---

# Adding a Torrent from a Magnet Link or URL

Click the **Add link** button in the toolbar to add a torrent from a magnet link or a direct URL to a `.torrent` file.

<!-- screenshot: toolbar-add-link -->

![Add link button in the toolbar](./screenshots/toolbar-add-link.png)

> **Callouts:**
>
> 1. **Add link button** — click to open the URL input

## Steps

1. Click the **Add link** button.
2. Paste a magnet link (e.g. `magnet:?xt=urn:btih:...`) or a direct URL to a `.torrent` file.
3. Click **Add** or press Enter.
4. The [Add Torrent dialog](./options) opens.
5. Review the options and click **Add**.

## Magnet links vs. URLs

| Type         | Example                            | Notes                                                    |
| ------------ | ---------------------------------- | -------------------------------------------------------- |
| Magnet link  | `magnet:?xt=urn:btih:abc123...`    | No file needed; qBittorrent fetches metadata from peers  |
| .torrent URL | `https://example.com/file.torrent` | BitButler downloads the file and sends it to qBittorrent |
```

- [ ] **Step 3: Create `packages/docs/src/content/03-adding-torrents/options.md`**

```markdown
---
title: 'Torrent Options'
order: 3
---

# Torrent Options

When you add a torrent (from a file or a link), the Add Torrent dialog opens so you can review and
configure the download before it starts.

<!-- screenshot: add-torrent-dialog -->

![Add torrent dialog](./screenshots/add-torrent-dialog.png)

> **Callouts:**
>
> 1. **Torrent name** — the name of the torrent (read-only, from the .torrent metadata)
> 2. **Save path** — the directory on the remote server where files will be saved
> 3. **Category** — an optional category label (must already exist in qBittorrent)
> 4. **Tags** — optional comma-separated tags
> 5. **Sequential download** — download pieces in order (useful for previewing media before the download completes)
> 6. **Skip hash check** — skip the integrity check on existing files (use if you already have the files)
> 7. **Add button** — sends the torrent to qBittorrent

## Save path

The save path is the directory on the **remote server** (not your local machine) where qBittorrent
will store the downloaded files. Click the folder icon to browse paths that already exist on the server,
or type a new path directly.

## Category

Assigns the torrent to a qBittorrent category. Categories must already exist in qBittorrent —
BitButler does not create new categories from this dialog.

## Tags

A comma-separated list of tags to assign to the torrent. Tags are created automatically if they
do not already exist.

## Sequential download

When enabled, qBittorrent downloads pieces from the beginning of the file to the end, rather than
in random order. Useful if you want to start watching a video before the download is complete.
Slightly less efficient for overall download speed.

## Skip hash check

When enabled, qBittorrent skips verifying the integrity of any existing files at the save path.
Use this when you already have a partial or complete copy of the files and want to avoid re-checking.
```

- [ ] **Step 4: Verify all three pages appear under "Adding Torrents" in the left sidebar**

- [ ] **Step 5: Commit**

```bash
git add packages/docs/src/content/03-adding-torrents/
git commit -m "#74: add Adding Torrents section"
```

---

## Task 6: Monitoring Downloads section

**Files:**

- Create: `packages/docs/src/content/04-monitoring-downloads/main-screen.md`
- Create: `packages/docs/src/content/04-monitoring-downloads/torrent-grid.md`
- Create: `packages/docs/src/content/04-monitoring-downloads/filtering.md`
- Create: `packages/docs/src/content/04-monitoring-downloads/status-bar.md`
- Create: `packages/docs/src/content/04-monitoring-downloads/actions.md`

- [ ] **Step 1: Create `packages/docs/src/content/04-monitoring-downloads/main-screen.md`**

```markdown
---
title: 'Main Screen'
order: 1
---

# Main Screen

The main screen is the heart of BitButler. It shows all torrents on the connected server and
gives you access to every management action.

<!-- screenshot: main-screen-overview -->

![Main screen overview](./screenshots/main-screen-overview.png)

> **Callouts:**
>
> 1. **Toolbar** — action buttons (add, pause, resume, delete) and the search bar
> 2. **Left sidebar** — filters by status, tracker, and save path
> 3. **Torrent grid** — the main list of all torrents with columns for progress, speed, ETA, and more
> 4. **Status bar** — real-time statistics from the connected server

## Toolbar

The toolbar sits at the top. It always shows the **Add file** and **Add link** buttons and the
**search bar**. When you select one or more torrents in the grid, additional action buttons appear
(Pause, Resume, Stop, Delete).

## Left sidebar

The left sidebar lets you narrow down what appears in the grid. See [Filtering](./filtering)
for a full walkthrough.

## Torrent grid

The grid shows all torrents matching the current filter. Columns are fully customizable —
see [Torrent Grid](./torrent-grid) for details on available columns and how to configure them.

## Status bar

The status bar at the bottom shows live data from qBittorrent: speeds, free space, session stats,
and connection status. Each widget can be repositioned or hidden in
[Settings → Status Bar](../customizing/status-bar).
```

- [ ] **Step 2: Create `packages/docs/src/content/04-monitoring-downloads/torrent-grid.md`**

```markdown
---
title: 'Torrent Grid'
order: 2
---

# Torrent Grid

The torrent grid lists all torrents on the server. Columns are sortable, resizable, and fully
configurable.

<!-- screenshot: torrent-grid-columns -->

![Torrent grid with column labels](./screenshots/torrent-grid-columns.png)

> **Callouts:**
>
> 1. **Name** — the torrent name; click to sort alphabetically
> 2. **Progress bar** — visual download progress
> 3. **Size** — total size of the torrent
> 4. **Download speed / Upload speed** — current transfer rates
> 5. **ETA** — estimated time to completion
> 6. **Ratio** — upload-to-download ratio

## Available columns

The default view shows a curated set of columns. Many more are available — add or remove them in
[Settings → Torrent Grid](../customizing/torrent-grid).

| Column         | Shows                               |
| -------------- | ----------------------------------- |
| Name           | Torrent name                        |
| Progress       | Download progress (visual bar)      |
| Size           | Total size                          |
| Downloaded     | Bytes downloaded so far             |
| Uploaded       | Bytes uploaded so far               |
| Download speed | Current download rate               |
| Upload speed   | Current upload rate                 |
| ETA            | Estimated completion time           |
| Ratio          | Share ratio (uploaded ÷ downloaded) |
| Added on       | Date the torrent was added          |
| Save path      | Download location on the server     |
| Category       | qBittorrent category                |
| Tags           | Assigned tags                       |
| Seeds          | Number of seeders                   |
| Peers          | Number of peers                     |
| State          | Raw qBittorrent state code          |
| Hash           | Torrent info hash                   |

## Sorting

Click any column header to sort by that column. Click again to reverse the sort order.

## Row double-click

Double-clicking a torrent row opens a configurable action. You can set it to open the
Details panel, open the save path in your file manager, or do nothing. Change this in
[Settings → Torrent Grid](../customizing/torrent-grid).

## Pinned torrents

Right-click a torrent and choose **Pin to top** or **Pin to bottom** to keep it visible
regardless of the current sort order.
```

- [ ] **Step 3: Create `packages/docs/src/content/04-monitoring-downloads/filtering.md`**

```markdown
---
title: 'Filtering and Searching'
order: 3
---

# Filtering and Searching

The left sidebar and the search bar let you narrow the torrent grid to exactly what you want to see.

<!-- screenshot: sidebar-filters-overview -->

![Left sidebar filters](./screenshots/sidebar-filters-overview.png)

> **Callouts:**
>
> 1. **Status filters** — filter by torrent state (All, Downloading, Completed, Active, etc.)
> 2. **Tracker filters** — filter by tracker host
> 3. **Save path filters** — filter by download location on the server

## Status filters

Click a status label to show only torrents in that state:

| Filter      | Shows                                             |
| ----------- | ------------------------------------------------- |
| All         | Every torrent                                     |
| Downloading | Torrents actively downloading                     |
| Completed   | Fully downloaded torrents                         |
| Active      | Torrents currently transferring data (up or down) |
| Inactive    | Torrents not currently transferring               |
| Stopped     | Manually stopped torrents                         |
| Checking    | Torrents being hash-checked                       |
| Errored     | Torrents in an error state                        |

The number next to each label shows how many torrents are in that state.

## Tracker filters

The tracker section lists each unique tracker hostname. Click a tracker to show only
torrents using that tracker.

## Save path filters

The save path section lists each unique download directory on the server. Click a path to show
only torrents downloading to that location.

## Search

<!-- screenshot: search-bar -->

![Search bar](./screenshots/search-bar.png)

> **Callouts:**
>
> 1. **Search input** — type to filter torrents by name in real time
> 2. **Keyboard shortcut** — press Ctrl+F (or Cmd+F on macOS) to focus the search bar

Type in the search bar to instantly filter the grid to torrents whose names contain the search term.
The status and sidebar filters remain active alongside the search — all active filters combine.

Press **Escape** to clear the search.
```

- [ ] **Step 4: Create `packages/docs/src/content/04-monitoring-downloads/status-bar.md`**

```markdown
---
title: 'Status Bar'
order: 4
---

# Status Bar

The status bar at the bottom of the main screen shows real-time statistics from the connected
qBittorrent server.

<!-- screenshot: status-bar-overview -->

![Status bar with widget labels](./screenshots/status-bar-overview.png)

> **Callouts:**
>
> 1. **Connection status** — green when connected, red when disconnected
> 2. **DHT nodes** — number of nodes in the DHT network
> 3. **Global ratio** — session-wide upload-to-download ratio
> 4. **Global downloaded / uploaded** — total session transfer totals
> 5. **Download speed / Upload speed** — current global transfer rates
> 6. **Free space** — available disk space on the server
> 7. **Polling indicator** — flashes when BitButler is fetching an update from qBittorrent

## Widgets

Each piece of information in the status bar is a **widget**. You can add, remove, and reposition
widgets in [Settings → Status Bar](../customizing/status-bar).

| Widget            | What it shows                                 |
| ----------------- | --------------------------------------------- |
| connection-status | Connected / disconnected indicator            |
| nodes             | DHT node count                                |
| ratio             | Global session ratio                          |
| global-down       | Total data downloaded this session            |
| global-up         | Total data uploaded this session              |
| download-speed    | Current download speed                        |
| upload-speed      | Current upload speed                          |
| free-space        | Free disk space on the server                 |
| session-stats     | Summary of session statistics                 |
| selection         | Info about currently selected torrents        |
| polling-indicator | Visual pulse when a data fetch is in progress |
```

- [ ] **Step 5: Create `packages/docs/src/content/04-monitoring-downloads/actions.md`**

```markdown
---
title: 'Actions'
order: 5
---

# Actions

Manage torrents from the toolbar buttons and the right-click context menu.

## Toolbar actions

Select one or more torrents in the grid to reveal action buttons in the toolbar.

<!-- screenshot: toolbar-contextual-actions -->

![Toolbar with contextual action buttons visible](./screenshots/toolbar-contextual-actions.png)

> **Callouts:**
>
> 1. **Resume** — resume a paused or stopped torrent
> 2. **Pause** — pause the selected torrent(s)
> 3. **Stop** — stop the selected torrent(s) (removes from active queue)
> 4. **Resume All** — resume all torrents on the server
> 5. **Pause All** — pause all torrents on the server
> 6. **Delete** — remove the selected torrent(s); prompts whether to also delete files

## Context menu

Right-click any torrent row to open the context menu.

<!-- screenshot: torrent-context-menu -->

![Torrent context menu](./screenshots/torrent-context-menu.png)

> **Callouts:**
>
> 1. **Resume / Pause / Stop** — state controls
> 2. **Force resume** — resume even if the torrent has hit a ratio or seed-time limit
> 3. **Recheck** — trigger a hash check to verify file integrity
> 4. **Reannounce** — re-announce to all trackers immediately
> 5. **Open save path** — open the torrent's save directory in your file manager (requires [path mapping](../customizing/server) if the server is remote)
> 6. **Pin to top / Pin to bottom** — keep the torrent visible regardless of sort order
> 7. **Delete** — remove with an option to delete files

## Deleting torrents

When you delete a torrent (from the toolbar or context menu), BitButler asks whether to also
delete the downloaded files from the server. Deleting files is permanent and cannot be undone.
```

- [ ] **Step 6: Verify all five pages appear under "Monitoring Downloads"**

- [ ] **Step 7: Commit**

```bash
git add packages/docs/src/content/04-monitoring-downloads/
git commit -m "#74: add Monitoring Downloads section"
```

---

## Task 7: Customizing the Interface section

**Files:**

- Create: `packages/docs/src/content/05-customizing/general.md`
- Create: `packages/docs/src/content/05-customizing/server.md`
- Create: `packages/docs/src/content/05-customizing/torrent-grid.md`
- Create: `packages/docs/src/content/05-customizing/status-bar.md`

- [ ] **Step 1: Open Settings by clicking the gear icon in the toolbar to familiarize yourself with the UI before writing**

(This step is a reminder to look at the actual UI — no code change.)

- [ ] **Step 2: Create `packages/docs/src/content/05-customizing/general.md`**

```markdown
---
title: 'General Settings'
order: 1
---

# General Settings

Open **Settings → General** to configure the app's appearance, language, and behavior.

<!-- screenshot: settings-general -->

![General settings tab](./screenshots/settings-general.png)

> **Callouts:**
>
> 1. **Theme family** — the color palette (8 built-in themes)
> 2. **Theme mode** — Light, Dark, or System (follows OS preference)
> 3. **Language** — UI language selector
> 4. **Delete .torrent file** — auto-delete the local file after adding to qBittorrent
> 5. **Check for updates** — check GitHub for new releases on startup
> 6. **Toast position** — corner where notification pop-ups appear

## Appearance

### Theme family

Choose one of eight built-in color palettes:

| Theme         | Character                 |
| ------------- | ------------------------- |
| BitButler     | Default blue-grey palette |
| Aurora        | Purple and pink tones     |
| Mint Green    | Fresh greens              |
| Purple Haze   | Deep purples              |
| Ocean Breeze  | Cool teals and blues      |
| Pumpkin Spice | Warm oranges              |
| Deep Sea      | Dark navy blues           |
| Crimson Ember | Reds and dark tones       |

### Theme mode

| Mode   | Behavior                                           |
| ------ | -------------------------------------------------- |
| Light  | Always use the light variant of the selected theme |
| Dark   | Always use the dark variant                        |
| System | Match the operating system's light/dark setting    |

## Language

Switches the language of all UI text. Currently supported: **English** and **Hungarian**.
Changing the language takes effect immediately and also updates the system tray menu
and application menu labels.

## Behavior

### Delete .torrent file after adding

When enabled, BitButler deletes the local `.torrent` file from your computer after it has been
successfully sent to qBittorrent. Disabled by default.

### Check for updates automatically

When enabled, BitButler checks GitHub for a newer release each time the app starts and shows
a notification if one is available. Enabled by default.

### Toast position

Controls which corner of the screen notification toasts appear in.

| Option       | Position                     |
| ------------ | ---------------------------- |
| Top left     | Upper-left corner            |
| Top right    | Upper-right corner           |
| Bottom right | Lower-right corner (default) |
| Bottom left  | Lower-left corner            |
```

- [ ] **Step 3: Create `packages/docs/src/content/05-customizing/server.md`**

```markdown
---
title: 'Server Settings'
order: 2
---

# Server Settings

Open **Settings → Server** to configure polling intervals and path mappings for the
currently connected server.

<!-- screenshot: settings-server -->

![Server settings tab](./screenshots/settings-server.png)

> **Callouts:**
>
> 1. **Foreground polling interval** — how often (in ms) the app fetches data when the window is focused
> 2. **Background polling interval** — how often (in ms) the app fetches data when the window is in the background
> 3. **Path mappings list** — maps remote server paths to local file system paths
> 4. **Add mapping button** — adds a new path mapping row

## Polling

BitButler continuously syncs with qBittorrent in the background.

| Setting             | Default | Effect                                                    |
| ------------------- | ------- | --------------------------------------------------------- |
| Foreground interval | 2000 ms | Fetch frequency when you are actively using the app       |
| Background interval | 5000 ms | Fetch frequency when the window is minimized or unfocused |

Lowering these values gives more up-to-date information but increases load on the qBittorrent server.
Values below 500 ms are not recommended.

## Path mappings

Path mappings are used when you **open a torrent's save path** in your local file manager.
Because qBittorrent runs on a remote server, its paths (e.g. `/data/downloads`) are not directly
accessible from your computer. A path mapping tells BitButler how to translate a remote path
to an equivalent local path (e.g. a network share mounted at `Z:\downloads` on Windows or
`/mnt/nas/downloads` on Linux).

### Adding a mapping

1. Click **Add mapping**.
2. Enter the **remote path** — the path as qBittorrent reports it (e.g. `/data/downloads`).
3. Enter the **local path** — the equivalent path on your computer.
4. Click **Test** to verify the local path exists and is accessible.

### Tips

- Use the **Browse** button to pick the local path from a file picker.
- Existing torrent save paths are shown as suggestions to help you identify what to map.
- You can add multiple mappings for different directories.
```

- [ ] **Step 4: Create `packages/docs/src/content/05-customizing/torrent-grid.md`**

```markdown
---
title: 'Torrent Grid Settings'
order: 3
---

# Torrent Grid Settings

Open **Settings → Torrent Grid** to configure which columns appear in the grid, their order,
and how the grid behaves.

<!-- screenshot: settings-torrent-grid -->

![Torrent grid settings tab](./screenshots/settings-torrent-grid.png)

> **Callouts:**
>
> 1. **Column selector** — multi-select dropdown to choose which columns are visible
> 2. **Column order list** — drag rows to reorder columns in the grid
> 3. **Pagination toggle** — switch between infinite scroll and paginated view
> 4. **Animate rows toggle** — enable/disable row animations on data updates
> 5. **Row double-click action** — what happens when you double-click a torrent row

## Columns

### Choosing columns

Open the **column selector** dropdown and check the columns you want to show. Uncheck any you
want to hide. The grid updates as soon as you save.

### Reordering columns

In the **column order list**, drag a row up or down to change where that column appears in the grid.

### Available columns

| Column         | Default | Description               |
| -------------- | ------- | ------------------------- |
| Name           | ✓       | Torrent name              |
| Progress       | ✓       | Download progress bar     |
| Size           | ✓       | Total size                |
| Downloaded     | ✓       | Bytes downloaded          |
| Uploaded       | ✓       | Bytes uploaded            |
| Download speed | ✓       | Current download rate     |
| Upload speed   | ✓       | Current upload rate       |
| ETA            | ✓       | Estimated completion time |
| Ratio          | ✓       | Upload/download ratio     |
| Added on       | ✓       | Date added                |
| Save path      | ✓       | Download location         |
| Category       | —       | qBittorrent category      |
| Tags           | —       | Assigned tags             |
| Seeds          | —       | Seeder count              |
| Peers          | —       | Peer count                |
| State          | —       | Raw qBittorrent state     |
| Hash           | —       | Torrent info hash         |

## Pagination

| Setting       | Behavior                                                           |
| ------------- | ------------------------------------------------------------------ |
| Off (default) | The grid shows all torrents in one scrollable list                 |
| On            | Torrents are split into pages; page controls appear below the grid |

## Animate rows

When enabled, rows in the grid animate when they are updated (e.g. progress changes). Disabling
this can improve performance if you have a large number of torrents.

## Row double-click action

Controls what happens when you double-click a torrent row:

| Option    | Behavior                                                                                                                    |
| --------- | --------------------------------------------------------------------------------------------------------------------------- |
| Details   | Opens the torrent details panel                                                                                             |
| Save path | Opens the torrent's save directory in your local file manager (requires a [path mapping](./server) if the server is remote) |
| None      | Double-click does nothing                                                                                                   |
```

- [ ] **Step 5: Create `packages/docs/src/content/05-customizing/status-bar.md`**

```markdown
---
title: 'Status Bar Settings'
order: 4
---

# Status Bar Settings

Open **Settings → Status Bar** to choose which widgets appear in the status bar and where
they are positioned.

<!-- screenshot: settings-status-bar -->

![Status bar settings tab](./screenshots/settings-status-bar.png)

> **Callouts:**
>
> 1. **Available** — pool of widgets not currently shown in the status bar
> 2. **Left zone** — widgets displayed on the left side of the status bar
> 3. **Right zone** — widgets displayed on the right side of the status bar

## How it works

The settings panel has three drag-and-drop zones:

- **Available** — widgets that are hidden
- **Left** — widgets shown on the left side of the status bar
- **Right** — widgets shown on the right side of the status bar

Drag a widget from one zone to another to move it. The status bar updates as soon as you save.

## Available widgets

| Widget            | What it shows                                          |
| ----------------- | ------------------------------------------------------ |
| connection-status | Green/red indicator for server connectivity            |
| nodes             | Number of DHT nodes                                    |
| ratio             | Session-wide upload/download ratio                     |
| global-down       | Total data downloaded this session                     |
| global-up         | Total data uploaded this session                       |
| download-speed    | Current global download speed                          |
| upload-speed      | Current global upload speed                            |
| free-space        | Available disk space on the server                     |
| session-stats     | Summary of session statistics                          |
| selection         | Info about the currently selected torrents in the grid |
| polling-indicator | Pulses when the app is fetching data from qBittorrent  |

## Default layout

| Zone               | Widgets (left to right)                                     |
| ------------------ | ----------------------------------------------------------- |
| Left               | connection-status, nodes, ratio, global-down, global-up     |
| Right              | download-speed, upload-speed, free-space, polling-indicator |
| Available (hidden) | selection                                                   |
```

- [ ] **Step 6: Verify all four pages appear under "Customizing" in the left sidebar**

- [ ] **Step 7: Commit**

```bash
git add packages/docs/src/content/05-customizing/
git commit -m "#74: add Customizing the Interface section"
```

---

## Task 8: Changelog page (Angular component)

**Files:**

- Modify: `packages/docs/package.json`
- Modify: `packages/docs/src/app/app.config.ts`
- Create: `packages/docs/src/app/pages/changelog-page.component.ts`
- Modify: `packages/docs/src/app/app.routes.ts`
- Modify: `packages/docs/src/app/left-sidebar.component.ts`

**Context:**

- The `RightSidebarComponent` already uses a `MutationObserver` on `.content-area` — it will auto-rebuild the TOC when the changelog headings appear in the DOM. No extra wiring is needed.
- The `<main class="docs-main content-area">` in `app.ts` is the element that wraps the router outlet, so every component rendered by the router is inside `.content-area` automatically.
- `ngx-timeago` is already installed at the monorepo root (`node_modules/ngx-timeago`). Adding it to `packages/docs/package.json` makes the dependency explicit.
- `marked` is already configured globally by `ContentService` (which runs eagerly) — calling `marked.parse()` in the changelog component will use that configuration including syntax highlighting.

- [ ] **Step 1: Add `ngx-timeago` to `packages/docs/package.json`**

In `packages/docs/package.json`, add `"ngx-timeago": "^4.1.0"` to the `dependencies` object:

```json
"dependencies": {
  "@analogjs/content": "^2.5.0",
  "@angular/common": "^20.3.0",
  "@angular/core": "^20.3.0",
  "@angular/platform-browser": "^20.3.0",
  "@angular/router": "^20.3.0",
  "front-matter": "^4.0.2",
  "fuse.js": "^7.3.0",
  "highlight.js": "^11.0.0",
  "marked": "^18.0.3",
  "marked-gfm-heading-id": "^4.1.4",
  "marked-highlight": "^2.0.0",
  "marked-mangle": "^1.1.13",
  "ngx-timeago": "^4.1.0",
  "rxjs": "~7.8.0",
  "tslib": "^2.3.0",
  "zone.js": "~0.15.0"
}
```

- [ ] **Step 2: Update `packages/docs/src/app/app.config.ts`**

Add `provideHttpClient` and `provideTimeago`. The full file becomes:

```typescript
import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideContent, withMarkdownRenderer } from '@analogjs/content';
import { provideTimeago } from 'ngx-timeago';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideContent(withMarkdownRenderer()),
    provideHttpClient(),
    provideTimeago(),
  ],
};
```

- [ ] **Step 3: Create `packages/docs/src/app/pages/changelog-page.component.ts`**

```typescript
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { TimeagoPipe } from 'ngx-timeago';

interface GithubRelease {
  id: number;
  tag_name: string;
  published_at: string;
  body: string | null;
  html_url: string;
}

interface Release {
  id: number;
  tagName: string;
  publishedAt: string;
  bodyHtml: SafeHtml;
  url: string;
}

@Component({
  selector: 'bb-changelog-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TimeagoPipe],
  template: `
    <div class="changelog-content">
      @if (loading()) {
        <p class="changelog-loading">Loading release history...</p>
      } @else if (error()) {
        <p class="changelog-error">
          Could not load release history.
          <a href="https://github.com/enisz/bitbutler/releases" target="_blank" rel="noopener">
            View on GitHub
          </a>
        </p>
      } @else {
        @for (release of releases(); track release.id) {
          <h2>
            {{ release.tagName }} &mdash;
            {{ release.publishedAt | date: 'MMM d, yyyy' }}
            ({{ release.publishedAt | timeago }})
          </h2>
          <div class="markdown-body" [innerHTML]="release.bodyHtml"></div>
        }
      }
    </div>
  `,
  styles: [
    `
      .changelog-content {
        padding: 1.5rem;
        max-width: 860px;
      }
      .changelog-loading,
      .changelog-error {
        color: var(--bs-secondary-color);
        padding: 2rem 0;
      }
    `,
  ],
})
export class ChangelogPageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly doc = inject(DOCUMENT);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly releases = signal<Release[]>([]);

  ngOnInit(): void {
    this.doc.defaultView?.scrollTo({ top: 0 });

    this.http
      .get<GithubRelease[]>('https://api.github.com/repos/enisz/bitbutler/releases')
      .subscribe({
        next: (data) => {
          this.releases.set(
            data.map((r) => ({
              id: r.id,
              tagName: r.tag_name,
              publishedAt: r.published_at,
              bodyHtml: this.sanitizer.bypassSecurityTrustHtml(String(marked.parse(r.body ?? ''))),
              url: r.html_url,
            })),
          );
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }
}
```

- [ ] **Step 4: Add the `/changelog` route to `packages/docs/src/app/app.routes.ts`**

The route must come before the `**` catch-all or it will never match. Full file:

```typescript
import { Routes } from '@angular/router';
import { ChangelogPageComponent } from './pages/changelog-page.component';
import { DocPageComponent } from './pages/doc-page.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'index',
    pathMatch: 'full',
  },
  {
    path: 'changelog',
    component: ChangelogPageComponent,
  },
  {
    path: '**',
    component: DocPageComponent,
  },
];
```

- [ ] **Step 5: Add a static Changelog nav link to `packages/docs/src/app/left-sidebar.component.ts`**

The left sidebar builds its nav from `ContentService.files` (markdown only), so the changelog route won't appear automatically. Add a hardcoded link at the bottom of the `<nav>` template.

Find this block in the template (the closing `</nav>` tag at the end of the `template` string):

```html
    </nav>
  `,
```

Replace it with:

```html
      <a
        class="sidebar-nav-link"
        routerLink="/changelog"
        routerLinkActive="active"
        [routerLinkActiveOptions]="{ exact: true }"
        >Changelog</a
      >
    </nav>
  `,
```

- [ ] **Step 6: Verify the changelog page works end-to-end**

1. Start the dev server: `npm run docs:dev`
2. Navigate to `http://localhost:5173/changelog`
3. Confirm:
   - "Loading release history..." briefly appears
   - Releases render with `h2` headings in format `v1.1.1 — May 6, 2026 (3 days ago)`
   - The right sidebar shows a TOC with one entry per release
   - The markdown body of each release renders with formatting
   - "Changelog" appears in the left sidebar nav and is highlighted as active

- [ ] **Step 7: Run lint**

```bash
npm run lint
```

Expected: zero warnings, zero errors.

- [ ] **Step 8: Commit**

```bash
git add packages/docs/package.json \
        packages/docs/src/app/app.config.ts \
        packages/docs/src/app/app.routes.ts \
        packages/docs/src/app/left-sidebar.component.ts \
        packages/docs/src/app/pages/changelog-page.component.ts
git commit -m "#74: add Changelog page with GitHub Releases API"
```

---

## Self-Review Notes

**Spec coverage check:**

- ✓ End users only — no developer content
- ✓ Six task-oriented sections
- ✓ Screenshot placeholder convention (`<!-- screenshot: id -->` + broken image + callout list)
- ✓ Numbered callouts described for every screenshot placeholder
- ✓ All four settings tabs fully documented
- ✓ Changelog: client-side GitHub fetch, `TimeagoPipe`, `marked`, right sidebar TOC
- ✓ Homepage rewritten with links to all sections
- ✓ Old placeholder files removed
- ✓ English only, always-latest

**Placeholder scan:** No TBD or TODO in any step. All markdown content is complete. All code blocks are complete.

**Type consistency:** `GithubRelease.tag_name` → `Release.tagName`, `GithubRelease.published_at` → `Release.publishedAt`. Used consistently through the component. `Release.bodyHtml` is `SafeHtml` throughout.
