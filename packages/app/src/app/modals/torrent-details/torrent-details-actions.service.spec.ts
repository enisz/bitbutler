import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Torrent } from '../../models/torrent.model';
import { CommandBusService } from '../../services/command-bus.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';
import { TorrentExportService } from '../../services/torrent-export.service';
import { TorrentDetailsActionsService } from './torrent-details-actions.service';
import { MergedTorrent, TorrentDetailsDataService } from './torrent-details-data.service';

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const makeTorrent = (overrides: Partial<Torrent> = {}): Torrent => ({
  added_on: 1700000000,
  amount_left: 0,
  auto_tmm: false,
  availability: 0,
  category: '',
  completed: 0,
  completion_on: 0,
  content_path: '',
  dl_limit: 0,
  dlspeed: 0,
  download_path: '',
  downloaded: 0,
  downloaded_session: 0,
  eta: 0,
  f_l_piece_prio: false,
  force_start: false,
  hash: 'abc123',
  inactive_seeding_time_limit: 0,
  infohash_v1: '',
  infohash_v2: '',
  last_activity: 0,
  magnet_uri: '',
  max_inactive_seeding_time: 0,
  max_ratio: 0,
  max_seeding_time: 0,
  name: 'My Torrent',
  num_complete: 0,
  num_incomplete: 0,
  num_leechs: 0,
  num_seeds: 0,
  priority: 0,
  progress: 0,
  ratio: 0,
  ratio_limit: 0,
  save_path: '',
  seeding_time: 0,
  seeding_time_limit: 0,
  seen_complete: 0,
  seq_dl: false,
  size: 0,
  state: 'downloading',
  super_seeding: false,
  tags: 'a, b',
  time_active: 0,
  total_size: 0,
  tracker: '',
  trackers_count: 0,
  up_limit: 0,
  uploaded: 0,
  uploaded_session: 0,
  upspeed: 0,
  ...overrides,
});

describe('TorrentDetailsActionsService', () => {
  let service: TorrentDetailsActionsService;
  let mockDataService: {
    hash: ReturnType<typeof vi.fn>;
    torrent: ReturnType<typeof signal<MergedTorrent | null>>;
  };
  let qbTorrents: {
    resume: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    setForceStart: ReturnType<typeof vi.fn>;
    clearCategory: ReturnType<typeof vi.fn>;
    removeTags: ReturnType<typeof vi.fn>;
    reannounce: ReturnType<typeof vi.fn>;
    renameFile: ReturnType<typeof vi.fn>;
    filePrio: ReturnType<typeof vi.fn>;
    setDownloadPath: ReturnType<typeof vi.fn>;
    toggleSequentialDownload: ReturnType<typeof vi.fn>;
    toggleFirstLastPiecePrio: ReturnType<typeof vi.fn>;
    recheck: ReturnType<typeof vi.fn>;
    setAutoManagement: ReturnType<typeof vi.fn>;
    setSuperSeeding: ReturnType<typeof vi.fn>;
  };
  let commandBusEmit: ReturnType<typeof vi.fn>;
  let toastInfo: ReturnType<typeof vi.fn>;
  let toastDanger: ReturnType<typeof vi.fn>;
  let torrentExportService: { exportTorrentFiles: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const torrentSignal = signal<MergedTorrent | null>({
      data: makeTorrent(),
      properties: {} as any,
    });

    mockDataService = {
      hash: vi.fn().mockReturnValue('abc123'),
      torrent: torrentSignal,
    };

    qbTorrents = {
      resume: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockResolvedValue(undefined),
      setForceStart: vi.fn().mockResolvedValue(undefined),
      clearCategory: vi.fn().mockResolvedValue(undefined),
      removeTags: vi.fn().mockResolvedValue(undefined),
      reannounce: vi.fn().mockResolvedValue(undefined),
      renameFile: vi.fn().mockResolvedValue(undefined),
      filePrio: vi.fn().mockResolvedValue(undefined),
      setDownloadPath: vi.fn().mockResolvedValue(undefined),
      toggleSequentialDownload: vi.fn().mockResolvedValue(undefined),
      toggleFirstLastPiecePrio: vi.fn().mockResolvedValue(undefined),
      recheck: vi.fn().mockResolvedValue(undefined),
      setAutoManagement: vi.fn().mockResolvedValue(undefined),
      setSuperSeeding: vi.fn().mockResolvedValue(undefined),
    };

    commandBusEmit = vi.fn();
    toastInfo = vi.fn();
    toastDanger = vi.fn();
    torrentExportService = { exportTorrentFiles: vi.fn().mockResolvedValue(undefined) };

    TestBed.configureTestingModule({
      providers: [
        TorrentDetailsActionsService,
        { provide: TorrentDetailsDataService, useValue: mockDataService },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: QbService, useValue: { torrents: qbTorrents } },
        { provide: CommandBusService, useValue: { emit: commandBusEmit } },
        { provide: ToastService, useValue: { info: toastInfo, danger: toastDanger } },
        { provide: TorrentExportService, useValue: torrentExportService },
      ],
    });

    service = TestBed.inject(TorrentDetailsActionsService);
  });

  describe('rename', () => {
    it('emits UI_RENAME_TORRENT with the current torrent', () => {
      service.rename();
      expect(commandBusEmit).toHaveBeenCalledWith({
        type: 'UI_RENAME_TORRENT',
        torrent: mockDataService.torrent()!.data,
      });
    });
  });

  describe('setSavePath', () => {
    it('emits UI_SET_SAVE_PATH with the current torrent and hash', () => {
      service.setSavePath();
      expect(commandBusEmit).toHaveBeenCalledWith({
        type: 'UI_SET_SAVE_PATH',
        torrent: mockDataService.torrent()!.data,
        hashes: ['abc123'],
      });
    });
  });

  describe('setDownloadPath', () => {
    it('emits UI_SET_DOWNLOAD_PATH with torrent data and hash', () => {
      const emit = vi.spyOn(TestBed.inject(CommandBusService), 'emit');
      service.setDownloadPath();
      expect(emit).toHaveBeenCalledWith({
        type: 'UI_SET_DOWNLOAD_PATH',
        torrent: expect.objectContaining({ hash: 'abc123' }),
        hashes: ['abc123'],
      });
    });
  });

  describe('openPath', () => {
    it('emits UI_OPEN_DESTINATION when there is a content_path', () => {
      mockDataService.torrent.set({
        data: makeTorrent({ content_path: '/remote/path' }),
        properties: {} as any,
      });
      service.openPath();
      expect(commandBusEmit).toHaveBeenCalledWith({
        type: 'UI_OPEN_DESTINATION',
        remotePath: '/remote/path',
        hash: 'abc123',
      });
    });

    it('shows a danger toast when there is no content_path', () => {
      mockDataService.torrent.set({
        data: makeTorrent({ content_path: '' }),
        properties: {} as any,
      });
      service.openPath();
      expect(toastDanger).toHaveBeenCalledWith(
        'components.modals.torrent-details.general.toast.local-path-failed',
      );
      expect(commandBusEmit).not.toHaveBeenCalled();
    });
  });

  describe('changeCategory', () => {
    it('emits UI_SET_TORRENT_CATEGORY', () => {
      service.changeCategory();
      expect(commandBusEmit).toHaveBeenCalledWith({
        type: 'UI_SET_TORRENT_CATEGORY',
        torrent: mockDataService.torrent()!.data,
        hashes: ['abc123'],
      });
    });
  });

  describe('removeCategory', () => {
    it('shows an info toast and clears the category', async () => {
      await service.removeCategory();
      expect(toastInfo).toHaveBeenCalledWith(
        'components.modals.torrent-details.general.toast.removing-category',
      );
      expect(qbTorrents.clearCategory).toHaveBeenCalledWith('server-1', ['abc123']);
    });

    it('shows a danger toast when clearing the category fails', async () => {
      qbTorrents.clearCategory.mockRejectedValueOnce(new Error('boom'));
      await service.removeCategory();
      expect(toastDanger).toHaveBeenCalledWith(
        'boom',
        'components.modals.torrent-details.general.toast.remove-category-failed',
      );
    });
  });

  describe('changeTags', () => {
    it('emits UI_SET_TORRENT_TAGS', () => {
      service.changeTags();
      expect(commandBusEmit).toHaveBeenCalledWith({
        type: 'UI_SET_TORRENT_TAGS',
        torrent: mockDataService.torrent()!.data,
        hashes: ['abc123'],
      });
    });
  });

  describe('removeAllTags', () => {
    it('removes the parsed tag list', async () => {
      await service.removeAllTags();
      expect(toastInfo).toHaveBeenCalledWith(
        'components.modals.torrent-details.general.toast.removing-all-tags',
      );
      expect(qbTorrents.removeTags).toHaveBeenCalledWith('server-1', ['abc123'], ['a', 'b']);
    });
  });

  describe('resume', () => {
    it('shows an info toast and resumes the torrent', async () => {
      await service.resume();
      expect(toastInfo).toHaveBeenCalledWith(
        'components.modals.torrent-details.general.toast.resuming',
      );
      expect(qbTorrents.resume).toHaveBeenCalledWith('server-1', ['abc123']);
    });

    it('shows a danger toast when resuming fails', async () => {
      qbTorrents.resume.mockRejectedValueOnce(new Error('boom'));
      await service.resume();
      expect(toastDanger).toHaveBeenCalledWith(
        'boom',
        'components.modals.torrent-details.general.toast.resume-failed',
      );
    });
  });

  describe('pause', () => {
    it('shows an info toast and pauses the torrent', async () => {
      await service.pause();
      expect(qbTorrents.pause).toHaveBeenCalledWith('server-1', ['abc123']);
    });
  });

  describe('forceResume', () => {
    it('shows an info toast and force-resumes the torrent', async () => {
      await service.forceResume();
      expect(qbTorrents.setForceStart).toHaveBeenCalledWith('server-1', ['abc123'], true);
    });
  });

  describe('openTransferLimitsModal', () => {
    it('emits UI_LIMIT_TRANSFER targeting the torrent', () => {
      service.openTransferLimitsModal();
      expect(commandBusEmit).toHaveBeenCalledWith({
        type: 'UI_LIMIT_TRANSFER',
        target: 'torrent',
        hashes: ['abc123'],
      });
    });
  });

  describe('openShareLimitsModal', () => {
    it('emits UI_LIMIT_SHARE targeting the torrent', () => {
      service.openShareLimitsModal();
      expect(commandBusEmit).toHaveBeenCalledWith({
        type: 'UI_LIMIT_SHARE',
        target: 'torrent',
        hashes: ['abc123'],
      });
    });
  });

  describe('forceReannounce', () => {
    it('shows an info toast and reannounces the torrent', async () => {
      await service.forceReannounce();
      expect(qbTorrents.reannounce).toHaveBeenCalledWith('server-1', ['abc123']);
    });
  });

  describe('deleteTorrent', () => {
    it('emits UI_TORRENT_DELETE_REQUEST with the hash of the torrent being viewed', () => {
      service.deleteTorrent();
      expect(commandBusEmit).toHaveBeenCalledWith({
        type: 'UI_TORRENT_DELETE_REQUEST',
        hashes: ['abc123'],
      });
    });
  });

  describe('exportTorrentFile', () => {
    it('delegates to TorrentExportService with the current torrent hash and name', async () => {
      mockDataService.torrent.set({
        data: makeTorrent({ hash: 'abc123', name: 'My Torrent' }),
        properties: {} as any,
      });
      await service.exportTorrentFile();
      expect(torrentExportService.exportTorrentFiles).toHaveBeenCalledWith([
        { hash: 'abc123', name: 'My Torrent' },
      ]);
    });
  });

  describe('toggleSequentialDownload', () => {
    it('shows an info toast and calls toggleSequentialDownload with server id and hash', async () => {
      await service.toggleSequentialDownload();
      expect(toastInfo).toHaveBeenCalledWith(
        'components.modals.torrent-details.general.toast.toggling-sequential-download',
      );
      expect(qbTorrents.toggleSequentialDownload).toHaveBeenCalledWith('server-1', ['abc123']);
    });

    it('shows danger toast on failure', async () => {
      qbTorrents.toggleSequentialDownload.mockRejectedValueOnce(new Error('fail'));
      const danger = vi.spyOn(TestBed.inject(ToastService), 'danger');
      await service.toggleSequentialDownload();
      expect(danger).toHaveBeenCalledWith('fail', expect.any(String));
    });

    it('marks sequential-download pending during the call and clears it after', async () => {
      const { promise, resolve } = deferred<void>();
      qbTorrents.toggleSequentialDownload.mockReturnValueOnce(promise);

      expect(service.isOptionPending('sequential-download')).toBe(false);
      const call = service.toggleSequentialDownload();
      expect(service.isOptionPending('sequential-download')).toBe(true);

      resolve();
      await call;
      expect(service.isOptionPending('sequential-download')).toBe(false);
    });

    it('clears sequential-download pending even when the call fails', async () => {
      qbTorrents.toggleSequentialDownload.mockRejectedValueOnce(new Error('fail'));
      await service.toggleSequentialDownload();
      expect(service.isOptionPending('sequential-download')).toBe(false);
    });
  });

  describe('toggleFirstLastPiecePrio', () => {
    it('shows an info toast and calls toggleFirstLastPiecePrio with server id and hash', async () => {
      await service.toggleFirstLastPiecePrio();
      expect(toastInfo).toHaveBeenCalledWith(
        'components.modals.torrent-details.general.toast.toggling-first-last-piece-prio',
      );
      expect(qbTorrents.toggleFirstLastPiecePrio).toHaveBeenCalledWith('server-1', ['abc123']);
    });

    it('marks first-last-piece-prio pending during the call and clears it after', async () => {
      const { promise, resolve } = deferred<void>();
      qbTorrents.toggleFirstLastPiecePrio.mockReturnValueOnce(promise);

      expect(service.isOptionPending('first-last-piece-prio')).toBe(false);
      const call = service.toggleFirstLastPiecePrio();
      expect(service.isOptionPending('first-last-piece-prio')).toBe(true);

      resolve();
      await call;
      expect(service.isOptionPending('first-last-piece-prio')).toBe(false);
    });
  });

  describe('forceRecheck', () => {
    it('calls recheck with server id and hash', async () => {
      await service.forceRecheck();
      expect(qbTorrents.recheck).toHaveBeenCalledWith('server-1', ['abc123']);
    });
  });

  describe('toggleAutoTmm', () => {
    it('shows an info toast and calls setAutoManagement with inverted auto_tmm value', async () => {
      // makeTorrent sets auto_tmm: false, so enabling = true
      await service.toggleAutoTmm();
      expect(toastInfo).toHaveBeenCalledWith(
        'components.modals.torrent-details.general.toast.toggling-auto-tmm',
      );
      expect(qbTorrents.setAutoManagement).toHaveBeenCalledWith('server-1', ['abc123'], true);
    });

    it('disables when auto_tmm is currently true', async () => {
      mockDataService.torrent.set({
        data: makeTorrent({ auto_tmm: true }),
        properties: {} as any,
      });
      await service.toggleAutoTmm();
      expect(qbTorrents.setAutoManagement).toHaveBeenCalledWith('server-1', ['abc123'], false);
    });

    it('marks auto-tmm pending during the call and clears it after', async () => {
      const { promise, resolve } = deferred<void>();
      qbTorrents.setAutoManagement.mockReturnValueOnce(promise);

      expect(service.isOptionPending('auto-tmm')).toBe(false);
      const call = service.toggleAutoTmm();
      expect(service.isOptionPending('auto-tmm')).toBe(true);

      resolve();
      await call;
      expect(service.isOptionPending('auto-tmm')).toBe(false);
    });

    it('clears auto-tmm pending even when the call fails', async () => {
      qbTorrents.setAutoManagement.mockRejectedValueOnce(new Error('boom'));
      await service.toggleAutoTmm();
      expect(service.isOptionPending('auto-tmm')).toBe(false);
    });
  });

  describe('toggleSuperSeeding', () => {
    it('shows an info toast and calls setSuperSeeding with inverted super_seeding value', async () => {
      // makeTorrent sets super_seeding: false, so enabling = true
      await service.toggleSuperSeeding();
      expect(toastInfo).toHaveBeenCalledWith(
        'components.modals.torrent-details.general.toast.toggling-super-seeding',
      );
      expect(qbTorrents.setSuperSeeding).toHaveBeenCalledWith('server-1', ['abc123'], true);
    });

    it('marks super-seeding pending during the call and clears it after', async () => {
      const { promise, resolve } = deferred<void>();
      qbTorrents.setSuperSeeding.mockReturnValueOnce(promise);

      expect(service.isOptionPending('super-seeding')).toBe(false);
      const call = service.toggleSuperSeeding();
      expect(service.isOptionPending('super-seeding')).toBe(true);

      resolve();
      await call;
      expect(service.isOptionPending('super-seeding')).toBe(false);
    });
  });

  describe('toggleForceStart', () => {
    it('shows an info toast and calls setForceStart with the inverted force_start value', async () => {
      // makeTorrent sets force_start: false, so enabling = true
      await service.toggleForceStart();
      expect(toastInfo).toHaveBeenCalledWith(
        'components.modals.torrent-details.general.toast.toggling-force-start',
      );
      expect(qbTorrents.setForceStart).toHaveBeenCalledWith('server-1', ['abc123'], true);
    });

    it('disables when force_start is currently true', async () => {
      mockDataService.torrent.set({
        data: makeTorrent({ force_start: true }),
        properties: {} as any,
      });
      await service.toggleForceStart();
      expect(qbTorrents.setForceStart).toHaveBeenCalledWith('server-1', ['abc123'], false);
    });

    it('shows a danger toast when toggling fails', async () => {
      qbTorrents.setForceStart.mockRejectedValueOnce(new Error('boom'));
      await service.toggleForceStart();
      expect(toastDanger).toHaveBeenCalledWith(
        'boom',
        'components.modals.torrent-details.general.toast.toggle-force-start-failed',
      );
    });

    it('marks force-start pending during the call and clears it after', async () => {
      const { promise, resolve } = deferred<void>();
      qbTorrents.setForceStart.mockReturnValueOnce(promise);

      expect(service.isOptionPending('force-start')).toBe(false);
      const call = service.toggleForceStart();
      expect(service.isOptionPending('force-start')).toBe(true);

      resolve();
      await call;
      expect(service.isOptionPending('force-start')).toBe(false);
    });

    it('clears force-start pending even when the call fails', async () => {
      qbTorrents.setForceStart.mockRejectedValueOnce(new Error('boom'));
      await service.toggleForceStart();
      expect(service.isOptionPending('force-start')).toBe(false);
    });
  });

  describe('saveFileChanges', () => {
    it('renames files and updates priorities that changed', async () => {
      const originalContent = [
        { path: 'old.txt', length: 1, index: 0, priority: 1 },
        { path: 'b.txt', length: 1, index: 1, priority: 1 },
      ];
      const event = {
        files: [
          { path: 'new.txt', length: 1, index: 0, priority: 1 },
          { path: 'b.txt', length: 1, index: 1, priority: 0 },
        ],
        renames: [{ oldPath: 'old.txt', newPath: 'new.txt' }],
      };

      await service.saveFileChanges(event, originalContent);

      expect(qbTorrents.renameFile).toHaveBeenCalledWith(
        'server-1',
        'abc123',
        'old.txt',
        'new.txt',
      );
      expect(qbTorrents.filePrio).toHaveBeenCalledWith('server-1', 'abc123', [1], 0);
      expect(qbTorrents.filePrio).not.toHaveBeenCalledWith(
        'server-1',
        'abc123',
        [0],
        expect.anything(),
      );
    });

    it('shows a danger toast when a rename fails', async () => {
      qbTorrents.renameFile.mockRejectedValueOnce(new Error('boom'));
      await service.saveFileChanges({ files: [], renames: [{ oldPath: 'a', newPath: 'b' }] }, []);
      expect(toastDanger).toHaveBeenCalledWith(
        'boom',
        'components.modals.torrent-details.content.error.failed-to-save-title',
      );
    });
  });
});
