import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { AppCommand } from '../models/command.model';
import { CategoryCommandHandlerService } from './category-command-handler.service';
import { CommandBusService } from './command-bus.service';
import { ToastService } from './toast.service';

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve));

describe('CategoryCommandHandlerService', () => {
  let service: CategoryCommandHandlerService;
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
        CategoryCommandHandlerService,
        { provide: CommandBusService, useValue: { commands$: commands$.asObservable() } },
        { provide: ToastService, useValue: { success: toastSuccess, info: toastInfo } },
        { provide: TranslateService, useValue: translateService },
      ],
    });

    service = TestBed.inject(CategoryCommandHandlerService);
    service.start();
  });

  it('should show success toast after CATEGORY_ADDED', async () => {
    commands$.next({ type: 'CATEGORY_ADDED', name: 'movies', savePath: '/data/movies' });
    await flushPromises();
    expect(toastSuccess).toHaveBeenCalledWith(
      '"movies"',
      'services.category-command-handler.success.added-title',
    );
  });

  it('should show info toast after CATEGORY_DELETED', async () => {
    commands$.next({ type: 'CATEGORY_DELETED', names: ['movies'] });
    await flushPromises();
    expect(toastInfo).toHaveBeenCalledWith(
      '"movies"',
      'services.category-command-handler.info.deleted-title',
    );
  });

  it('should NOT show any toast after CATEGORY_UPDATED (result already visible in the grid cell)', async () => {
    commands$.next({ type: 'CATEGORY_UPDATED', name: 'movies', savePath: '/data/movies2' });
    await flushPromises();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastInfo).not.toHaveBeenCalled();
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
    commands$.next({ type: 'CATEGORY_ADDED', name: 'movies', savePath: '/data/movies' });
    await flushPromises();

    commands$.next({ type: 'CATEGORY_DELETED', names: ['movies'] });
    await flushPromises();
    expect(toastInfo).toHaveBeenCalled();
  });
});
