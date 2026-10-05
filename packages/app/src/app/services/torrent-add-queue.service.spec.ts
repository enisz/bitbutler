import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import type { TorrentAddJob } from '@bitbutler/shared';
import { TranslateService } from '@ngx-translate/core';
import { CommandBusService } from './command-bus.service';
import { ToastService } from './toast.service';
import { TorrentAddQueueService } from './torrent-add-queue.service';

function job(overrides: Partial<TorrentAddJob> = {}, payload = {}): TorrentAddJob {
  return {
    id: 'job-1',
    status: 'pending',
    createdAt: 0,
    payload: { serverId: 'server-1', add: { torrents: [] }, ...payload },
    ...overrides,
  };
}

const PREFIX = 'services.torrent-add-queue.';

describe('TorrentAddQueueService', () => {
  let service: TorrentAddQueueService;
  let emitUpdate: (job: TorrentAddJob) => void;
  let commandBus: { emit: ReturnType<typeof vi.fn> };
  let toast: { danger: ReturnType<typeof vi.fn>; showText: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    commandBus = { emit: vi.fn() };
    toast = { danger: vi.fn(), showText: vi.fn() };
    router = { navigate: vi.fn() };
    vi.spyOn(window.bitbutler.torrentQueue, 'list').mockResolvedValue([]);
    vi.spyOn(window.bitbutler.torrentQueue, 'retry').mockResolvedValue();
    vi.spyOn(window.bitbutler.torrentQueue, 'dismiss').mockResolvedValue();
    vi.spyOn(window.bitbutler.torrentQueue, 'onUpdate').mockImplementation((cb) => {
      emitUpdate = cb;
      return () => {};
    });

    TestBed.configureTestingModule({
      providers: [
        { provide: CommandBusService, useValue: commandBus },
        { provide: ToastService, useValue: toast },
        { provide: Router, useValue: router },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    service = TestBed.inject(TorrentAddQueueService);
    service.start();
  });

  const failureToast = () => toast.showText.mock.calls[0] as [string, any];

  describe('job tracking', () => {
    it('upserts jobs by id', () => {
      emitUpdate(job());
      emitUpdate(job({ status: 'adding' }));
      emitUpdate(job({ id: 'job-2' }));

      expect(service.jobs().map((j) => [j.id, j.status])).toEqual([
        ['job-1', 'adding'],
        ['job-2', 'pending'],
      ]);
    });

    it('drops jobs that are done or duplicate', () => {
      emitUpdate(job({ id: 'a' }));
      emitUpdate(job({ id: 'b' }));
      emitUpdate(job({ id: 'a', status: 'done' }));
      emitUpdate(job({ id: 'b', status: 'duplicate' }));

      expect(service.jobs()).toEqual([]);
    });

    it('does not notify for in-progress or done jobs', () => {
      emitUpdate(job({ status: 'adding' }));
      emitUpdate(job({ status: 'done' }));

      expect(toast.showText).not.toHaveBeenCalled();
      expect(toast.danger).not.toHaveBeenCalled();
      expect(commandBus.emit).not.toHaveBeenCalled();
    });
  });

  describe('duplicates', () => {
    it('emits UI_TORRENT_EXISTS by default', () => {
      emitUpdate(
        job({ status: 'duplicate' }, { infoHash: 'ABC123', originalPath: '/tmp/a.torrent' }),
      );

      expect(commandBus.emit).toHaveBeenCalledWith({
        type: 'UI_TORRENT_EXISTS',
        hash: 'abc123',
        originalPath: '/tmp/a.torrent',
      });
      expect(toast.danger).not.toHaveBeenCalled();
    });

    it('emits UI_TORRENT_EXISTS with null hash and path when neither is known', () => {
      emitUpdate(job({ status: 'duplicate' }));

      expect(commandBus.emit).toHaveBeenCalledWith({
        type: 'UI_TORRENT_EXISTS',
        hash: null,
        originalPath: null,
      });
    });

    it('toasts instead of raising the dialog when duplicateAs is toast', () => {
      emitUpdate(job({ status: 'duplicate' }, { displayName: 'My Torrent', duplicateAs: 'toast' }));

      expect(toast.danger).toHaveBeenCalledWith('My Torrent', `${PREFIX}toast.duplicate.title`);
      expect(commandBus.emit).not.toHaveBeenCalled();
    });
  });

  describe('failures', () => {
    it('shows a danger toast naming the torrent and the reason, with a Retry action', () => {
      emitUpdate(
        job(
          { status: 'error', error: 'HTTP 500', failedStage: 'add' },
          { displayName: 'My Torrent' },
        ),
      );

      const [message, opts] = failureToast();
      expect(message).toBe('"My Torrent": HTTP 500');
      expect(opts.type).toBe('danger');
      expect(opts.title).toBe(`${PREFIX}toast.add-failed.title`);
      expect(opts.actions.map((a: any) => [a.label, a.kind])).toEqual([
        [`${PREFIX}action.retry`, 'primary'],
      ]);
    });

    it('omits the name when there is none', () => {
      emitUpdate(job({ status: 'error', error: 'HTTP 500', failedStage: 'add' }));

      expect(failureToast()[0]).toBe('HTTP 500');
    });

    it('uses a different title when the add succeeded but setup failed', () => {
      emitUpdate(job({ status: 'error', error: 'HTTP 400', failedStage: 'setup' }));

      expect(failureToast()[1].title).toBe(`${PREFIX}toast.setup-failed.title`);
    });

    it('offers Retry and Log In when the session expired', () => {
      emitUpdate(
        job({ status: 'error', error: 'HTTP 403', failedStage: 'add', authExpired: true }),
      );

      const [, opts] = failureToast();
      expect(opts.title).toBe(`${PREFIX}toast.session-expired.title`);
      expect(opts.actions.map((a: any) => [a.label, a.kind])).toEqual([
        [`${PREFIX}action.retry`, 'text'],
        [`${PREFIX}action.log-in`, 'primary'],
      ]);

      opts.actions[1].onClick();
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('retries the job through main when Retry is clicked', () => {
      emitUpdate(job({ status: 'error', error: 'HTTP 500', failedStage: 'add' }));

      failureToast()[1].actions[0].onClick();

      expect(window.bitbutler.torrentQueue.retry).toHaveBeenCalledWith('job-1');
    });

    it('forgets the job in both processes when the toast is closed without acting', () => {
      emitUpdate(job({ status: 'error', error: 'HTTP 500', failedStage: 'add' }));
      expect(service.jobs()).toHaveLength(1);

      failureToast()[1].onDismiss();

      expect(service.jobs()).toEqual([]);
      expect(window.bitbutler.torrentQueue.dismiss).toHaveBeenCalledWith('job-1');
    });

    it('keeps the failed job tracked until the user acts', () => {
      emitUpdate(job({ status: 'error', error: 'HTTP 500', failedStage: 'add' }));

      expect(service.jobs().map((j) => j.status)).toEqual(['error']);
    });
  });
});
