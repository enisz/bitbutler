import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import {
  DEFAULT_GENERAL_SETTINGS,
  GeneralSettings,
  NotificationSettings,
} from '../models/general-settings.model';
import { GeneralSettingsService } from './general-settings.service';
import { NotificationPolicyService, OS_DEDUPE_WINDOW_MS } from './notification-policy.service';
import { WindowService } from './window.service';

type NotificationOverrides = {
  os?: Partial<NotificationSettings['os']>;
  app?: Partial<NotificationSettings['app']>;
};

function settingsWith(overrides: NotificationOverrides): GeneralSettings {
  const { os, app } = DEFAULT_GENERAL_SETTINGS.notifications;
  return {
    ...DEFAULT_GENERAL_SETTINGS,
    notifications: { os: { ...os, ...overrides.os }, app: { ...app, ...overrides.app } },
  };
}

describe('NotificationPolicyService', () => {
  let service: NotificationPolicyService;
  let settings$: Subject<GeneralSettings>;
  let windowState: ReturnType<typeof signal<{ isMinimized: boolean }>>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));

    settings$ = new Subject<GeneralSettings>();
    windowState = signal({ isMinimized: false });

    TestBed.configureTestingModule({
      providers: [
        NotificationPolicyService,
        { provide: GeneralSettingsService, useValue: { asObservable: () => settings$ } },
        { provide: WindowService, useValue: { state: windowState } },
      ],
    });

    service = TestBed.inject(NotificationPolicyService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('defaults (before settings load)', () => {
    it('allows every category in the app', () => {
      for (const category of ['finished', 'errors', 'updates', 'confirmations'] as const) {
        expect(service.allowApp(category)).toBe(true);
      }
    });

    it('allows finished, errors and updates on the OS while the window is visible', () => {
      expect(service.allowOs('finished', 'T', 'a')).toBe(true);
      expect(service.allowOs('errors', 'T', 'b')).toBe(true);
      expect(service.allowOs('updates', 'T', 'c')).toBe(true);
    });
  });

  it('never allows confirmations on the OS, even when everything is enabled', () => {
    expect(service.allowOs('confirmations', 'T', 'a')).toBe(false);
  });

  describe('app channel', () => {
    it('blocks every category when the app master switch is off', () => {
      settings$.next(settingsWith({ app: { enabled: false } }));
      expect(service.allowApp('finished')).toBe(false);
      expect(service.allowApp('confirmations')).toBe(false);
    });

    it('blocks only the category whose switch is off', () => {
      settings$.next(settingsWith({ app: { confirmations: false } }));
      expect(service.allowApp('confirmations')).toBe(false);
      expect(service.allowApp('errors')).toBe(true);
    });
  });

  describe('OS channel', () => {
    it('blocks every category when the OS master switch is off', () => {
      settings$.next(settingsWith({ os: { enabled: false } }));
      expect(service.allowOs('finished', 'T', 'a')).toBe(false);
    });

    it('blocks only the category whose switch is off', () => {
      settings$.next(settingsWith({ os: { errors: false } }));
      expect(service.allowOs('errors', 'T', 'a')).toBe(false);
      expect(service.allowOs('finished', 'T', 'a')).toBe(true);
    });

    it('with onlyWhenMinimized, blocks while the window is visible and allows while minimized', () => {
      settings$.next(settingsWith({ os: { onlyWhenMinimized: true } }));
      expect(service.allowOs('finished', 'T', 'a')).toBe(false);

      windowState.set({ isMinimized: true });
      expect(service.allowOs('finished', 'T', 'a')).toBe(true);
    });

    it('does not use the app channel switches', () => {
      settings$.next(settingsWith({ app: { enabled: false } }));
      expect(service.allowOs('finished', 'T', 'a')).toBe(true);
    });
  });

  describe('OS dedupe', () => {
    it('shows an identical notification once within the window', () => {
      expect(service.allowOs('errors', 'Failed', 'timeout')).toBe(true);
      expect(service.allowOs('errors', 'Failed', 'timeout')).toBe(false);
    });

    it('shows the same notification again after the window has passed', () => {
      expect(service.allowOs('errors', 'Failed', 'timeout')).toBe(true);
      vi.advanceTimersByTime(OS_DEDUPE_WINDOW_MS);
      expect(service.allowOs('errors', 'Failed', 'timeout')).toBe(true);
    });

    it('treats a different body as a different notification', () => {
      expect(service.allowOs('errors', 'Failed', 'timeout')).toBe(true);
      expect(service.allowOs('errors', 'Failed', 'refused')).toBe(true);
    });

    it('does not record a notification that was blocked by the settings', () => {
      settings$.next(settingsWith({ os: { errors: false } }));
      expect(service.allowOs('errors', 'Failed', 'timeout')).toBe(false);

      settings$.next(settingsWith({ os: { errors: true } }));
      expect(service.allowOs('errors', 'Failed', 'timeout')).toBe(true);
    });

    it('does not dedupe the app channel', () => {
      expect(service.allowApp('errors')).toBe(true);
      expect(service.allowApp('errors')).toBe(true);
    });
  });
});
