import { TestBed } from '@angular/core/testing';
import { ElectronService } from './electron.service';
import { ToastService } from './toast.service';

describe('ElectronService', () => {
  let service: ElectronService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ElectronService, { provide: ToastService, useValue: {} }],
    });
    service = TestBed.inject(ElectronService);
  });

  it('should delegate isDev() to window.bitbutler.electron.isDev', async () => {
    const spy = vi.spyOn(window.bitbutler.electron, 'isDev').mockResolvedValue(true);
    const result = await service.isDev();
    expect(spy).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('should delegate getPlatform() to window.bitbutler.electron.getPlatform', async () => {
    const spy = vi.spyOn(window.bitbutler.electron, 'getPlatform').mockResolvedValue('win32');
    const result = await service.getPlatform();
    expect(spy).toHaveBeenCalled();
    expect(result).toBe('win32');
  });

  it('should delegate openExternalUrl() to window.bitbutler.electron.openExternalUrl', () => {
    const spy = vi
      .spyOn(window.bitbutler.electron, 'openExternalUrl')
      .mockResolvedValue(undefined as any);
    service.openExternalUrl('https://example.com');
    expect(spy).toHaveBeenCalledWith('https://example.com');
  });

  it('should delegate showOpenDialog() to window.bitbutler.electron.showOpenDialog', async () => {
    const spy = vi
      .spyOn(window.bitbutler.electron, 'showOpenDialog')
      .mockResolvedValue('/some/path');
    const result = await service.showOpenDialog();
    expect(spy).toHaveBeenCalled();
    expect(result).toBe('/some/path');
  });

  it('should return version string from getBitButlerVersion()', () => {
    const version = service.getBitButlerVersion();
    expect(typeof version === 'string' || version === null).toBe(true);
  });

  it('should return short commit when short=true in getBitButlerCommit()', () => {
    const commit = service.getBitButlerCommit(false);
    const shortCommit = service.getBitButlerCommit(true);
    if (commit !== null) {
      expect(shortCommit!.length).toBeLessThanOrEqual(commit.length);
      expect(shortCommit!.length).toBe(7);
    } else {
      expect(shortCommit).toBeNull();
    }
  });

  it('should delegate checkForUpdate() to window.bitbutler.electron.checkForUpdate', async () => {
    const mockResponse = { updateAvailable: false, error: null };
    const spy = vi
      .spyOn(window.bitbutler.electron, 'checkForUpdate')
      .mockResolvedValue(mockResponse as any);
    const result = await service.checkForUpdate();
    expect(spy).toHaveBeenCalled();
    expect(result).toEqual(mockResponse);
  });
});
