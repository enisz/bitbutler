import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, firstValueFrom } from 'rxjs';
import { QbPollingService } from './qb-polling.service';
import { QbService } from './qb.service';
import { ServerSettingsService } from './server-settings.service';
import { WindowService } from './window.service';

describe('QbPollingService', () => {
  let service: QbPollingService;
  let mockQbService: any;
  let mockWindowService: any;
  let mockServerSettings: any;

  beforeEach(() => {
    mockQbService = {
      streamMaindata: vi.fn().mockReturnValue(new Subject()),
      maindata: vi.fn().mockResolvedValue({ rid: 1 }),
    };

    mockWindowService = {
      windowStateAsObservable: vi.fn().mockReturnValue(new Subject()),
    };

    mockServerSettings = {
      load: vi.fn().mockResolvedValue({ polling: { foreground: 2000, background: 5000 } }),
      asObservable: vi.fn().mockReturnValue(new Subject()),
    };

    TestBed.configureTestingModule({
      providers: [
        QbPollingService,
        { provide: QbService, useValue: mockQbService },
        { provide: WindowService, useValue: mockWindowService },
        { provide: ServerSettingsService, useValue: mockServerSettings },
      ],
    });

    service = TestBed.inject(QbPollingService);
  });

  it('should initialise isInitialLoading$ to false', async () => {
    const loading = await firstValueFrom(service.isInitialLoading$);
    expect(loading).toBe(false);
  });

  it('should expose pollingInterval$ observable', async () => {
    const interval = await firstValueFrom(service.pollingInterval$);
    expect(typeof interval).toBe('number');
  });

  it('should return the current polling interval from getPollingInterval()', () => {
    expect(typeof service.getPollingInterval()).toBe('number');
  });

  it('should reset isInitialLoading$ to false on stopPolling()', async () => {
    service.stopPolling();
    const loading = await firstValueFrom(service.isInitialLoading$);
    expect(loading).toBe(false);
  });

  it('should expose onPoll$ observable', () => {
    expect(service.onPoll$).toBeDefined();
  });

  it('should call streamMaindata when startMaindataPolling() is called', () => {
    service.startMaindataPolling('server-1');
    expect(mockQbService.streamMaindata).toHaveBeenCalledWith('server-1', 0, undefined, undefined);
  });

  it('should stop any previous polling when startMaindataPolling() is called again', () => {
    service.startMaindataPolling('server-1');
    service.startMaindataPolling('server-1');
    expect(mockQbService.streamMaindata).toHaveBeenCalledTimes(2);
  });
});
