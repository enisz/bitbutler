import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [NotificationService] });
    service = TestBed.inject(NotificationService);
  });

  it('should call window.bitbutler.notification.show when available', async () => {
    const spy = vi
      .spyOn(window.bitbutler.notification, 'show')
      .mockResolvedValue({ ok: true } as any);
    await service.send('Title', 'Body');
    expect(spy).toHaveBeenCalledWith({ title: 'Title', body: 'Body', options: undefined });
  });

  it('should pass options to window.bitbutler.notification.show', async () => {
    const spy = vi
      .spyOn(window.bitbutler.notification, 'show')
      .mockResolvedValue({ ok: true } as any);
    await service.send('T', 'B', { silent: true });
    expect(spy).toHaveBeenCalledWith({ title: 'T', body: 'B', options: { silent: true } });
  });

  it('should not throw when notification.show returns an error response', async () => {
    vi.spyOn(window.bitbutler.notification, 'show').mockResolvedValue({
      ok: false,
      error: 'Permission denied',
    } as any);
    await expect(service.send('T', 'B')).resolves.not.toThrow();
  });

  it('should not throw when notification.show throws', async () => {
    vi.spyOn(window.bitbutler.notification, 'show').mockRejectedValue(new Error('fail'));
    await expect(service.send('T', 'B')).resolves.not.toThrow();
  });
});
