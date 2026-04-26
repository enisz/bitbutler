import { TestBed } from '@angular/core/testing';
import { PathService } from './path.service';
import { ElectronService } from './electron.service';
import { ServerSettingsService } from './server-settings.service';

const makeSettings = (pathMappings: { remote: string; local: string }[]) => ({
  pathMappings,
  polling: { foreground: 2000, background: 5000 },
});

describe('PathService', () => {
  let service: PathService;
  let mockElectron: { getPlatform: ReturnType<typeof vi.fn> };
  let mockServerSettings: { load: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockElectron = { getPlatform: vi.fn().mockResolvedValue('linux') };
    mockServerSettings = { load: vi.fn().mockResolvedValue(makeSettings([])) };

    TestBed.configureTestingModule({
      providers: [
        PathService,
        { provide: ElectronService, useValue: mockElectron },
        { provide: ServerSettingsService, useValue: mockServerSettings },
      ],
    });

    service = TestBed.inject(PathService);
  });

  it('should return null for a null remote path', async () => {
    const result = await service.resolveLocalPath(null);
    expect(result).toBeNull();
  });

  it('should return null for an empty string remote path', async () => {
    const result = await service.resolveLocalPath('');
    expect(result).toBeNull();
  });

  it('should return null when no path mappings exist', async () => {
    mockServerSettings.load.mockResolvedValue(makeSettings([]));
    const result = await service.resolveLocalPath('/remote/path/to/file');
    expect(result).toBeNull();
  });

  it('should resolve a matching remote path to local on linux', async () => {
    mockServerSettings.load.mockResolvedValue(
      makeSettings([{ remote: '/remote', local: '/local' }]),
    );
    const result = await service.resolveLocalPath('/remote/path/to/file');
    expect(result).toBe('/local/path/to/file');
  });

  it('should return null when no mapping matches the remote path', async () => {
    mockServerSettings.load.mockResolvedValue(
      makeSettings([{ remote: '/other', local: '/local' }]),
    );
    const result = await service.resolveLocalPath('/remote/path/to/file');
    expect(result).toBeNull();
  });

  it('should normalize paths on linux (replace double slashes)', async () => {
    mockServerSettings.load.mockResolvedValue(
      makeSettings([{ remote: '/remote/', local: '/local/' }]),
    );
    const result = await service.resolveLocalPath('/remote/path');
    expect(result).not.toContain('//');
  });

  it('should convert path separators to backslash on win32', async () => {
    // Override the platform mock to win32 and reload the service with a fresh module
    mockElectron.getPlatform.mockResolvedValue('win32');
    mockServerSettings.load.mockResolvedValue(
      makeSettings([{ remote: '/remote', local: 'C:\\local' }]),
    );
    // The PathService caches the platform promise in constructor.
    // Access private field to reset it for this test.
    (service as any).platformPromise = mockElectron.getPlatform();
    const result = await service.resolveLocalPath('/remote/subdir');
    expect(result).toContain('\\');
  });

  it('should use the first matching mapping', async () => {
    mockServerSettings.load.mockResolvedValue(
      makeSettings([
        { remote: '/remote', local: '/first' },
        { remote: '/remote', local: '/second' },
      ]),
    );
    const result = await service.resolveLocalPath('/remote/file');
    expect(result).toContain('/first');
  });
});
