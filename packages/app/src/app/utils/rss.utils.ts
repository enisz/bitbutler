import type {
  QbRssArticle,
  QbRssFeedNode,
  QbRssItems,
  RssArticle,
  RssFeed,
} from '../models/rss.model';

export const RSS_PATH_SEPARATOR = '\\';

export type RssAge = {
  unit: 'now' | 'minute' | 'hour' | 'day' | 'week' | 'year';
  value: number;
};

const TITLE_PREFIX = /^\[([^\]]+)\]\s*-?\s*/;

const asTrimmedString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const isFeedNode = (node: unknown): node is QbRssFeedNode =>
  typeof node === 'object' && node !== null && typeof (node as QbRssFeedNode).uid === 'string';

export function isSafeExternalLink(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function htmlToText(html: string): string {
  const withBreaks = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n');
  const text = new DOMParser().parseFromString(withBreaks, 'text/html').body.textContent ?? '';
  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractChip(
  category: unknown,
  title: string,
): { chip: string | null; title: string } {
  const cat = asTrimmedString(category);
  if (cat) return { chip: cat, title };

  const match = TITLE_PREFIX.exec(title);
  if (match) {
    const rest = title.slice(match[0].length).trim();
    if (rest) return { chip: match[1].trim(), title: rest };
  }
  return { chip: null, title };
}

const pathEndsWithTorrent = (url: string): boolean =>
  url.split(/[?#]/)[0].toLowerCase().endsWith('.torrent');

export function classifyTorrentUrl(torrentUrl: unknown, link: unknown): string | null {
  const url = asTrimmedString(torrentUrl);
  if (!url) return null;
  if (/^magnet:/i.test(url)) return url;
  // qB copies `link` into `torrentURL` when the item has no enclosure or magnet, so a
  // differing value can only have come from an enclosure.
  if (url !== asTrimmedString(link)) return url;
  return pathEndsWithTorrent(url) ? url : null;
}

const toBytes = (value: unknown): number | null => {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function extractSize(raw: QbRssArticle): {
  sizeBytes: number | null;
  sizeText: string | null;
} {
  const bytes = toBytes(raw.contentLength) ?? toBytes(raw.size);
  if (bytes !== null) return { sizeBytes: bytes, sizeText: null };
  return { sizeBytes: null, sizeText: asTrimmedString(raw.size) || null };
}

export function relativeAge(date: Date | null, now: number = Date.now()): RssAge | null {
  if (!date) return null;
  const seconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  if (seconds < 60) return { unit: 'now', value: 0 };
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return { unit: 'minute', value: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { unit: 'hour', value: hours };
  const days = Math.floor(hours / 24);
  if (days < 7) return { unit: 'day', value: days };
  if (days < 365) return { unit: 'week', value: Math.floor(days / 7) };
  return { unit: 'year', value: Math.floor(days / 365) };
}

export function mapArticle(raw: QbRssArticle, feedPath: string): RssArticle | null {
  const id = typeof raw.id === 'string' ? raw.id : '';
  const rawTitle = asTrimmedString(raw.title);
  if (!id || !rawTitle) return null;

  const { chip, title } = extractChip(raw.category, rawTitle);
  const rawLink = asTrimmedString(raw.link);
  const parsedDate = raw.date ? new Date(raw.date) : null;

  return {
    key: `${feedPath}\u0000${id}`,
    id,
    feedPath,
    title,
    chip,
    date: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null,
    author: asTrimmedString(raw.author) || null,
    link: isSafeExternalLink(rawLink) ? rawLink : null,
    description: typeof raw.description === 'string' ? htmlToText(raw.description) : '',
    ...extractSize(raw),
    isRead: raw.isRead === true,
    torrentUrl: classifyTorrentUrl(raw.torrentURL, rawLink),
  };
}

export function flattenRssItems(items: QbRssItems): { feeds: RssFeed[]; articles: RssArticle[] } {
  const feeds: RssFeed[] = [];
  const articles: RssArticle[] = [];

  const walk = (level: QbRssItems, parents: string[]): void => {
    for (const [name, node] of Object.entries(level)) {
      if (typeof node === 'string') continue; // feed returned without data
      if (isFeedNode(node)) {
        const path = [...parents, name].join(RSS_PATH_SEPARATOR);
        for (const raw of node.articles ?? []) {
          const mapped = mapArticle(raw, path);
          if (mapped) articles.push(mapped);
        }
        feeds.push({
          path,
          name: name === node.url && node.title ? node.title : name,
          url: node.url,
          isLoading: node.isLoading === true,
          hasError: node.hasError === true,
        });
      } else {
        walk(node as QbRssItems, [...parents, name]);
      }
    }
  };

  walk(items, []);
  return { feeds, articles };
}
