/**
 * Raw article as returned inside `articles[]` by `/api/v2/rss/items?withData=true`.
 * qBittorrent passes unknown XML elements through under their local names, so
 * `category`, `size` and `contentLength` are best-effort and typed as `unknown`.
 * `isRead` is absent until the article is read.
 */
export type QbRssArticle = {
  id?: string;
  title?: string;
  description?: string;
  author?: string;
  date?: string;
  link?: string;
  torrentURL?: string;
  isRead?: boolean;
  category?: unknown;
  size?: unknown;
  contentLength?: unknown;
};

export type QbRssFeedNode = {
  uid: string;
  url: string;
  title?: string;
  lastBuildDate?: string;
  isLoading?: boolean;
  hasError?: boolean;
  articles?: QbRssArticle[];
};

/** A folder is an object without `uid`. qB 5.2.3 returns feed nodes as objects even without `withData` (older docs show a bare URL string, so a string node is skipped defensively). */
export type QbRssItems = { [name: string]: QbRssFeedNode | QbRssItems | string };

export type RssFeed = {
  /** Full qB item path, ancestors joined with a backslash. Used as `itemPath` in every call. */
  path: string;
  name: string;
  url: string;
  isLoading: boolean;
  hasError: boolean;
};

export type RssArticle = {
  /** Unique across feeds: `${feedPath}\u0000${id}`. */
  key: string;
  id: string;
  feedPath: string;
  title: string;
  chip: string | null;
  date: Date | null;
  author: string | null;
  link: string | null;
  /** Plain text, never HTML. */
  description: string;
  sizeBytes: number | null;
  sizeText: string | null;
  isRead: boolean;
  /** Non-null only when the item can be handed to qB's torrents/add. */
  torrentUrl: string | null;
};
