import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as details from './torrent-details.js';

const mockQbCall = vi.fn();

vi.mock('./client.js', () => ({ qbCall: (...args: unknown[]) => mockQbCall(...args) }));

describe('torrent details domain', () => {
  beforeEach(() => {
    mockQbCall.mockReset();
    mockQbCall.mockResolvedValue('');
  });

  describe('request shape', () => {
    it.each([
      [
        'properties',
        () => details.properties('s', ' h '),
        { method: 'GET', path: '/api/v2/torrents/properties', query: { hash: 'h' } },
      ],
      [
        'trackers',
        () => details.trackers('s', ' h '),
        { method: 'GET', path: '/api/v2/torrents/trackers', query: { hash: 'h' } },
      ],
      [
        'files',
        () => details.files('s', 'h'),
        { method: 'GET', path: '/api/v2/torrents/files', query: { hash: 'h' } },
      ],
      [
        'setLocation',
        () => details.setLocation('s', [' a ', '', 'b'], ' /dl '),
        {
          method: 'POST',
          path: '/api/v2/torrents/setLocation',
          form: { hashes: 'a|b', location: '/dl' },
        },
      ],
      [
        'rename',
        () => details.rename('s', ' h ', ' n '),
        { method: 'POST', path: '/api/v2/torrents/rename', form: { hash: 'h', name: 'n' } },
      ],
      [
        'renameFile',
        () => details.renameFile('s', 'h', ' a ', ' b '),
        {
          method: 'POST',
          path: '/api/v2/torrents/renameFile',
          form: { hash: 'h', oldPath: 'a', newPath: 'b' },
        },
      ],
      [
        'renameFolder',
        () => details.renameFolder('s', 'h', ' a ', ' b '),
        {
          method: 'POST',
          path: '/api/v2/torrents/renameFolder',
          form: { hash: 'h', oldPath: 'a', newPath: 'b' },
        },
      ],
      [
        'filePrio',
        () => details.filePrio('s', 'h', [1, 2, 3], 7),
        {
          method: 'POST',
          path: '/api/v2/torrents/filePrio',
          form: { hash: 'h', id: '1|2|3', priority: '7' },
        },
      ],
      [
        'setShareLimits',
        () => details.setShareLimits('s', ['a', 'b'], 1.5, 60, -2),
        {
          method: 'POST',
          path: '/api/v2/torrents/setShareLimits',
          form: {
            hashes: 'a|b',
            ratioLimit: '1.5',
            seedingTimeLimit: '60',
            inactiveSeedingTimeLimit: '-2',
          },
        },
      ],
      [
        'downloadLimit',
        () => details.downloadLimit('s', ['a', 'b']),
        { method: 'GET', path: '/api/v2/torrents/downloadLimit', query: { hashes: 'a|b' } },
      ],
      [
        'uploadLimit',
        () => details.uploadLimit('s', ['a', 'b']),
        { method: 'GET', path: '/api/v2/torrents/uploadLimit', query: { hashes: 'a|b' } },
      ],
      [
        'setDownloadLimit',
        () => details.setDownloadLimit('s', 100, ['a', 'b']),
        {
          method: 'POST',
          path: '/api/v2/torrents/setDownloadLimit',
          form: { limit: '100', hashes: 'a|b' },
        },
      ],
      [
        'setUploadLimit',
        () => details.setUploadLimit('s', 200, ['a', 'b']),
        {
          method: 'POST',
          path: '/api/v2/torrents/setUploadLimit',
          form: { limit: '200', hashes: 'a|b' },
        },
      ],
      [
        'setDownloadPath',
        () => details.setDownloadPath('s', ['a', 'b'], ' /p '),
        {
          method: 'POST',
          path: '/api/v2/torrents/setDownloadPath',
          form: { hashes: 'a|b', path: '/p' },
        },
      ],
    ] as const)('%s', async (_name, run, expected) => {
      await run();
      expect(mockQbCall).toHaveBeenCalledWith('s', expected);
    });
  });

  describe('info', () => {
    it('queries by hashes and returns the first element', async () => {
      mockQbCall.mockResolvedValueOnce([{ hash: 'h' }, { hash: 'x' }]);
      await expect(details.info('s', ' h ')).resolves.toEqual({ hash: 'h' });
      expect(mockQbCall).toHaveBeenCalledWith('s', {
        method: 'GET',
        path: '/api/v2/torrents/info',
        query: { hashes: 'h' },
      });
    });

    it('returns null for an empty array', async () => {
      mockQbCall.mockResolvedValueOnce([]);
      await expect(details.info('s', 'h')).resolves.toBeNull();
    });
  });

  describe('validation', () => {
    it.each([
      ['properties', () => details.properties('s', ' '), 'hash is required'],
      ['info', () => details.info('s', ''), 'hash is required'],
      ['trackers', () => details.trackers('s', ' '), 'hash is required'],
      ['setLocation hashes', () => details.setLocation('s', [' '], '/x'), 'No hashes provided'],
      ['setLocation location', () => details.setLocation('s', ['a'], ' '), 'location is required'],
      ['rename hash', () => details.rename('s', ' ', 'n'), 'hash is required'],
      ['rename name', () => details.rename('s', 'h', ' '), 'name is required'],
      [
        'renameFile',
        () => details.renameFile('s', 'h', '', 'b'),
        'hash, oldPath and newPath are required',
      ],
      [
        'renameFolder',
        () => details.renameFolder('s', 'h', 'a', ' '),
        'hash, oldPath and newPath are required',
      ],
      ['filePrio hash', () => details.filePrio('s', ' ', [1], 1), 'hash is required'],
      ['filePrio ids', () => details.filePrio('s', 'h', [], 1), 'ids are required'],
      ['setShareLimits', () => details.setShareLimits('s', [], 1, 1, 1), 'No hashes provided'],
      [
        'setDownloadPath hashes',
        () => details.setDownloadPath('s', [], '/p'),
        'No hashes provided',
      ],
      ['setDownloadPath path', () => details.setDownloadPath('s', ['a'], ' '), 'path is required'],
    ] as const)('%s rejects INVALID', async (_name, run, message) => {
      await expect(run()).rejects.toMatchObject({ code: 'INVALID', message });
      expect(mockQbCall).not.toHaveBeenCalled();
    });
  });

  describe('exportTorrentFile', () => {
    it('requests the file as a buffer', async () => {
      const buf = Buffer.from('x');
      mockQbCall.mockResolvedValueOnce(buf);
      await expect(details.exportTorrentFile('s', 'h')).resolves.toBe(buf);
      expect(mockQbCall).toHaveBeenCalledWith('s', {
        path: '/api/v2/torrents/export',
        query: { hash: 'h' },
        responseType: 'buffer',
      });
    });
  });

  describe('addTorrent', () => {
    const lastCall = (): {
      path: string;
      method: string;
      headers: Record<string, string>;
      body: Buffer;
    } => mockQbCall.mock.calls[0][1];

    it('posts multipart with urls joined by newline and paused as stopped and paused', async () => {
      await details.addTorrent('s', {
        torrents: [],
        urls: ['magnet:a', 'magnet:b'],
        options: { paused: true, category: 'tv', savepath: '  ', tags: null, skip: undefined },
      });
      expect(mockQbCall.mock.calls[0][0]).toBe('s');
      const call = lastCall();
      expect(call.method).toBe('POST');
      expect(call.path).toBe('/api/v2/torrents/add');
      expect(call.headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
      expect(call.headers['Content-Length']).toBe(String(call.body.length));
      const text = call.body.toString();
      expect(text).toContain('name="urls"\r\n\r\nmagnet:a\nmagnet:b');
      expect(text).toContain('name="stopped"\r\n\r\ntrue');
      expect(text).toContain('name="paused"\r\n\r\ntrue');
      expect(text).toContain('name="category"\r\n\r\ntv');
      expect(text).not.toContain('name="savepath"');
      expect(text).not.toContain('name="tags"');
      expect(text).not.toContain('name="skip"');
    });

    it('attaches files from bytes and from a path', async () => {
      const file = path.join(os.tmpdir(), `bb-task5-${process.pid}.torrent`);
      fs.writeFileSync(file, 'FROMDISK');
      try {
        await details.addTorrent('s', {
          torrents: [
            { name: 'a.torrent', bytes: [65, 66, 67] },
            { name: 'b.torrent', path: file },
          ] as never,
        });
      } finally {
        fs.unlinkSync(file);
      }
      const text = lastCall().body.toString();
      expect(text).toContain('filename="a.torrent"');
      expect(text).toContain('ABC');
      expect(text).toContain('filename="b.torrent"');
      expect(text).toContain('FROMDISK');
    });

    it('rejects INVALID when neither a file nor a url is given', async () => {
      await expect(details.addTorrent('s', { torrents: [], urls: [] })).rejects.toMatchObject({
        code: 'INVALID',
      });
      expect(mockQbCall).not.toHaveBeenCalled();
    });
  });
});
