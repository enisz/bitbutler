import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { CommandBusService } from './command-bus.service';
import { QbService } from './qb.service';
import { SelectionStoreService } from './selection-store.service';
import { ServerStoreService } from './server-store.service';
import { ToastService } from './toast.service';
import { TorrentCommandHandlerService } from './torrent-command-handler.service';
import { TorrentStoreService } from './torrent-store.service';

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve));

describe('TorrentCommandHandlerService', () => {
  let service: TorrentCommandHandlerService;
  let commands$: Subject<any>;
  let qbService: {
    torrents: {
      delete: ReturnType<typeof vi.fn>;
      pause: ReturnType<typeof vi.fn>;
      resume: ReturnType<typeof vi.fn>;
      topPrio: ReturnType<typeof vi.fn>;
      increasePrio: ReturnType<typeof vi.fn>;
      decreasePrio: ReturnType<typeof vi.fn>;
      bottomPrio: ReturnType<typeof vi.fn>;
      reannounce: ReturnType<typeof vi.fn>;
      recheck: ReturnType<typeof vi.fn>;
      setSuperSeeding: ReturnType<typeof vi.fn>;
      setForceStart: ReturnType<typeof vi.fn>;
      setAutoManagement: ReturnType<typeof vi.fn>;
      toggleSequentialDownload: ReturnType<typeof vi.fn>;
      toggleFirstLastPiecePrio: ReturnType<typeof vi.fn>;
    };
  };
  let selectionStore: {
    selectedHashes: ReturnType<typeof signal<string[]>>;
    clear: ReturnType<typeof vi.fn>;
  };
  let serverStore: { currentServerId: ReturnType<typeof signal<string | null>> };
  let torrentStore: { torrentsArray: ReturnType<typeof signal<any[]>> };
  let toastDanger: ReturnType<typeof vi.fn>;
  let toastInfo: ReturnType<typeof vi.fn>;
  let commandBusEmit: ReturnType<typeof vi.fn>;
  let translateService: { instant: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    commands$ = new Subject();
    commandBusEmit = vi.fn();
    toastDanger = vi.fn();
    toastInfo = vi.fn();
    translateService = { instant: vi.fn((key: string) => key) };

    qbService = {
      torrents: {
        delete: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn().mockResolvedValue(undefined),
        resume: vi.fn().mockResolvedValue(undefined),
        topPrio: vi.fn().mockResolvedValue(undefined),
        increasePrio: vi.fn().mockResolvedValue(undefined),
        decreasePrio: vi.fn().mockResolvedValue(undefined),
        bottomPrio: vi.fn().mockResolvedValue(undefined),
        reannounce: vi.fn(),
        recheck: vi.fn().mockResolvedValue(undefined),
        setSuperSeeding: vi.fn(),
        setForceStart: vi.fn(),
        setAutoManagement: vi.fn(),
        toggleSequentialDownload: vi.fn().mockResolvedValue(undefined),
        toggleFirstLastPiecePrio: vi.fn().mockResolvedValue(undefined),
      },
    };

    selectionStore = {
      selectedHashes: signal(['hash1', 'hash2']),
      clear: vi.fn(),
    };

    serverStore = { currentServerId: signal('server-1') };
    torrentStore = { torrentsArray: signal([{ hash: 'hash1' }, { hash: 'hash2' }]) };

    TestBed.configureTestingModule({
      providers: [
        TorrentCommandHandlerService,
        {
          provide: CommandBusService,
          useValue: { commands$: commands$.asObservable(), emit: commandBusEmit },
        },
        { provide: QbService, useValue: qbService },
        { provide: SelectionStoreService, useValue: selectionStore },
        { provide: ServerStoreService, useValue: serverStore },
        { provide: TorrentStoreService, useValue: torrentStore },
        { provide: ToastService, useValue: { danger: toastDanger, info: toastInfo } },
        { provide: TranslateService, useValue: translateService },
      ],
    });

    service = TestBed.inject(TorrentCommandHandlerService);
    service.start();
  });

  it('should call deleteTorrents on TORRENT_DELETE_CONFIRM', async () => {
    commands$.next({ type: 'TORRENT_DELETE_CONFIRM', removeFiles: true });
    await flushPromises();
    expect(qbService.torrents.delete).toHaveBeenCalledWith('server-1', ['hash1', 'hash2'], true);
  });

  it('should clear selection after successful delete', async () => {
    commands$.next({ type: 'TORRENT_DELETE_CONFIRM', removeFiles: false });
    await flushPromises();
    expect(selectionStore.clear).toHaveBeenCalled();
  });

  it('should emit TORRENT_DELETED for each deleted hash', async () => {
    commands$.next({ type: 'TORRENT_DELETE_CONFIRM', removeFiles: false });
    await flushPromises();
    expect(commandBusEmit).toHaveBeenCalledWith({ type: 'TORRENT_DELETED', hash: 'hash1' });
    expect(commandBusEmit).toHaveBeenCalledWith({ type: 'TORRENT_DELETED', hash: 'hash2' });
  });

  it('should show danger toast when delete fails', async () => {
    qbService.torrents.delete.mockRejectedValueOnce(new Error('network error'));
    commands$.next({ type: 'TORRENT_DELETE_CONFIRM', removeFiles: false });
    await flushPromises();
    expect(toastDanger).toHaveBeenCalledWith(
      'network error',
      'services.torrent-command-handler.error.delete-failed-title',
    );
  });

  it('should not delete when no server is selected', async () => {
    serverStore.currentServerId.set(null);
    commands$.next({ type: 'TORRENT_DELETE_CONFIRM', removeFiles: false });
    await flushPromises();
    expect(qbService.torrents.delete).not.toHaveBeenCalled();
  });

  it('should not delete when no torrents are selected', async () => {
    selectionStore.selectedHashes.set([]);
    commands$.next({ type: 'TORRENT_DELETE_CONFIRM', removeFiles: false });
    await flushPromises();
    expect(qbService.torrents.delete).not.toHaveBeenCalled();
  });

  it('should delete exactly the overridden hashes when TORRENT_DELETE_CONFIRM includes hashes', async () => {
    commands$.next({ type: 'TORRENT_DELETE_CONFIRM', removeFiles: true, hashes: ['only-this'] });
    await flushPromises();
    expect(qbService.torrents.delete).toHaveBeenCalledWith('server-1', ['only-this'], true);
  });

  it('should not clear the grid selection when deleting an overridden hash set', async () => {
    commands$.next({ type: 'TORRENT_DELETE_CONFIRM', removeFiles: true, hashes: ['only-this'] });
    await flushPromises();
    expect(selectionStore.clear).not.toHaveBeenCalled();
  });

  it('should emit TORRENT_DELETED for each overridden hash', async () => {
    commands$.next({ type: 'TORRENT_DELETE_CONFIRM', removeFiles: true, hashes: ['only-this'] });
    await flushPromises();
    expect(commandBusEmit).toHaveBeenCalledWith({ type: 'TORRENT_DELETED', hash: 'only-this' });
  });

  it('should call pauseTorrents and show an info toast on TORRENT_PAUSE', async () => {
    commands$.next({ type: 'TORRENT_PAUSE' });
    await flushPromises();
    expect(qbService.torrents.pause).toHaveBeenCalledWith('server-1', ['hash1', 'hash2']);
    expect(toastInfo).toHaveBeenCalledWith('services.torrent-command-handler.toast.pausing');
  });

  it('should show a danger toast with the raw error when pause fails', async () => {
    qbService.torrents.pause.mockRejectedValueOnce(new Error('pause boom'));
    commands$.next({ type: 'TORRENT_PAUSE' });
    await flushPromises();
    expect(toastDanger).toHaveBeenCalledWith(
      'pause boom',
      'services.torrent-command-handler.toast.pause-failed-title',
    );
  });

  it('should call resumeTorrents and show an info toast on TORRENT_RESUME', async () => {
    commands$.next({ type: 'TORRENT_RESUME' });
    await flushPromises();
    expect(qbService.torrents.resume).toHaveBeenCalledWith('server-1', ['hash1', 'hash2']);
    expect(toastInfo).toHaveBeenCalledWith('services.torrent-command-handler.toast.resuming');
  });

  it('should show a danger toast with the raw error when resume fails', async () => {
    qbService.torrents.resume.mockRejectedValueOnce(new Error('resume boom'));
    commands$.next({ type: 'TORRENT_RESUME' });
    await flushPromises();
    expect(toastDanger).toHaveBeenCalledWith(
      'resume boom',
      'services.torrent-command-handler.toast.resume-failed-title',
    );
  });

  it('should call pauseTorrents and show an info toast on TORRENT_PAUSE_ALL', async () => {
    commands$.next({ type: 'TORRENT_PAUSE_ALL' });
    await flushPromises();
    expect(qbService.torrents.pause).toHaveBeenCalledWith('server-1', ['hash1', 'hash2']);
    expect(toastInfo).toHaveBeenCalledWith('services.torrent-command-handler.toast.pausing-all');
  });

  it('should show a danger toast with the raw error when pause-all fails', async () => {
    qbService.torrents.pause.mockRejectedValueOnce(new Error('pause all boom'));
    commands$.next({ type: 'TORRENT_PAUSE_ALL' });
    await flushPromises();
    expect(toastDanger).toHaveBeenCalledWith(
      'pause all boom',
      'services.torrent-command-handler.toast.pause-all-failed-title',
    );
  });

  it('should call resumeTorrents and show an info toast on TORRENT_RESUME_ALL', async () => {
    commands$.next({ type: 'TORRENT_RESUME_ALL' });
    await flushPromises();
    expect(qbService.torrents.resume).toHaveBeenCalledWith('server-1', ['hash1', 'hash2']);
    expect(toastInfo).toHaveBeenCalledWith('services.torrent-command-handler.toast.resuming-all');
  });

  it('should show a danger toast with the raw error when resume-all fails', async () => {
    qbService.torrents.resume.mockRejectedValueOnce(new Error('resume all boom'));
    commands$.next({ type: 'TORRENT_RESUME_ALL' });
    await flushPromises();
    expect(toastDanger).toHaveBeenCalledWith(
      'resume all boom',
      'services.torrent-command-handler.toast.resume-all-failed-title',
    );
  });

  it('should call topPrio and show no info toast on QUEUE_MOVE_TOP', async () => {
    commands$.next({ type: 'QUEUE_MOVE_TOP' });
    await flushPromises();
    expect(qbService.torrents.topPrio).toHaveBeenCalledWith('server-1', ['hash1', 'hash2']);
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it('should show a danger toast when moving to top of queue fails', async () => {
    qbService.torrents.topPrio.mockRejectedValueOnce(new Error('top boom'));
    commands$.next({ type: 'QUEUE_MOVE_TOP' });
    await flushPromises();
    expect(toastDanger).toHaveBeenCalledWith(
      'top boom',
      'services.torrent-command-handler.toast.move-top-failed-title',
    );
  });

  it('should call increasePrio and show no info toast on QUEUE_MOVE_UP', async () => {
    commands$.next({ type: 'QUEUE_MOVE_UP' });
    await flushPromises();
    expect(qbService.torrents.increasePrio).toHaveBeenCalledWith('server-1', ['hash1', 'hash2']);
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it('should show a danger toast when moving up in queue fails', async () => {
    qbService.torrents.increasePrio.mockRejectedValueOnce(new Error('up boom'));
    commands$.next({ type: 'QUEUE_MOVE_UP' });
    await flushPromises();
    expect(toastDanger).toHaveBeenCalledWith(
      'up boom',
      'services.torrent-command-handler.toast.move-up-failed-title',
    );
  });

  it('should call decreasePrio and show no info toast on QUEUE_MOVE_DOWN', async () => {
    commands$.next({ type: 'QUEUE_MOVE_DOWN' });
    await flushPromises();
    expect(qbService.torrents.decreasePrio).toHaveBeenCalledWith('server-1', ['hash1', 'hash2']);
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it('should show a danger toast when moving down in queue fails', async () => {
    qbService.torrents.decreasePrio.mockRejectedValueOnce(new Error('down boom'));
    commands$.next({ type: 'QUEUE_MOVE_DOWN' });
    await flushPromises();
    expect(toastDanger).toHaveBeenCalledWith(
      'down boom',
      'services.torrent-command-handler.toast.move-down-failed-title',
    );
  });

  it('should call bottomPrio and show no info toast on QUEUE_MOVE_BOTTOM', async () => {
    commands$.next({ type: 'QUEUE_MOVE_BOTTOM' });
    await flushPromises();
    expect(qbService.torrents.bottomPrio).toHaveBeenCalledWith('server-1', ['hash1', 'hash2']);
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it('should show a danger toast when moving to bottom of queue fails', async () => {
    qbService.torrents.bottomPrio.mockRejectedValueOnce(new Error('bottom boom'));
    commands$.next({ type: 'QUEUE_MOVE_BOTTOM' });
    await flushPromises();
    expect(toastDanger).toHaveBeenCalledWith(
      'bottom boom',
      'services.torrent-command-handler.toast.move-bottom-failed-title',
    );
  });

  it('should call reannounceTorrents and show an info toast on TORRENT_REANNOUNCE', async () => {
    commands$.next({ type: 'TORRENT_REANNOUNCE' });
    await flushPromises();
    expect(qbService.torrents.reannounce).toHaveBeenCalledWith('server-1', ['hash1', 'hash2']);
    expect(toastInfo).toHaveBeenCalledWith('services.torrent-command-handler.toast.reannouncing');
  });

  it('should show a danger toast with the raw error when reannounce fails', async () => {
    qbService.torrents.reannounce.mockRejectedValueOnce(new Error('reannounce boom'));
    commands$.next({ type: 'TORRENT_REANNOUNCE' });
    await flushPromises();
    expect(toastDanger).toHaveBeenCalledWith(
      'reannounce boom',
      'services.torrent-command-handler.toast.reannounce-failed-title',
    );
  });

  it('should call recheckTorrents and show an info toast on TORRENT_RECHECK', async () => {
    commands$.next({ type: 'TORRENT_RECHECK' });
    await flushPromises();
    expect(qbService.torrents.recheck).toHaveBeenCalledWith('server-1', ['hash1', 'hash2']);
    expect(toastInfo).toHaveBeenCalledWith('services.torrent-command-handler.toast.rechecking');
  });

  it('should show a danger toast with the raw error when recheck fails', async () => {
    qbService.torrents.recheck.mockRejectedValueOnce(new Error('recheck boom'));
    commands$.next({ type: 'TORRENT_RECHECK' });
    await flushPromises();
    expect(toastDanger).toHaveBeenCalledWith(
      'recheck boom',
      'services.torrent-command-handler.toast.recheck-failed-title',
    );
  });

  it('should call setSuperSeeding with inverted status and no info toast on TORRENT_SUPER_SEEDING', async () => {
    commands$.next({ type: 'TORRENT_SUPER_SEEDING', status: false });
    await flushPromises();
    expect(qbService.torrents.setSuperSeeding).toHaveBeenCalledWith(
      'server-1',
      ['hash1', 'hash2'],
      true,
    );
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it('should show "failed to enable" when enabling super seeding fails', async () => {
    qbService.torrents.setSuperSeeding.mockRejectedValueOnce(new Error('super seeding boom'));
    commands$.next({ type: 'TORRENT_SUPER_SEEDING', status: false });
    await flushPromises();
    expect(toastDanger).toHaveBeenCalledWith(
      'super seeding boom',
      'services.torrent-command-handler.toast.enable-super-seeding-failed-title',
    );
  });

  it('should show "failed to disable" when disabling super seeding fails', async () => {
    qbService.torrents.setSuperSeeding.mockRejectedValueOnce(new Error('super seeding boom'));
    commands$.next({ type: 'TORRENT_SUPER_SEEDING', status: true });
    await flushPromises();
    expect(toastDanger).toHaveBeenCalledWith(
      'super seeding boom',
      'services.torrent-command-handler.toast.disable-super-seeding-failed-title',
    );
  });

  it('should call setForceStart and show an info toast on TORRENT_FORCE_RESUME', async () => {
    commands$.next({ type: 'TORRENT_FORCE_RESUME' });
    await flushPromises();
    expect(qbService.torrents.setForceStart).toHaveBeenCalledWith(
      'server-1',
      ['hash1', 'hash2'],
      true,
    );
    expect(toastInfo).toHaveBeenCalledWith('services.torrent-command-handler.toast.force-resuming');
  });

  it('should show a danger toast with the raw error when force resume fails', async () => {
    qbService.torrents.setForceStart.mockRejectedValueOnce(new Error('force resume boom'));
    commands$.next({ type: 'TORRENT_FORCE_RESUME' });
    await flushPromises();
    expect(toastDanger).toHaveBeenCalledWith(
      'force resume boom',
      'services.torrent-command-handler.toast.force-resume-failed-title',
    );
  });

  it('should call setAutoManagement with inverted status and no info toast on TORRENT_AUTO_TMM', async () => {
    commands$.next({ type: 'TORRENT_AUTO_TMM', status: true });
    await flushPromises();
    expect(qbService.torrents.setAutoManagement).toHaveBeenCalledWith(
      'server-1',
      ['hash1', 'hash2'],
      false,
    );
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it('should show "failed to enable" when enabling auto-tmm fails', async () => {
    qbService.torrents.setAutoManagement.mockRejectedValueOnce(new Error('auto tmm boom'));
    commands$.next({ type: 'TORRENT_AUTO_TMM', status: false });
    await flushPromises();
    expect(toastDanger).toHaveBeenCalledWith(
      'auto tmm boom',
      'services.torrent-command-handler.toast.enable-auto-tmm-failed-title',
    );
  });

  it('should show "failed to disable" when disabling auto-tmm fails', async () => {
    qbService.torrents.setAutoManagement.mockRejectedValueOnce(new Error('auto tmm boom'));
    commands$.next({ type: 'TORRENT_AUTO_TMM', status: true });
    await flushPromises();
    expect(toastDanger).toHaveBeenCalledWith(
      'auto tmm boom',
      'services.torrent-command-handler.toast.disable-auto-tmm-failed-title',
    );
  });

  it('should ignore non-torrent/queue commands', async () => {
    commands$.next({ type: 'SERVER_ADDED', id: '1' });
    await flushPromises();
    expect(qbService.torrents.pause).not.toHaveBeenCalled();
  });

  describe('TORRENT_TOGGLE_SEQUENTIAL_DOWNLOAD', () => {
    it('calls toggleSequentialDownload with server id and selected hashes', async () => {
      commands$.next({ type: 'TORRENT_TOGGLE_SEQUENTIAL_DOWNLOAD' });
      await flushPromises();
      expect(qbService.torrents.toggleSequentialDownload).toHaveBeenCalledWith('server-1', [
        'hash1',
        'hash2',
      ]);
    });

    it('shows danger toast when toggleSequentialDownload fails', async () => {
      qbService.torrents.toggleSequentialDownload.mockRejectedValueOnce(new Error('network error'));
      commands$.next({ type: 'TORRENT_TOGGLE_SEQUENTIAL_DOWNLOAD' });
      await flushPromises();
      expect(toastDanger).toHaveBeenCalledWith(
        'network error',
        'services.torrent-command-handler.toast.toggle-sequential-download-failed-title',
      );
    });
  });

  describe('TORRENT_TOGGLE_FIRST_LAST_PIECE_PRIO', () => {
    it('calls toggleFirstLastPiecePrio with server id and selected hashes', async () => {
      commands$.next({ type: 'TORRENT_TOGGLE_FIRST_LAST_PIECE_PRIO' });
      await flushPromises();
      expect(qbService.torrents.toggleFirstLastPiecePrio).toHaveBeenCalledWith('server-1', [
        'hash1',
        'hash2',
      ]);
    });

    it('shows danger toast when toggleFirstLastPiecePrio fails', async () => {
      qbService.torrents.toggleFirstLastPiecePrio.mockRejectedValueOnce(new Error('network error'));
      commands$.next({ type: 'TORRENT_TOGGLE_FIRST_LAST_PIECE_PRIO' });
      await flushPromises();
      expect(toastDanger).toHaveBeenCalledWith(
        'network error',
        'services.torrent-command-handler.toast.toggle-first-last-piece-prio-failed-title',
      );
    });
  });
});
