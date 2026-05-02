import { afterEach, describe, expect, it, vi } from 'vitest';
import { draftFromPathBuffer, parseTorrentBufferToDraft } from './parse-torrent.js';

const mockParseTorrent = vi.hoisted(() => vi.fn());

vi.mock('parse-torrent', () => ({
  default: mockParseTorrent,
}));

describe('parseTorrentBufferToDraft', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns a TorrentDraft with correct torrent data on success', async () => {
    mockParseTorrent.mockReturnValue({
      name: 'My Torrent',
      length: 1000,
      files: [{ path: 'file.txt', length: 1000 }],
      announce: 'http://tracker.example.com/announce',
      infoHash: 'abc123',
    });

    const result = await parseTorrentBufferToDraft(Buffer.from('fake'), {
      source: 'manual',
      originalPath: '/path/to/file.torrent',
      originalName: 'file.torrent',
    });

    expect(result.source).toBe('manual');
    expect(result.originalPath).toBe('/path/to/file.torrent');
    expect(result.originalName).toBe('file.torrent');
    expect(result.torrent).toBeDefined();
    expect(result.torrent!.name).toBe('My Torrent');
    expect(result.torrent!.totalSize).toBe(1000);
    expect(result.torrent!.trackers).toContain('http://tracker.example.com/announce');
    expect(result.torrent!.infoHashV1).toBe('abc123');
    expect(result.error).toBeUndefined();
  });

  it('includes file list with indices', async () => {
    mockParseTorrent.mockReturnValue({
      name: 'T',
      length: 200,
      files: [
        { path: 'a.txt', length: 100 },
        { path: 'b.txt', length: 100 },
      ],
    });

    const result = await parseTorrentBufferToDraft(Buffer.from('fake'), {
      source: 'manual',
      originalPath: null,
      originalName: null,
    });

    expect(result.torrent!.files).toHaveLength(2);
    expect(result.torrent!.files[0].index).toBe(0);
    expect(result.torrent!.files[1].index).toBe(1);
  });

  it('returns an error draft when parse-torrent throws', async () => {
    mockParseTorrent.mockImplementation(() => {
      throw new Error('Invalid torrent data');
    });

    const result = await parseTorrentBufferToDraft(Buffer.from('bad'), {
      source: 'startup',
      originalPath: null,
      originalName: null,
    });

    expect(result.torrent).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error!.code).toBe('PARSE_FAILED');
    expect(result.error!.message).toContain('Invalid torrent data');
  });

  it('uses originalName as the torrent name when parsed name is empty', async () => {
    mockParseTorrent.mockReturnValue({ name: '', length: 0, files: [] });

    const result = await parseTorrentBufferToDraft(Buffer.from('fake'), {
      source: 'manual',
      originalPath: null,
      originalName: 'my-file.torrent',
    });

    expect(result.torrent!.name).toBe('my-file.torrent');
  });

  it('falls back to "Unknown torrent" when name and originalName are both absent', async () => {
    mockParseTorrent.mockReturnValue({ name: '', length: 0, files: [] });

    const result = await parseTorrentBufferToDraft(Buffer.from('fake'), {
      source: 'manual',
      originalPath: null,
      originalName: null,
    });

    expect(result.torrent!.name).toBe('Unknown torrent');
  });

  it('normalizes backslash path separators in file paths', async () => {
    mockParseTorrent.mockReturnValue({
      name: 'T',
      length: 100,
      files: [{ path: 'folder\\subfolder\\file.txt', length: 100 }],
    });

    const result = await parseTorrentBufferToDraft(Buffer.from('fake'), {
      source: 'manual',
      originalPath: null,
      originalName: null,
    });

    expect(result.torrent!.files[0].path).toBe('folder/subfolder/file.txt');
  });

  it('computes totalSize from files when top-level length is not a number', async () => {
    mockParseTorrent.mockReturnValue({
      name: 'T',
      length: null,
      files: [
        { path: 'a.txt', length: 100 },
        { path: 'b.txt', length: 200 },
      ],
    });

    const result = await parseTorrentBufferToDraft(Buffer.from('fake'), {
      source: 'manual',
      originalPath: null,
      originalName: null,
    });

    expect(result.torrent!.totalSize).toBe(300);
  });

  it('deduplicates trackers from announceList tiers', async () => {
    mockParseTorrent.mockReturnValue({
      name: 'T',
      length: 0,
      files: [],
      announceList: [['http://tracker1.com', 'http://tracker2.com'], ['http://tracker1.com']],
    });

    const result = await parseTorrentBufferToDraft(Buffer.from('fake'), {
      source: 'manual',
      originalPath: null,
      originalName: null,
    });

    expect(result.torrent!.trackers).toEqual(['http://tracker1.com', 'http://tracker2.com']);
  });

  it('collects tracker from announce string', async () => {
    mockParseTorrent.mockReturnValue({
      name: 'T',
      length: 0,
      files: [],
      announce: 'http://announce.example.com',
    });

    const result = await parseTorrentBufferToDraft(Buffer.from('fake'), {
      source: 'manual',
      originalPath: null,
      originalName: null,
    });

    expect(result.torrent!.trackers).toContain('http://announce.example.com');
  });

  it('captures infoHashV2 when present', async () => {
    mockParseTorrent.mockReturnValue({
      name: 'T',
      length: 0,
      files: [],
      infoHash: 'v1hash',
      infoHashV2: 'v2hash',
    });

    const result = await parseTorrentBufferToDraft(Buffer.from('fake'), {
      source: 'manual',
      originalPath: null,
      originalName: null,
    });

    expect(result.torrent!.infoHashV1).toBe('v1hash');
    expect(result.torrent!.infoHashV2).toBe('v2hash');
  });

  it('captures isPrivate flag when present', async () => {
    mockParseTorrent.mockReturnValue({
      name: 'T',
      length: 0,
      files: [],
      private: true,
    });

    const result = await parseTorrentBufferToDraft(Buffer.from('fake'), {
      source: 'manual',
      originalPath: null,
      originalName: null,
    });

    expect(result.torrent!.isPrivate).toBe(true);
  });

  it('sets receivedAt to a recent timestamp', async () => {
    mockParseTorrent.mockReturnValue({ name: 'T', length: 0, files: [] });
    const before = Date.now();
    const result = await parseTorrentBufferToDraft(Buffer.from('fake'), {
      source: 'manual',
      originalPath: null,
      originalName: null,
    });
    const after = Date.now();
    expect(result.receivedAt).toBeGreaterThanOrEqual(before);
    expect(result.receivedAt).toBeLessThanOrEqual(after);
  });
});

describe('draftFromPathBuffer', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('derives originalName from the file path basename', async () => {
    mockParseTorrent.mockReturnValue({ name: 'Test', length: 0, files: [] });

    const result = await draftFromPathBuffer(
      Buffer.from('fake'),
      '/downloads/my.torrent',
      'startup',
    );

    expect(result.originalName).toBe('my.torrent');
  });

  it('passes the full path as originalPath', async () => {
    mockParseTorrent.mockReturnValue({ name: 'Test', length: 0, files: [] });

    const result = await draftFromPathBuffer(
      Buffer.from('fake'),
      '/downloads/my.torrent',
      'startup',
    );

    expect(result.originalPath).toBe('/downloads/my.torrent');
  });

  it('passes the source through to the draft', async () => {
    mockParseTorrent.mockReturnValue({ name: 'Test', length: 0, files: [] });

    const result = await draftFromPathBuffer(
      Buffer.from('fake'),
      '/dl/t.torrent',
      'second-instance',
    );

    expect(result.source).toBe('second-instance');
  });
});
