import type { QbRssItems } from '../models/rss.model';
import {
  classifyTorrentUrl,
  extractChip,
  extractSize,
  flattenRssItems,
  htmlToText,
  isSafeExternalLink,
  mapArticle,
  relativeAge,
} from './rss.utils';

const article = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  title: '[Distribution] - Tails ',
  description: 'Tails has been released.',
  link: 'https://example.com/tails',
  torrentURL: 'https://example.com/tails',
  date: '18 Sep 2026 22:57:42 +0000',
  author: '@FossTorrents',
  ...over,
});

describe('flattenRssItems', () => {
  it('flattens feeds and nested folders using backslash paths', () => {
    const items: QbRssItems = {
      Top: { uid: '{1}', url: 'https://a/rss', articles: [article()] },
      Folder: { Sub: { uid: '{2}', url: 'https://b/rss', articles: [article({ id: 'b1' })] } },
    };
    const { feeds, articles } = flattenRssItems(items);
    expect(feeds.map((f) => f.path)).toEqual(['Top', 'Folder\\Sub']);
    expect(feeds.map((f) => f.name)).toEqual(['Top', 'Sub']);
    expect(articles.map((a) => a.feedPath)).toEqual(['Top', 'Folder\\Sub']);
  });

  it('uses the channel title when the feed was added without a name', () => {
    const items: QbRssItems = {
      'https://a/rss': { uid: '{1}', url: 'https://a/rss', title: 'My Channel', articles: [] },
    };
    expect(flattenRssItems(items).feeds[0].name).toBe('My Channel');
  });

  it('skips feeds returned without data and articles missing an id or title', () => {
    const items: QbRssItems = {
      NoData: 'https://a/rss',
      F: {
        uid: '{1}',
        url: 'u',
        articles: [article(), article({ id: '' }), article({ id: 'x', title: '  ' })],
      },
    };
    const { feeds, articles } = flattenRssItems(items);
    expect(feeds.map((f) => f.path)).toEqual(['F']);
    expect(articles).toHaveLength(1);
  });

  it('carries loading and error flags', () => {
    const items: QbRssItems = {
      F: { uid: '{1}', url: 'u', isLoading: true, hasError: true, articles: [] },
    };
    expect(flattenRssItems(items).feeds[0]).toMatchObject({ isLoading: true, hasError: true });
  });
});

describe('extractChip', () => {
  it('prefers a non-empty category and keeps the title intact', () => {
    expect(extractChip('Movies', '[X] - Title')).toEqual({ chip: 'Movies', title: '[X] - Title' });
  });

  it('parses a "[X] - " title prefix', () => {
    expect(extractChip(undefined, '[Distribution] - Kali Linux')).toEqual({
      chip: 'Distribution',
      title: 'Kali Linux',
    });
  });

  it('keeps the title when nothing follows the prefix', () => {
    expect(extractChip(undefined, '[Only]')).toEqual({ chip: null, title: '[Only]' });
  });

  it('returns no chip for plain titles', () => {
    expect(extractChip('  ', 'Plain title')).toEqual({ chip: null, title: 'Plain title' });
  });
});

describe('classifyTorrentUrl', () => {
  it('accepts magnet links case-insensitively', () => {
    expect(classifyTorrentUrl('MAGNET:?xt=urn:btih:abc', 'https://x/page')).toBe(
      'MAGNET:?xt=urn:btih:abc',
    );
  });

  it('accepts an enclosure url that differs from the link', () => {
    expect(classifyTorrentUrl('https://x/dl?id=1', 'https://x/page')).toBe('https://x/dl?id=1');
  });

  it('accepts a link-only .torrent url, ignoring query and hash', () => {
    expect(classifyTorrentUrl('https://x/a.torrent?key=1', 'https://x/a.torrent?key=1')).toBe(
      'https://x/a.torrent?key=1',
    );
  });

  it('rejects a plain web link that qB copied into torrentURL', () => {
    expect(classifyTorrentUrl('https://x/page', 'https://x/page')).toBeNull();
  });

  it('rejects empty and non-string values', () => {
    expect(classifyTorrentUrl('', 'https://x')).toBeNull();
    expect(classifyTorrentUrl(undefined, 'https://x')).toBeNull();
  });
});

describe('extractSize', () => {
  it('reads contentLength as bytes', () => {
    expect(extractSize({ contentLength: '1024' })).toEqual({ sizeBytes: 1024, sizeText: null });
  });

  it('treats a numeric size string as bytes', () => {
    expect(extractSize({ size: '2048' })).toEqual({ sizeBytes: 2048, sizeText: null });
  });

  it('keeps a human readable size as text', () => {
    expect(extractSize({ size: ' 1.2 GiB ' })).toEqual({ sizeBytes: null, sizeText: '1.2 GiB' });
  });

  it('returns nothing when the feed has no size', () => {
    expect(extractSize({})).toEqual({ sizeBytes: null, sizeText: null });
  });
});

describe('htmlToText and isSafeExternalLink', () => {
  it('turns block tags into newlines and drops the rest', () => {
    expect(htmlToText('<p>Hello <b>world</b></p><p>Bye</p>')).toBe('Hello world\nBye');
  });

  it('decodes entities without producing markup', () => {
    expect(htmlToText('a &amp; b &lt;script&gt;')).toBe('a & b <script>');
  });

  it('only allows http and https links', () => {
    expect(isSafeExternalLink('https://x.y')).toBe(true);
    expect(isSafeExternalLink('HTTP://x.y')).toBe(true);
    expect(isSafeExternalLink('file:///etc/passwd')).toBe(false);
    expect(isSafeExternalLink('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalLink('')).toBe(false);
  });
});

describe('relativeAge', () => {
  const now = Date.UTC(2026, 8, 19, 12, 0, 0);
  const ago = (ms: number) => new Date(now - ms);

  it('buckets ages into units', () => {
    expect(relativeAge(ago(30_000), now)).toEqual({ unit: 'now', value: 0 });
    expect(relativeAge(ago(5 * 60_000), now)).toEqual({ unit: 'minute', value: 5 });
    expect(relativeAge(ago(3 * 3_600_000), now)).toEqual({ unit: 'hour', value: 3 });
    expect(relativeAge(ago(2 * 86_400_000), now)).toEqual({ unit: 'day', value: 2 });
    expect(relativeAge(ago(14 * 86_400_000), now)).toEqual({ unit: 'week', value: 2 });
    expect(relativeAge(ago(400 * 86_400_000), now)).toEqual({ unit: 'year', value: 1 });
  });

  it('clamps future dates to now and returns null without a date', () => {
    expect(relativeAge(new Date(now + 60_000), now)).toEqual({ unit: 'now', value: 0 });
    expect(relativeAge(null, now)).toBeNull();
  });
});

describe('mapArticle', () => {
  it('maps a full article', () => {
    const a = mapArticle(article({ isRead: true }), 'Feed')!;
    expect(a).toMatchObject({
      id: 'a1',
      key: 'Feed\u0000a1',
      feedPath: 'Feed',
      title: 'Tails',
      chip: 'Distribution',
      author: '@FossTorrents',
      link: 'https://example.com/tails',
      isRead: true,
      torrentUrl: null,
    });
    expect(a.date?.toISOString()).toBe('2026-09-18T22:57:42.000Z');
  });

  it('treats a missing isRead as unread', () => {
    expect(mapArticle(article(), 'F')!.isRead).toBe(false);
  });

  it('nulls invalid dates, unsafe links and empty authors', () => {
    const a = mapArticle(article({ date: 'nonsense', link: 'file:///x', author: ' ' }), 'F')!;
    expect(a.date).toBeNull();
    expect(a.link).toBeNull();
    expect(a.author).toBeNull();
  });

  it('converts the description to plain text', () => {
    expect(mapArticle(article({ description: '<b>Hi</b> there' }), 'F')!.description).toBe(
      'Hi there',
    );
  });

  it('returns null without an id or title', () => {
    expect(mapArticle(article({ id: undefined }), 'F')).toBeNull();
  });
});
