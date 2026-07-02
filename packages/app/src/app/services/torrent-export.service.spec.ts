import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { ServerStoreService } from './server-store.service';
import { ToastService } from './toast.service';
import { TorrentExportService } from './torrent-export.service';

describe('TorrentExportService', () => {
  let service: TorrentExportService;
  let toastService: { danger: ReturnType<typeof vi.fn> };
  let translateService: { instant: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    toastService = { danger: vi.fn() };
    translateService = { instant: vi.fn((key: string) => key) };

    (window as any).bitbutler = {
      export: {
        saveTorrentFiles: vi
          .fn()
          .mockResolvedValue({ cancelled: false, savedPaths: ['/tmp/x.torrent'], failed: [] }),
      },
    };

    TestBed.configureTestingModule({
      providers: [
        TorrentExportService,
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: ToastService, useValue: toastService },
        { provide: TranslateService, useValue: translateService },
      ],
    });

    service = TestBed.inject(TorrentExportService);
  });

  it('calls saveTorrentFiles with the given hash/name pairs', async () => {
    await service.exportTorrentFiles([
      { hash: 'a', name: 'Film A' },
      { hash: 'b', name: 'Film B' },
    ]);
    expect(window.bitbutler.export.saveTorrentFiles).toHaveBeenCalledWith({
      serverId: 'server-1',
      items: [
        { hash: 'a', name: 'Film A' },
        { hash: 'b', name: 'Film B' },
      ],
    });
  });

  it('does nothing when there is no current server', async () => {
    (TestBed.inject(ServerStoreService).currentServerId as any).set(null);
    await service.exportTorrentFiles([{ hash: 'a', name: 'Film A' }]);
    expect(window.bitbutler.export.saveTorrentFiles).not.toHaveBeenCalled();
  });

  it('shows a danger toast summarizing failures', async () => {
    (window.bitbutler.export.saveTorrentFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
      cancelled: false,
      savedPaths: [],
      failed: [{ hash: 'a', name: 'Film A', error: 'boom' }],
    });
    await service.exportTorrentFiles([{ hash: 'a', name: 'Film A' }]);
    expect(toastService.danger).toHaveBeenCalled();
  });

  it('does not toast when nothing failed', async () => {
    await service.exportTorrentFiles([{ hash: 'a', name: 'Film A' }]);
    expect(toastService.danger).not.toHaveBeenCalled();
  });

  it('translates the failure count and title before toasting', async () => {
    (window.bitbutler.export.saveTorrentFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
      cancelled: false,
      savedPaths: [],
      failed: [{ hash: 'a', name: 'Film A', error: 'boom' }],
    });
    await service.exportTorrentFiles([{ hash: 'a', name: 'Film A' }]);
    expect(translateService.instant).toHaveBeenCalledWith(
      'pages.main.grid.context-menu.toast.export-failed-title',
    );
    expect(translateService.instant).toHaveBeenCalledWith(
      'pages.main.grid.context-menu.toast.export-failed-count',
      { failed: 1, total: 1 },
    );
  });

  it('shows a friendly error message when saveTorrentFiles rejects with a QbHttpError', async () => {
    (window.bitbutler.export.saveTorrentFiles as ReturnType<typeof vi.fn>).mockRejectedValue(
      JSON.stringify({
        name: 'QbHttpError',
        status: 404,
        statusText: 'Not Found',
        body: '...',
        path: '/api/v2/torrents/export',
      }),
    );
    await service.exportTorrentFiles([{ hash: 'a', name: 'Film A' }]);
    expect(toastService.danger).toHaveBeenCalledWith(
      '404 Not Found',
      'pages.main.grid.context-menu.toast.export-failed-title',
    );
  });

  it('shows the raw error string when it is not JSON', async () => {
    (window.bitbutler.export.saveTorrentFiles as ReturnType<typeof vi.fn>).mockRejectedValue(
      'plain string error',
    );
    await service.exportTorrentFiles([{ hash: 'a', name: 'Film A' }]);
    expect(toastService.danger).toHaveBeenCalledWith(
      'plain string error',
      'pages.main.grid.context-menu.toast.export-failed-title',
    );
  });

  it('shows the Error message when saveTorrentFiles throws an Error instance', async () => {
    (window.bitbutler.export.saveTorrentFiles as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('network down'),
    );
    await service.exportTorrentFiles([{ hash: 'a', name: 'Film A' }]);
    expect(toastService.danger).toHaveBeenCalledWith(
      'network down',
      'pages.main.grid.context-menu.toast.export-failed-title',
    );
  });
});
