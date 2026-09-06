import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import type { LogEntry } from '@bitbutler/shared';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import { LogGridSettings } from '../../models/log-grid.model';
import { ConfirmService } from '../../services/confirm.service';
import { LogGridSettingsService } from '../../services/log-grid.settings.service';
import { LogService } from '../../services/log.service';
import { ToastService } from '../../services/toast.service';
import { Logs } from './logs';

function makeLog(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 1,
    timestamp: 1700000000,
    process: 'main',
    level: 'info',
    message: 'hello',
    context: null,
    filename: null,
    line: null,
    ...overrides,
  };
}

describe('Logs', () => {
  let component: Logs;
  let fixture: ComponentFixture<Logs>;
  let settings$: BehaviorSubject<LogGridSettings>;
  let logServiceMock: { list: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn> };
  let logGridSettingsServiceMock: {
    asObservable: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let confirmServiceMock: { confirm: ReturnType<typeof vi.fn> };
  let toastServiceMock: { danger: ReturnType<typeof vi.fn> };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };

  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  beforeEach(async () => {
    settings$ = new BehaviorSubject<LogGridSettings>({
      columnState: null,
      colorCodingEnabled: false,
      compactRows: false,
    });
    logServiceMock = {
      list: vi.fn().mockResolvedValue([makeLog()]),
      clear: vi.fn().mockResolvedValue(undefined),
    };
    logGridSettingsServiceMock = {
      asObservable: vi.fn().mockReturnValue(settings$.asObservable()),
      save: vi.fn().mockResolvedValue(undefined),
    };
    confirmServiceMock = { confirm: vi.fn().mockResolvedValue(true) };
    toastServiceMock = { danger: vi.fn() };
    routerMock = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Logs, TranslateModule.forRoot()],
      providers: [
        { provide: LogService, useValue: logServiceMock },
        { provide: LogGridSettingsService, useValue: logGridSettingsServiceMock },
        { provide: ConfirmService, useValue: confirmServiceMock },
        { provide: ToastService, useValue: toastServiceMock },
        { provide: Router, useValue: routerMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(Logs);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('loads logs via LogService on init', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(logServiceMock.list).toHaveBeenCalled();
    expect(component.logs()).toEqual([makeLog()]);
  });

  it('goBack navigates to the torrent list', () => {
    fixture.detectChanges();
    component.goBack();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/pages/torrent-list']);
  });

  it('refresh re-fetches and replaces the logs signal', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    logServiceMock.list.mockResolvedValue([makeLog({ id: 2 })]);

    await component.refresh();

    expect(component.logs()).toEqual([makeLog({ id: 2 })]);
  });

  it('refresh shows a danger toast when LogService.list rejects', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    logServiceMock.list.mockRejectedValue(new Error('boom'));

    await component.refresh();

    expect(toastServiceMock.danger).toHaveBeenCalled();
  });

  describe('clear', () => {
    it('does nothing when the user cancels the confirmation', async () => {
      fixture.detectChanges();
      confirmServiceMock.confirm.mockResolvedValue(false);

      await component.clear();

      expect(logServiceMock.clear).not.toHaveBeenCalled();
    });

    it('clears and refreshes when confirmed', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      confirmServiceMock.confirm.mockResolvedValue(true);
      logServiceMock.list.mockResolvedValue([]);

      await component.clear();

      expect(logServiceMock.clear).toHaveBeenCalled();
      expect(component.logs()).toEqual([]);
    });

    it('shows a danger toast when LogService.clear rejects', async () => {
      fixture.detectChanges();
      confirmServiceMock.confirm.mockResolvedValue(true);
      logServiceMock.clear.mockRejectedValue(new Error('boom'));

      await component.clear();

      expect(toastServiceMock.danger).toHaveBeenCalled();
    });
  });

  describe('toggleColorCoding', () => {
    it('flips the persisted colorCodingEnabled while preserving columnState', async () => {
      fixture.detectChanges();
      settings$.next({
        columnState: [{ colId: 'message' }] as any,
        colorCodingEnabled: false,
        compactRows: false,
      });

      await component.toggleColorCoding();

      expect(logGridSettingsServiceMock.save).toHaveBeenCalledWith({
        columnState: [{ colId: 'message' }],
        colorCodingEnabled: true,
        compactRows: false,
      });
    });
  });

  describe('colorCodingEnabled', () => {
    it('reflects the value from LogGridSettingsService', () => {
      fixture.detectChanges();
      settings$.next({ columnState: null, colorCodingEnabled: true, compactRows: false });
      expect(component.colorCodingEnabled()).toBe(true);
    });
  });

  describe('toggleCompactRows', () => {
    it('flips the persisted compactRows while preserving other settings', async () => {
      fixture.detectChanges();
      settings$.next({ columnState: null, colorCodingEnabled: true, compactRows: false });

      await component.toggleCompactRows();

      expect(logGridSettingsServiceMock.save).toHaveBeenCalledWith({
        columnState: null,
        colorCodingEnabled: true,
        compactRows: true,
      });
    });
  });

  describe('compactRowsEnabled', () => {
    it('reflects the value from LogGridSettingsService', () => {
      fixture.detectChanges();
      settings$.next({ columnState: null, colorCodingEnabled: false, compactRows: true });
      expect(component.compactRowsEnabled()).toBe(true);
    });
  });

  describe('compact header buttons (matches button-bar behavior)', () => {
    function mockMatchMedia(matches: boolean): void {
      (window.matchMedia as ReturnType<typeof vi.fn>).mockImplementation((query: string) => ({
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    }

    it('is compact on init when the viewport matches the narrow breakpoint', () => {
      mockMatchMedia(true);
      fixture.detectChanges();
      expect(component.compact).toBe(true);
    });

    it('is not compact on init when the viewport does not match the narrow breakpoint', () => {
      mockMatchMedia(false);
      fixture.detectChanges();
      expect(component.compact).toBe(false);
    });

    it('re-evaluates compactness on window resize', () => {
      mockMatchMedia(false);
      fixture.detectChanges();
      expect(component.compact).toBe(false);

      mockMatchMedia(true);
      component.onResize();

      expect(component.compact).toBe(true);
    });
  });
});
