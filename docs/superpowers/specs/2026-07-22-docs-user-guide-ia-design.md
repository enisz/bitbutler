# Docs Site: User Guide IA Restructure - Design

## Goal

Restructure `@bitbutler/docs` around a user-facing "User Guide" identity and a
new `Introduction / Usage / User Interface / Reference` sidebar taxonomy, and
scaffold the skeleton pages needed to eventually give every screen/dialog in
the app its own reference page. This design only produces the information
architecture and skeleton pages (placeholder text/images, matching the
existing Lorem-ipsum + placehold.co convention) - it does not write final
content for the new pages. Existing pages with real content are relocated,
not rewritten.

Out of scope (explicitly excluded by the user from the source sketch): a
"Features" overview section describing the torrent view and torrent
import/export as product features. Not part of this pass.

## Site rebranding

In `packages/docs/docs/.vitepress/config.ts`:

- `title`: `'BitButler Docs'` -> `'BitButler User Guide'`
- `nav`: `'Guide'` -> `'User Guide'` (text only; link target unchanged)

The npm package/folder name stays `@bitbutler/docs` / `packages/docs` - this
is cosmetic branding on the rendered site only, not a package rename.

## New sidebar taxonomy

Replaces `Introduction / Usage / Advanced / Reference` with
`Introduction / Usage / User Interface / Reference`. "Advanced" is dissolved:
its Configuration pages move into User Interface (they're screen-by-screen
reference material, not "advanced" topics), and Troubleshooting moves into
Reference.

- **Introduction** - unchanged: Getting Started, Why BitButler
- **Usage** - narrative/task-oriented only; links out to User Interface pages
  instead of duplicating their content
  - First Steps _(new)_
  - Managing Torrents _(trimmed)_
- **User Interface** _(new)_ - one reference page per screen/dialog
  - Login Page _(new)_
  - Torrent List View _(new)_
  - Export Window _(new)_
  - Import Window _(new)_
  - Torrent Details View _(new)_
  - Settings
    - BitButler Settings _(relocated, content unchanged)_
    - qBittorrent Settings _(relocated, content unchanged)_
  - Manage
    - Servers _(relocated + renamed, content unchanged)_
    - Tags _(new page, populated from existing real content)_
    - Categories _(new page, populated from existing real content)_
- **Reference**
  - FAQ, Glossary _(unchanged)_
  - Troubleshooting _(relocated from Advanced)_
  - Keyboard Shortcuts _(relocated from Usage - it's lookup material like
    FAQ/Glossary, not a task walkthrough)_

## File & navigation changes

New folders: `docs/guide/user-interface/`,
`docs/guide/user-interface/settings/`, `docs/guide/user-interface/manage/`.

| Action                   | From                                                   | To                                                                                   |
| ------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Move (content unchanged) | `guide/advanced/configuration/bitbutler-settings.md`   | `guide/user-interface/settings/bitbutler-settings.md`                                |
| Move (content unchanged) | `guide/advanced/configuration/qbittorrent-settings.md` | `guide/user-interface/settings/qbittorrent-settings.md`                              |
| Move (content unchanged) | `guide/advanced/troubleshooting.md`                    | `guide/reference/troubleshooting.md`\*                                               |
| Move + rename H1/title   | `guide/connecting-a-server.md`                         | `guide/user-interface/manage/servers.md` (title: "Connecting a Server" -> "Servers") |
| Split out (real content) | `guide/managing-torrents.md` "Categories" subsection   | `guide/user-interface/manage/categories.md` (new page)                               |
| Split out (real content) | `guide/managing-torrents.md` "Tags" subsection         | `guide/user-interface/manage/tags.md` (new page)                                     |
| Move (no rename needed)  | `guide/keyboard-shortcuts.md`                          | stays at `guide/keyboard-shortcuts.md`, only its sidebar group changes               |
| New skeleton page        | -                                                      | `guide/first-steps.md`                                                               |
| New skeleton page        | -                                                      | `guide/user-interface/login-page.md`                                                 |
| New skeleton page        | -                                                      | `guide/user-interface/torrent-list-view.md`                                          |
| New skeleton page        | -                                                      | `guide/user-interface/export-window.md`                                              |
| New skeleton page        | -                                                      | `guide/user-interface/import-window.md`                                              |
| New skeleton page        | -                                                      | `guide/user-interface/torrent-details-view.md`                                       |
| Delete (now empty)       | `guide/advanced/` folder                               | -                                                                                    |

\* `Reference` keeps FAQ/Glossary/Keyboard-Shortcuts flat at `guide/`, so
Troubleshooting also lands flat at `guide/troubleshooting.md` rather than a
new `guide/reference/` folder, keeping the convention consistent (only
User Interface gets subfolders, matching how `advanced/configuration/`
already worked).

`managing-torrents.md` keeps "Adding Torrents" and "Pausing and Resuming"
(still placeholder) and its H2 "Categories and Tags" is replaced with a short
pointer: "To organize torrents by category or tag, see
[Manage Categories](...) and [Manage Tags](...)."

All relative markdown links broken by these moves must be updated (e.g.
`bitbutler-settings.md`'s link to `../../connecting-a-server#setting-a-default-server`,
`managing-torrents.md`'s link to
`./advanced/configuration/qbittorrent-settings#save-management`).

`config.ts` `sidebar['/guide/']` is rewritten in full to the taxonomy above.

## New skeleton page structure

Each new page below gets placeholder body text (Lorem-ipsum style, matching
`getting-started.md`/`why-bitbutler.md`) and one placehold.co placeholder
image, following the exact existing convention
(`![Alt text placeholder](https://placehold.co/600x400/COLOR/COLOR?text=Label)`).
Headings are accurate now (drawn from the real components) even though body
text is placeholder - this is skeleton scaffolding, not final copy.

### `first-steps.md`

- Adding Your First Server (points to Manage > Servers)
- Connecting
- Arriving at the Torrent List (points to Torrent List View)
- Automatic `.torrent` File Handling

### `user-interface/login-page.md`

- Server Selection (host dropdown, Connect button, Add Server CTA when no
  servers exist)
- Managing Servers (points to Manage > Servers)
- Quick Settings (Language, Theme Family, Theme Mode)

### `user-interface/torrent-list-view.md`

- Toolbar (Add, Delete, Control actions, Queue actions, Settings group,
  Manage group, Search)
- Sidebar Filters (Status, Trackers, Categories, Tags, Save Paths)
- Status Bar (points to BitButler Settings > Status Bar for configuring it)

### `user-interface/export-window.md`

- Opening the Export Window (File menu)
- Connection Info
- Choosing What to Export (Torrents / Categories / Tags scope)
- Save Location
- Export Progress

### `user-interface/import-window.md`

- Opening the Import Window (File menu)
- Archive Info
- Previewing Contents
- Restore Options
- Path Remapping
- Category Path Mapping
- After Import
- Import Progress

### `user-interface/torrent-details-view.md`

- Opening Torrent Details
- General
- Trackers
- Peers
- Content
- Footer Actions (Control, Files, Manage, Transfer, Maintenance)

### `user-interface/manage/servers.md`, `manage/tags.md`, `manage/categories.md`

Real content, not placeholder - `servers.md` is the existing
`connecting-a-server.md` body verbatim with only the title/H1 changed;
`tags.md`/`categories.md` are the existing "Tags"/"Categories" subsections
from `managing-torrents.md` verbatim, promoted to their own page (H3 -> H1).

### `user-interface/settings/*`

Real content, unchanged - relocated only.

## Self-review notes

- Scope is IA + skeleton only: new pages get placeholder text/images, not
  accurate final copy. A follow-up content-writing pass (like the prior
  settings-configuration-guide effort) is expected later for each new page.
- The "Features" section from the original sketch is intentionally excluded
  per explicit user instruction.
- Link-rot from file moves is called out explicitly so the implementation
  plan doesn't miss it.
- Two naming judgment calls were made with the user's confirmation:
  renaming "Connecting a Server" to "Servers", and moving Keyboard Shortcuts
  from Usage to Reference.
