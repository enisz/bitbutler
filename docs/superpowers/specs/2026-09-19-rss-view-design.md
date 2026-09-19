# RSS view design

Issue: #337. Branch: `337-add-rss-view` (from `main`, independent of the unmerged logs view).

## Goal

A new **RSS** view, opened from the View menu, for browsing and downloading from the RSS feeds of the connected qBittorrent server. Feeds, articles, read state and refreshing all live on the qB server and are accessed through qB's `/api/v2/rss/*` API. BitButler stores nothing locally for this feature.

## Non-goals (v1)

- RSS auto-downloader rules and their preferences (`rss_auto_downloading_enabled`, `rss_smart_episode_filters`, `rss_download_repack_proper_episodes`, `rss_download_rules`).
- Creating or managing RSS folders. Feeds that live inside folders on the server are shown, flattened.
- "Mark as unread" (qB has no API for it).
- Cookie management for sites that need a login cookie (`/api/v2/app/cookies`, `setCookies`).
- Docs site update. Per CLAUDE.md this is planned when the feature has stabilized, around PR creation.

## Key facts about qB's RSS API

Verified against the API wiki (5.0) and qBittorrent source (master). The wiki does **not** document the `withData` response, so the shapes below come from `rss_feed.cpp` / `rss_article.cpp` / `rss_parser.cpp` and were **confirmed against a real qBittorrent 5.2.3 response on 2026-09-19** (see `docs/superpowers/test-env/sample-rss-items.json`). Confirmed details: unknown XML elements pass through under their local names (`category`, `contentLength` from `torrent:contentLength`, `size` from `nyaa:size`); `isRead` is absent until read; for a magnet `<link>` qB omits `link` and puts the magnet in `torrentURL`; `author` is absent when the feed has none; a successful login returns HTTP 204 with an empty body.

- `rss/items?withData=true` returns a tree. Keys are item names. A **feed** node is an object with `uid`, `url`, optional `refreshInterval`, and with data `title`, `lastBuildDate`, `isLoading`, `hasError`, `articles[]`. A **folder** node is an object without `uid` whose values are child nodes. In qB 5.2.3 a feed node is an object (`uid`, `url`) even without `withData`; older docs show a bare URL string.
- An article is the raw parsed hash: `id` (guid), `date` (string like `18 Sep 2026 22:57:42 +0000`, always UTC, no weekday; `new Date(...)` parses it), `title`, `author`, `description`, `torrentURL`, `link`, `isRead`. `isRead` is **absent until the article is read**. Any other XML element in the item is also passed through under its local name (`category`, `size`, `contentLength`, ...), so those are best-effort.
- `torrentURL` is never empty: if the item has no torrent enclosure and no magnet `<link>`, qB copies `link` into it. The API response does not say whether it came from an enclosure.
- Read state: `markAsRead(itemPath, articleId?)`. Omitting `articleId` marks the whole feed. There is no mark-unread.
- Other calls used: `addFeed(url, path?)`, `removeItem(path)`, `moveItem(itemPath, destPath)` (rename), `refreshItem(itemPath)`. Errors are 409 for add/remove/move.
- Feed processing is controlled by preference `rss_processing_enabled`. Also used: `rss_refresh_interval` (minutes) and `rss_max_articles_per_feed`. These are already typed in `QbAppPreferences`.

## Architecture

```
Menu View > RSS --view.select { viewId: 'rss' }--> UI_VIEW_SELECT --> router /pages/rss
Rss page --> RssStoreService --> QbService.rss.* --> window.bitbutler.qb.request --> qB /api/v2/rss/*
```

No new IPC and no new Electron-side code beyond the menu entry: `qb.request` already proxies arbitrary qB calls.

### Files

Electron / shared

- `packages/electron/src/menu.ts`: add an `RSS` radio item to the View menu (`checked: getActiveViewId() === 'rss'`, sends `view.select { viewId: 'rss' }`). Label key `electron.menu.view-rss`.
- `packages/app/public/i18n/us.json`, `hu.json`: `electron.menu.view-rss` plus all new `pages.rss.*` and `pages.qb-settings.tab.rss.*` keys.

Angular (`packages/app/src/app/`)

- `app.routes.ts`: lazy route `pages/rss`.
- `models/rss.model.ts`: `QbRssArticle`, `QbRssFeedNode`, `QbRssItems` (raw response types) and the view models `RssFeed`, `RssArticle`.
- `services/qb.service.ts`: new `readonly rss = { items, addFeed, removeItem, moveItem, refreshItem, markAsRead }` namespace, same style as `app` / `log` / `sync` (throws `HttpError` on non-ok).
- `services/rss-store.service.ts`: signal store for the page (see below).
- `pages/rss/rss.ts|html|scss` (page shell and header), `pages/rss/feed-list/`, `pages/rss/article-list/`, `pages/rss/article-details/`.
- `pages/rss/rss.lib.ts`: pure helpers (tree flattening, article view-model mapping, torrent-URL classification, title-prefix chip parsing, relative time). No Angular imports, so they are trivially unit-tested.
- `modals/add-torrent/`: accept an optional prefilled link (below).
- `modals/qb-settings/rss/`: new **RSS** tab (below). `qb-settings.interface.ts`, `qb-settings-state.service.ts` (`INITIAL_DIRTY`), `qb-settings.ts` (`tabs`) get the `'rss'` id.
- `models/command.model.ts` / `services/ui-command-handler.service.ts`: `UI_ADD_TORRENT` gets optional `urls?: string[]`; `UI_OPEN_QB_SETTINGS` gets optional `tab?: QbSettingsTabId`, passed to the modal's `tabToOpen` input.
- Global styles: `.bb-tool` / `.bb-search` are currently component-scoped in `pages/main/button-bar/button-bar.scss`. Move them to `styles/_toolbar-button.scss` (imported from `styles.scss`) and have both the torrent-list button bar and the RSS header use them. The logs branch (#330) makes the same extraction; whichever branch lands second resolves a small conflict by dropping its copy.

## Data model and mapping

### Flattening

Walk the tree from `rss/items?withData=true`. A node with `uid` is a feed. Its **path** is the ancestor names joined with `\` (this is what every mutating call takes as `itemPath`). Its **display name** is the last path segment, unless that equals the feed `url` (feed added without a name), in which case use `title`. Folders are not shown.

### Article view model

| Field         | Source                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| `id`          | `id`                                                                                                           |
| `feedPath`    | owning feed                                                                                                    |
| `title`       | `title`, with a leading `[X] - ` stripped when it was used for the chip                                        |
| `chip`        | `category` if a non-empty string, otherwise parsed from a `^\[([^\]]+)\]\s*-?\s*` title prefix, otherwise none |
| `date`        | `date`, parsed to `Date` (invalid stays `null`)                                                                |
| `author`      | `author`                                                                                                       |
| `link`        | `link`                                                                                                         |
| `description` | `description`, sanitized (see below)                                                                           |
| `size`        | `contentLength` (numeric, bytes) or `size` (string shown as-is); absent when neither exists                    |
| `isRead`      | `isRead === true`                                                                                              |
| `torrentUrl`  | `torrentURL` when it is downloadable (below), else `null`                                                      |

The chip parse is a fallback for feeds such as FOSS Torrents that encode the category in the title; the title is only stripped when the chip came from the prefix.

### Torrent URL classification

`torrentUrl` is set only when `torrentURL` is non-empty and one of:

1. starts with `magnet:` (case-insensitive), or
2. differs from `link` (it came from an enclosure), or
3. equals `link` and its path ends with `.torrent`.

Otherwise the article is treated as a plain web link: Download is disabled with a tooltip ("This item has no torrent or magnet link"), and only "Open link" is available. Rule 3 accepts a small false-negative rate for feeds that put an extensionless download URL in `<link>`; that trade-off was chosen explicitly.

### Description

Rendered through Angular's built-in `[innerHTML]` sanitizer, or as plain text with tags stripped; never bypassed with `DomSanitizer.bypassSecurityTrust*`. Links in the description are not clickable inside the app (plain text).

## RssStoreService

Signals: `feeds`, `articles` (all, flattened with `feedPath`), `selectedFeedPath` (`null` = virtual **Unread**), `selectedArticleId`, `filterText`, `processingEnabled`, `loading`, `loaded`.
Computed: `unreadCount` per feed and total; `visibleArticles` (selected feed or all-unread, then text filter on title/description/author, sorted by date descending); `selectedArticle`.
Methods: `load()`, `addFeed(url, name?)`, `removeFeed(path)`, `renameFeed(path, newName)`, `refresh(path?)`, `markRead(feedPath, articleId)`, `markAllRead()` (selected feed, or every feed with unread items when Unread is selected).

- Scoped to `ServerStoreService.currentServerId()`; reloads and clears selection when the server changes.
- **Refresh cadence:** loads on entering the view, after every mutating action, and every 30 s while the view is open (RxJS `timer`, torn down with the page). `refreshItem` triggers a qB fetch, which is asynchronous on the server, so the store re-reads shortly after (feed nodes report `isLoading`); no client-side waiting logic beyond the normal poll.
- Read state is optimistic: `markRead` updates the signal immediately and reverts with an error toast if the call fails.
- `processingEnabled` comes from `qb.app.preferences` on load.

## UI

Header (mirrors the logs view header: back chevron, title with subtitle, actions row, bottom border; compact mode hides button labels and shows tooltips, same `bb-tool` pattern):

`[<] RSS  Subscriptions and their latest items. Double-click an item to download it.   [Update all] [Mark all read] [Add subscription] [Settings] [Filter feed items...]`

Body is three columns, as in the design mockup:

1. **Feeds** (`FEEDS n`): virtual **Unread** first, then feeds. Each row shows the unread count. Feed rows have a context menu (Refresh, Rename, Remove) and show a subtle error/loading indicator from `hasError` / `isLoading`.
2. **Feed items** (`n OF m`): chip, title, relative time (`1h`, `3h`, `1d`), unread dot and bold weight for unread. Selecting an item marks it read (like the qB WebUI). Double-click runs Download.
3. **Details**: chip, title, then rows for Date (existing `DateFormatService`), Author, Size (only when present), Link (opens in the external browser via `ElectronService.openExternalUrl`), then the description. Footer: **Download** (disabled with tooltip when not downloadable) and **Open link**. The mockup's "Mark as unread" is removed.

Back chevron navigates to `/pages/torrent-list`. The page reports itself as the active view (`view:set-active`) the same way the torrent list does, so the menu radio stays in sync.

### States

- **Processing disabled:** banner across the top: "RSS fetching is disabled on this server." with an **Enable** button that sets `rss_processing_enabled: true` via `qb.app.setPreferences`, then reloads.
- **No feeds:** empty-state prompt pointing to Add subscription.
- **No items / filtered out:** empty message in the items column.
- **Load failure:** toast plus an inline retry; 401/403 already routes to login via `QbService`.

### Actions

- **Add subscription:** small modal (feed URL required, name optional). Calls `addFeed(url, name)`. A 409 shows an error toast with qB's reason where available.
- **Rename / Remove:** rename uses a small prompt modal; remove uses the existing `ConfirmService`.
- **Update all:** `refreshItem` for every feed, then reload.
- **Mark all read:** as above. No confirm.
- **Download:** `commandBus.emit({ type: 'UI_ADD_TORRENT', urls: [torrentUrl] })`; the modal opens with the link field prefilled. The article is marked read after the modal reports a successful add. If wiring "after successful add" through the command bus turns out to be invasive, fall back to marking read on Download click (decision at planning time).
- **Settings button:** `commandBus.emit({ type: 'UI_OPEN_QB_SETTINGS', tab: 'rss' })`.

### Toasts (per CLAUDE.md)

Title = short Title-Case outcome, message = variable detail only. Toasts for: add/remove/rename feed success and failure, refresh failure, enable-processing success and failure, load failure. **No** toast for read/unread changes, selection, or filter (the result is visible in the UI).

## qB Settings: RSS tab

New tab `rss` in the qB Settings modal (after Seeding Ratios), following the existing tab pattern (`QbSettingsTabComponent`, `registerSave`, `markDirty`, saved with the modal's Save button via `setPreferences`). Fields:

- Enable fetching RSS feeds (`rss_processing_enabled`, checkbox)
- Feeds refresh interval (`rss_refresh_interval`, minutes, number, min 1)
- Maximum number of articles per feed (`rss_max_articles_per_feed`, number, min 1)

Interval and max articles are disabled while fetching is unchecked. The header settings button opens the modal with `tabToOpen = 'rss'`.

## Error handling

- All qB calls throw `HttpError` (existing behavior); the store catches, toasts, and leaves prior state intact.
- Malformed articles (missing `id` or `title`) are skipped; an unparsable `date` sorts last and shows no time.
- Large feeds: v1 renders the items list with `@for` and `track` on `id`, with no virtualization. FOSS Torrents (263 items) is the reference size; add virtualization only if it proves sluggish there.

## Testing

Vitest, matching the repo. Unit tests first for `rss.lib.ts` (flattening with folders, chip parsing, size parsing, torrent-URL classification for magnet / enclosure-differs / `.torrent` / plain-link cases, date parsing, unread when `isRead` is absent), `QbService.rss` (paths, params, errors), `RssStoreService` (unread virtual feed, filtering, optimistic read + revert, mark-all-read scopes, server switch), the page and its three child components, the qB Settings RSS tab (dirty tracking, save payload), `UI_ADD_TORRENT` prefill and `UI_OPEN_QB_SETTINGS` tab passing, and the menu entry (`menu.spec.ts`). Final check is manual against a real qB server with the FOSS Torrents feed (list, read state, disabled Download, settings tab) and a torrent-style feed with enclosures (Download prefill).

## Open verification items (first plan task)

1. Resolved (2026-09-19): the `rss/items?withData=true` shape was confirmed against a real qB 5.2.3, see "Key facts about qB's RSS API" above.
2. Confirm how the torrent list page reports the active view so the RSS page does the same.
3. Confirm whether `hasError` / `isLoading` need dedicated UI or just a subtle indicator.
