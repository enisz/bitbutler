import { Overlay } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { GeneralSettingsService } from './general-settings.service';
import { ThemeService } from './theme.service';
import { ToastService } from './toast.service';

describe('ToastService - showText()', () => {
  let service: ToastService;
  let mockOverlay: any;
  let mockGeneralSettings: any;
  let mockThemeService: any;
  let mockSanitizer: any;
  let mockTranslate: { instant: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockOverlay = {
      create: vi.fn().mockReturnValue({
        attach: vi.fn().mockReturnValue({
          instance: {
            add: vi.fn(),
            toasts: () => [],
            beginDismiss: vi.fn(),
            remove: vi.fn(),
            position: { set: vi.fn() },
          },
        }),
        dispose: vi.fn(),
        updatePositionStrategy: vi.fn(),
      }),
      position: vi.fn().mockReturnValue({
        global: vi.fn().mockReturnValue({
          bottom: vi.fn().mockReturnThis(),
          right: vi.fn().mockReturnThis(),
          top: vi.fn().mockReturnThis(),
          left: vi.fn().mockReturnThis(),
        }),
      }),
      scrollStrategies: { noop: vi.fn().mockReturnValue({}) },
    };

    mockGeneralSettings = {
      asObservable: vi.fn().mockReturnValue(new Subject()),
    };

    mockThemeService = {
      mode: vi.fn().mockReturnValue('dark'),
      getSystemMode: vi.fn().mockReturnValue('dark'),
    };

    mockSanitizer = {
      sanitize: vi.fn().mockImplementation((_ctx: any, html: string) => html),
    };

    mockTranslate = { instant: vi.fn((key: string) => key) };

    TestBed.configureTestingModule({
      providers: [
        ToastService,
        { provide: Overlay, useValue: mockOverlay },
        { provide: DomSanitizer, useValue: mockSanitizer },
        { provide: GeneralSettingsService, useValue: mockGeneralSettings },
        { provide: ThemeService, useValue: mockThemeService },
        { provide: TranslateService, useValue: mockTranslate },
      ],
    });

    service = TestBed.inject(ToastService);
  });

  it('should escape & in showText()', () => {
    const id = service.showText('a & b');
    expect(mockSanitizer.sanitize).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('&amp;'),
    );
  });

  it('should escape < and > in showText()', () => {
    service.showText('<script>alert(1)</script>');
    expect(mockSanitizer.sanitize).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('&lt;'),
    );
    expect(mockSanitizer.sanitize).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('&gt;'),
    );
  });

  it('should convert \\n to <br> in showText()', () => {
    service.showText('line1\nline2');
    expect(mockSanitizer.sanitize).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('<br>'),
    );
  });

  it('should return a non-empty string id from showText()', () => {
    const id = service.showText('hello');
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('should return a non-empty string id from showHtml()', () => {
    const id = service.showHtml('<b>bold</b>');
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('should use "dark" type for adaptive() when mode is light', () => {
    mockThemeService.mode.mockReturnValue('light');
    const showHtmlSpy = vi.spyOn(service, 'showHtml');
    service.adaptive('<b>msg</b>', 'Title');
    expect(showHtmlSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ type: 'dark' }),
    );
  });

  it('should use "light" type for adaptive() when mode is dark', () => {
    mockThemeService.mode.mockReturnValue('dark');
    const showHtmlSpy = vi.spyOn(service, 'showHtml');
    service.adaptive('<b>msg</b>', 'Title');
    expect(showHtmlSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ type: 'light' }),
    );
  });

  it('should use the translated default title for success()', () => {
    const showHtmlSpy = vi.spyOn(service, 'showHtml');
    service.success('<b>msg</b>');
    expect(showHtmlSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ title: 'general.toast.success' }),
    );
  });

  it('should use the provided title instead of the translated default', () => {
    const showHtmlSpy = vi.spyOn(service, 'showHtml');
    service.success('<b>msg</b>', 'Custom Title');
    expect(showHtmlSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ title: 'Custom Title' }),
    );
  });
});
