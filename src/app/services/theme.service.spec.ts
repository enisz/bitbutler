import { TestBed } from '@angular/core/testing';
import { GeneralSettingsService } from './general-settings.service';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;
  let mockGeneralSettings: {
    load: ReturnType<typeof vi.fn>;
    asObservable?: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockGeneralSettings = {
      load: vi.fn().mockResolvedValue({
        appearance: { family: 'bitbutler', mode: 'system' },
        behavior: {},
        language: {},
      }),
    };

    TestBed.configureTestingModule({
      providers: [ThemeService, { provide: GeneralSettingsService, useValue: mockGeneralSettings }],
    });

    service = TestBed.inject(ThemeService);
  });

  it('should initialise family to bitbutler', () => {
    expect(service.family()).toBe('bitbutler');
  });

  it('should initialise mode to system', () => {
    expect(service.mode()).toBe('system');
  });

  it('should update family signal via setFamily()', () => {
    service.setFamily('aurora');
    expect(service.family()).toBe('aurora');
  });

  it('should update mode signal via setMode()', () => {
    service.setMode('dark');
    expect(service.mode()).toBe('dark');
  });

  it('should apply family and mode via applyFromSettings()', () => {
    service.applyFromSettings('ocean-breeze', 'light');
    expect(service.family()).toBe('ocean-breeze');
    expect(service.mode()).toBe('light');
  });

  it('should update family and mode after init()', async () => {
    mockGeneralSettings.load.mockResolvedValue({
      appearance: { family: 'deep-sea', mode: 'dark' },
    });
    await service.init();
    expect(service.family()).toBe('deep-sea');
    expect(service.mode()).toBe('dark');
  });

  it('should return a valid effective mode (light or dark)', () => {
    const effective = service.effectiveMode();
    expect(['light', 'dark']).toContain(effective);
  });

  it('should return light or dark from getSystemMode()', () => {
    const mode = service.getSystemMode();
    expect(['light', 'dark']).toContain(mode);
  });
});
