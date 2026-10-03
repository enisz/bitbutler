import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { AppCommand } from '../models/command.model';
import { CommandBusService } from './command-bus.service';
import { TagCommandHandlerService } from './tag-command-handler.service';
import { ToastService } from './toast.service';

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve));

describe('TagCommandHandlerService', () => {
  let service: TagCommandHandlerService;
  let commands$: Subject<AppCommand>;
  let toastSuccess: ReturnType<typeof vi.fn>;
  let toastInfo: ReturnType<typeof vi.fn>;
  let translateService: { instant: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    commands$ = new Subject<AppCommand>();
    toastSuccess = vi.fn();
    toastInfo = vi.fn();
    translateService = { instant: vi.fn((key: string) => key) };

    TestBed.configureTestingModule({
      providers: [
        TagCommandHandlerService,
        { provide: CommandBusService, useValue: { commands$: commands$.asObservable() } },
        { provide: ToastService, useValue: { success: toastSuccess, info: toastInfo } },
        { provide: TranslateService, useValue: translateService },
      ],
    });

    service = TestBed.inject(TagCommandHandlerService);
    service.start();
  });

  it('should show success toast after TAG_ADDED', async () => {
    commands$.next({ type: 'TAG_ADDED', names: ['linux', 'ubuntu'] });
    await flushPromises();
    expect(toastSuccess).toHaveBeenCalledWith(
      '"linux, ubuntu"',
      'services.tag-command-handler.success.added-title',
    );
  });

  it('should show info toast after TAG_DELETED', async () => {
    commands$.next({ type: 'TAG_DELETED', names: ['linux'] });
    await flushPromises();
    expect(toastInfo).toHaveBeenCalledWith(
      '"linux"',
      'services.tag-command-handler.info.deleted-title',
    );
  });

  it('should ignore unrelated commands', async () => {
    commands$.next({ type: 'SERVER_DELETED', id: 'srv-1' });
    await flushPromises();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it('should not crash the subscription if a command throws', async () => {
    toastSuccess.mockImplementationOnce(() => {
      throw new Error('toast failed');
    });
    commands$.next({ type: 'TAG_ADDED', names: ['linux'] });
    await flushPromises();

    commands$.next({ type: 'TAG_DELETED', names: ['linux'] });
    await flushPromises();
    expect(toastInfo).toHaveBeenCalled();
  });
});
