import { Overlay } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { GeneralSettingsService } from './general-settings.service';
import { NotificationPolicyService } from './notification-policy.service';
import { NotificationService } from './notification.service';
import { ThemeService } from './theme.service';
import { ToastService } from './toast.service';

describe('ToastService - showText()', () => {
  let service: ToastService;
  let mockOverlay: any;
  let mockContainer: any;
  let settings$: Subject<any>;
  let mockGeneralSettings: any;
  let mockThemeService: any;
  let mockSanitizer: any;
  let mockTranslate: { instant: ReturnType<typeof vi.fn> };
  let mockPolicy: { allowApp: ReturnType<typeof vi.fn>; allowOs: ReturnType<typeof vi.fn> };
  let mockNotificationService: { send: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockContainer = {
      add: vi.fn(),
      toasts: () => [],
      beginDismiss: vi.fn(),
      remove: vi.fn(),
      position: { set: vi.fn() },
    };

    mockOverlay = {
      create: vi.fn().mockReturnValue({
        attach: vi.fn().mockReturnValue({ instance: mockContainer }),
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

    settings$ = new Subject();
    mockGeneralSettings = {
      asObservable: vi.fn().mockReturnValue(settings$),
    };

    mockThemeService = {
      mode: vi.fn().mockReturnValue('dark'),
      getSystemMode: vi.fn().mockReturnValue('dark'),
    };

    mockSanitizer = {
      sanitize: vi.fn().mockImplementation((_ctx: any, html: string) => html),
    };

    mockTranslate = { instant: vi.fn((key: string) => key) };

    mockPolicy = {
      allowApp: vi.fn().mockReturnValue(true),
      allowOs: vi.fn().mockReturnValue(false),
    };

    mockNotificationService = { send: vi.fn().mockResolvedValue(undefined) };

    TestBed.configureTestingModule({
      providers: [
        ToastService,
        { provide: Overlay, useValue: mockOverlay },
        { provide: DomSanitizer, useValue: mockSanitizer },
        { provide: GeneralSettingsService, useValue: mockGeneralSettings },
        { provide: ThemeService, useValue: mockThemeService },
        { provide: TranslateService, useValue: mockTranslate },
        { provide: NotificationPolicyService, useValue: mockPolicy },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    });

    service = TestBed.inject(ToastService);
  });

  it('should escape & in showText()', () => {
    service.showText('a & b');
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

  describe('notification routing', () => {
    it('derives the errors category for danger toasts', () => {
      service.danger('boom', 'Failed');
      expect(mockPolicy.allowApp).toHaveBeenCalledWith('errors');
      expect(mockPolicy.allowOs).toHaveBeenCalledWith('errors', 'Failed', 'boom');
    });

    it('derives the errors category for warning toasts', () => {
      service.warning('careful', 'Heads Up');
      expect(mockPolicy.allowApp).toHaveBeenCalledWith('errors');
    });

    it('derives the confirmations category for success and info toasts', () => {
      service.success('done', 'Saved');
      service.info('fyi', 'Note');
      expect(mockPolicy.allowApp).toHaveBeenNthCalledWith(1, 'confirmations');
      expect(mockPolicy.allowApp).toHaveBeenNthCalledWith(2, 'confirmations');
    });

    it('uses an explicit category instead of the derived one', () => {
      service.showText('Movie', {
        type: 'success',
        title: 'Download Finished',
        category: 'finished',
      });
      expect(mockPolicy.allowApp).toHaveBeenCalledWith('finished');
      expect(mockPolicy.allowOs).toHaveBeenCalledWith('finished', 'Download Finished', 'Movie');
    });

    it('shows the toast when the app channel allows it', () => {
      service.showText('hello');
      expect(mockContainer.add).toHaveBeenCalledTimes(1);
    });

    it('does not show the toast and returns an empty id when the app channel blocks it', () => {
      mockPolicy.allowApp.mockReturnValue(false);
      const id = service.showText('hello');
      expect(id).toBe('');
      expect(mockContainer.add).not.toHaveBeenCalled();
    });

    it('still sends the OS notification when the app channel blocks the toast', () => {
      mockPolicy.allowApp.mockReturnValue(false);
      mockPolicy.allowOs.mockReturnValue(true);
      service.danger('boom', 'Failed');
      expect(mockNotificationService.send).toHaveBeenCalledWith('Failed', 'boom');
    });

    it('does not send an OS notification when the OS channel blocks it', () => {
      service.danger('boom', 'Failed');
      expect(mockNotificationService.send).not.toHaveBeenCalled();
    });

    it('keeps a toast out of the OS channel when notifyOs is false, but still shows it in the app', () => {
      mockPolicy.allowOs.mockReturnValue(true);
      service.showText('retrying', { type: 'warning', title: 'Connection Issue', notifyOs: false });
      expect(mockPolicy.allowOs).not.toHaveBeenCalled();
      expect(mockNotificationService.send).not.toHaveBeenCalled();
      expect(mockContainer.add).toHaveBeenCalledTimes(1);
    });

    it('sends the message to the OS as plain text, not markup', () => {
      mockPolicy.allowOs.mockReturnValue(true);
      service.showHtml('<b>Done</b><br>now &amp; later', { title: 'T', type: 'danger' });
      expect(mockNotificationService.send).toHaveBeenCalledWith('T', 'Done\nnow & later');
    });

    it('dismissing the empty id of a blocked toast does not throw', () => {
      mockPolicy.allowApp.mockReturnValue(false);
      const id = service.showText('hello');
      expect(() => service.dismiss(id)).not.toThrow();
    });

    it('positions the toast container from notifications.app.position', () => {
      settings$.next({ notifications: { app: { position: 'top-left' } } });
      service.showText('hello');
      expect(mockContainer.position.set).toHaveBeenCalledWith('top-left');
    });
  });
});
