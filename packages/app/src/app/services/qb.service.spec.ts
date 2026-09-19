import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HttpError } from '../models/http.model';
import { QbService } from './qb.service';
import { ServerStoreService } from './server-store.service';
import { ToastService } from './toast.service';

describe('QbService', () => {
  let service: QbService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        QbService,
        { provide: ToastService, useValue: { danger: vi.fn() } },
        { provide: ServerStoreService, useValue: {} },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });
    service = TestBed.inject(QbService);
  });

  it('should delegate login() to window.bitbutler.qb.login', async () => {
    const spy = vi.spyOn(window.bitbutler.qb, 'login').mockResolvedValue({ loggedIn: true } as any);
    const result = await service.auth.login('server-1');
    expect(spy).toHaveBeenCalledWith({ id: 'server-1' });
    expect(result).toEqual({ loggedIn: true });
  });

  it('should delegate logout() to window.bitbutler.qb.logout', async () => {
    const spy = vi
      .spyOn(window.bitbutler.qb, 'logout')
      .mockResolvedValue({ loggedOut: true } as any);
    const result = await service.auth.logout('server-1');
    expect(spy).toHaveBeenCalledWith({ id: 'server-1' });
    expect(result).toEqual({ loggedOut: true });
  });

  it('should unwrap hasCookie result and return a boolean', async () => {
    const spy = vi
      .spyOn(window.bitbutler.qb, 'hasCookie')
      .mockResolvedValue({ hasCookie: true } as any);
    const result = await service.auth.hasCookie('server-1');
    expect(spy).toHaveBeenCalledWith({ id: 'server-1' });
    expect(result).toBe(true);
  });

  it('should call login with server id via maindata()', async () => {
    const spy = vi.spyOn(window.bitbutler.qb, 'request').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: { rid: 1 },
    } as any);
    await service.sync.maindata('server-1', 0);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'server-1', path: '/api/v2/sync/maindata' }),
    );
  });

  it('should call log.main with the normal/info/warning/critical query params', async () => {
    const spy = vi.spyOn(window.bitbutler.qb, 'request').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: [],
    } as any);

    await service.log.main('server-1', {
      normal: false,
      info: false,
      warning: true,
      critical: true,
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'server-1',
        path: '/api/v2/log/main',
        query: { normal: false, info: false, warning: true, critical: true },
      }),
    );
  });

  it('should call log.peers with a last_known_id query param', async () => {
    const spy = vi.spyOn(window.bitbutler.qb, 'request').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: [],
    } as any);

    await service.log.peers('server-1', { last_known_id: 5 });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'server-1',
        path: '/api/v2/log/peers',
        query: { last_known_id: 5 },
      }),
    );
  });

  it('should throw HttpError when clearing the category fails', async () => {
    vi.spyOn(service, 'request').mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
    } as any);

    await expect(service.torrents.clearCategory('server-1', ['hash1'])).rejects.toThrow(
      'Failed to clear category',
    );
  });

  describe('torrents.info()', () => {
    it('calls /api/v2/torrents/info with the correct hash and returns the first torrent', async () => {
      const torrent = { hash: 'abc123', name: 'My Torrent' };
      vi.spyOn(window.bitbutler.qb, 'request').mockResolvedValue([torrent] as any);

      const result = await service.torrents.info('server-1', 'abc123');

      expect(window.bitbutler.qb.request).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'server-1',
          path: '/api/v2/torrents/info',
          method: 'GET',
          query: { hashes: 'abc123' },
        }),
      );
      expect(result).toEqual(torrent);
    });

    it('returns null when the response array is empty', async () => {
      vi.spyOn(window.bitbutler.qb, 'request').mockResolvedValue([] as any);
      const result = await service.torrents.info('server-1', 'abc123');
      expect(result).toBeNull();
    });

    it('rejects when hash is empty', async () => {
      await expect(service.torrents.info('server-1', '')).rejects.toThrow('hash is required');
    });

    it('throws HttpError when the response is not ok', async () => {
      vi.spyOn(service, 'request').mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        body: null,
      } as any);
      await expect(service.torrents.info('server-1', 'abc123')).rejects.toThrow(
        'Failed to get torrent info',
      );
    });
  });

  describe('torrents.setDownloadPath()', () => {
    it('sends hashes and path to /api/v2/torrents/setDownloadPath', async () => {
      vi.spyOn(service, 'request').mockResolvedValue({ ok: true } as any);
      await service.torrents.setDownloadPath('server-1', ['abc', 'def'], '/mnt/data');
      expect(service.request).toHaveBeenCalledWith(
        'server-1',
        expect.objectContaining({
          path: '/api/v2/torrents/setDownloadPath',
          method: 'POST',
          form: { hashes: 'abc|def', path: '/mnt/data' },
        }),
      );
    });

    it('throws HttpError when request fails', async () => {
      vi.spyOn(service, 'request').mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      } as any);
      await expect(
        service.torrents.setDownloadPath('server-1', ['abc'], '/mnt/data'),
      ).rejects.toThrow('Failed to set download path');
    });

    it('rejects when no hashes are provided', async () => {
      await expect(service.torrents.setDownloadPath('server-1', [], '/mnt/data')).rejects.toThrow(
        'No hashes provided',
      );
    });

    it('rejects when path is empty', async () => {
      await expect(service.torrents.setDownloadPath('server-1', ['abc'], '  ')).rejects.toThrow(
        'path is required',
      );
    });
  });

  describe('torrents.toggleSequentialDownload()', () => {
    it('sends hashes to /api/v2/torrents/toggleSequentialDownload', async () => {
      vi.spyOn(service, 'request').mockResolvedValue({ ok: true } as any);
      await service.torrents.toggleSequentialDownload('server-1', ['abc']);
      expect(service.request).toHaveBeenCalledWith(
        'server-1',
        expect.objectContaining({
          path: '/api/v2/torrents/toggleSequentialDownload',
          method: 'POST',
          form: { hashes: 'abc' },
        }),
      );
    });

    it('throws HttpError when request fails', async () => {
      vi.spyOn(service, 'request').mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      } as any);
      await expect(service.torrents.toggleSequentialDownload('server-1', ['abc'])).rejects.toThrow(
        'Failed to toggle sequential download',
      );
    });

    it('returns early when hashes list is empty', async () => {
      const spy = vi.spyOn(service, 'request');
      await service.torrents.toggleSequentialDownload('server-1', []);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('torrents.toggleFirstLastPiecePrio()', () => {
    it('sends hashes to /api/v2/torrents/toggleFirstLastPiecePrio', async () => {
      vi.spyOn(service, 'request').mockResolvedValue({ ok: true } as any);
      await service.torrents.toggleFirstLastPiecePrio('server-1', ['abc']);
      expect(service.request).toHaveBeenCalledWith(
        'server-1',
        expect.objectContaining({
          path: '/api/v2/torrents/toggleFirstLastPiecePrio',
          method: 'POST',
          form: { hashes: 'abc' },
        }),
      );
    });

    it('throws HttpError when request fails', async () => {
      vi.spyOn(service, 'request').mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      } as any);
      await expect(service.torrents.toggleFirstLastPiecePrio('server-1', ['abc'])).rejects.toThrow(
        'Failed to toggle first/last piece priority',
      );
    });

    it('returns early when hashes list is empty', async () => {
      const spy = vi.spyOn(service, 'request');
      await service.torrents.toggleFirstLastPiecePrio('server-1', []);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('torrents.removeAllTags()', () => {
    it('sends hashes with no tags field to /api/v2/torrents/removeTags', async () => {
      vi.spyOn(service, 'request').mockResolvedValue({ ok: true } as any);
      await service.torrents.removeAllTags('server-1', ['abc', 'def']);
      expect(service.request).toHaveBeenCalledWith(
        'server-1',
        expect.objectContaining({
          path: '/api/v2/torrents/removeTags',
          method: 'POST',
          form: { hashes: 'abc|def' },
        }),
      );
    });

    it('throws HttpError when request fails', async () => {
      vi.spyOn(service, 'request').mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      } as any);
      await expect(service.torrents.removeAllTags('server-1', ['abc'])).rejects.toThrow(
        'Failed to remove all tags',
      );
    });

    it('returns early when hashes list is empty', async () => {
      const spy = vi.spyOn(service, 'request');
      await service.torrents.removeAllTags('server-1', []);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('rss', () => {
    it('items() requests the tree with article data', async () => {
      const tree = { Feed: { uid: '{1}', url: 'https://a/rss', articles: [] } };
      const spy = vi.spyOn(window.bitbutler.qb, 'request').mockResolvedValue(tree as any);

      const result = await service.rss.items('server-1');

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'server-1',
          path: '/api/v2/rss/items',
          method: 'GET',
          query: { withData: true },
        }),
      );
      expect(result).toEqual(tree);
    });

    it('addFeed() posts the url and the optional path', async () => {
      const spy = vi.spyOn(window.bitbutler.qb, 'request').mockResolvedValue(undefined as any);

      await service.rss.addFeed('server-1', 'https://a/rss', 'My Feed');
      await service.rss.addFeed('server-1', 'https://b/rss');

      expect(spy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          path: '/api/v2/rss/addFeed',
          method: 'POST',
          form: { url: 'https://a/rss', path: 'My Feed' },
        }),
      );
      expect(spy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ form: { url: 'https://b/rss' } }),
      );
    });

    it('removeItem(), moveItem() and refreshItem() post their parameters', async () => {
      const spy = vi.spyOn(window.bitbutler.qb, 'request').mockResolvedValue(undefined as any);

      await service.rss.removeItem('server-1', 'Folder\\Feed');
      await service.rss.moveItem('server-1', 'Old', 'New');
      await service.rss.refreshItem('server-1', 'Feed');

      expect(spy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          path: '/api/v2/rss/removeItem',
          method: 'POST',
          form: { path: 'Folder\\Feed' },
        }),
      );
      expect(spy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          path: '/api/v2/rss/moveItem',
          form: { itemPath: 'Old', destPath: 'New' },
        }),
      );
      expect(spy).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ path: '/api/v2/rss/refreshItem', form: { itemPath: 'Feed' } }),
      );
    });

    it('markAsRead() includes articleId only when given', async () => {
      const spy = vi.spyOn(window.bitbutler.qb, 'request').mockResolvedValue(undefined as any);

      await service.rss.markAsRead('server-1', 'Feed', 'a1');
      await service.rss.markAsRead('server-1', 'Feed');

      expect(spy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          path: '/api/v2/rss/markAsRead',
          method: 'POST',
          form: { itemPath: 'Feed', articleId: 'a1' },
        }),
      );
      expect(spy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ form: { itemPath: 'Feed' } }),
      );
    });

    it('rejects with HttpError using the qB response body as the reason when qB answers 409', async () => {
      vi.spyOn(service, 'request').mockResolvedValue({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        body: 'RSS feed with given URL already exists: https://a/rss',
      } as any);

      const error = (await service.rss
        .addFeed('server-1', 'https://a/rss')
        .catch((e: unknown) => e)) as HttpError;

      expect(error).toBeInstanceOf(HttpError);
      expect(error.message).toBe('RSS feed with given URL already exists: https://a/rss');
    });

    it('falls back to statusText when the 409 response has no body text', async () => {
      vi.spyOn(service, 'request').mockResolvedValue({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        body: '',
      } as any);

      const error = (await service.rss
        .addFeed('server-1', 'https://a/rss')
        .catch((e: unknown) => e)) as HttpError;

      expect(error).toBeInstanceOf(HttpError);
      expect(error.message).toBe('Conflict');
    });
  });
});
