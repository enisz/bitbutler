import { TestBed } from '@angular/core/testing';
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

describe('TorrentAddQueueService', () => {
  let service: TorrentAddQueueService;
  let emitUpdate: (job: TorrentAddJob) => void;
  let commandBus: { emit: ReturnType<typeof vi.fn> };
  let toast: { danger: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    commandBus = { emit: vi.fn() };
    toast = { danger: vi.fn() };
    vi.spyOn(window.bitbutler.torrentQueue, 'list').mockResolvedValue([]);
    vi.spyOn(window.bitbutler.torrentQueue, 'onUpdate').mockImplementation((cb) => {
      emitUpdate = cb;
      return () => {};
    });

    TestBed.configureTestingModule({
      providers: [
        { provide: CommandBusService, useValue: commandBus },
        { provide: ToastService, useValue: toast },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    service = TestBed.inject(TorrentAddQueueService);
    service.start();
  });

  it('upserts jobs by id', () => {
    emitUpdate(job());
    emitUpdate(job({ status: 'adding' }));
    emitUpdate(job({ id: 'job-2' }));

    expect(service.jobs().map((j) => [j.id, j.status])).toEqual([
      ['job-1', 'adding'],
      ['job-2', 'pending'],
    ]);
  });

  it('shows an error toast when a job fails', () => {
    emitUpdate(job({ status: 'error', error: 'HTTP 500' }));

    expect(toast.danger).toHaveBeenCalledWith(
      'HTTP 500',
      'services.torrent-add-queue.toast.job-failed.title',
    );
  });

  it('emits UI_TORRENT_EXISTS for a duplicate without a display name', () => {
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

  it('toasts instead of raising the dialog for a named (folder) duplicate', () => {
    emitUpdate(job({ status: 'duplicate' }, { name: 'My Torrent' }));

    expect(toast.danger).toHaveBeenCalledWith(
      'My Torrent',
      'services.torrent-add-queue.toast.duplicate.title',
    );
    expect(commandBus.emit).not.toHaveBeenCalled();
  });

  it('does not notify for in-progress or done jobs', () => {
    emitUpdate(job({ status: 'adding' }));
    emitUpdate(job({ status: 'done' }));

    expect(toast.danger).not.toHaveBeenCalled();
    expect(commandBus.emit).not.toHaveBeenCalled();
  });
});
