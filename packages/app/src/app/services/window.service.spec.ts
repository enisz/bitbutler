import { TestBed } from '@angular/core/testing';
import { WindowService } from './window.service';

describe('WindowService', () => {
  let service: WindowService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [WindowService] });
    service = TestBed.inject(WindowService);
  });

  it('should expose a signal for window state', () => {
    expect(service.state).toBeDefined();
    expect(typeof service.state).toBe('function');
  });

  it('should return the initial state from the signal', () => {
    const state = service.state();
    expect(state).toBeDefined();
    expect(typeof state.isMaximized).toBe('boolean');
  });

  it('should delegate maximize() to window.bitbutler.window.maximize', async () => {
    const spy = vi.spyOn(window.bitbutler.window, 'maximize').mockResolvedValue(undefined as any);
    await service.maximize();
    expect(spy).toHaveBeenCalled();
  });

  it('should delegate unmaximize() to window.bitbutler.window.unmaximize', async () => {
    const spy = vi.spyOn(window.bitbutler.window, 'unmaximize').mockResolvedValue(undefined as any);
    await service.unmaximize();
    expect(spy).toHaveBeenCalled();
  });

  it('should delegate toggleMaximize() to window.bitbutler.window.toggleMaximize', async () => {
    const spy = vi
      .spyOn(window.bitbutler.window, 'toggleMaximize')
      .mockResolvedValue(undefined as any);
    await service.toggleMaximize();
    expect(spy).toHaveBeenCalled();
  });

  it('should delegate setSize() to window.bitbutler.window.setSize', async () => {
    const spy = vi.spyOn(window.bitbutler.window, 'setSize').mockResolvedValue(undefined as any);
    await service.setSize(800, 600);
    expect(spy).toHaveBeenCalledWith(800, 600);
  });

  it('should delegate setOpenFilesEnabled() and return result', async () => {
    const spy = vi
      .spyOn(window.bitbutler.window, 'setOpenFilesEnabled')
      .mockResolvedValue({ enabled: true } as any);
    const result = await service.setOpenFilesEnabled(true);
    expect(spy).toHaveBeenCalledWith(true);
    expect(result).toEqual({ enabled: true });
  });
});
