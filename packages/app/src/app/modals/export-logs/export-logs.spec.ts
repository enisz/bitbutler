import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { LogEntry } from '@bitbutler/shared';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { DateFormatService } from '../../services/date-format.service';
import { ToastService } from '../../services/toast.service';
import { ExportLogs } from './export-logs';

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

describe('ExportLogs', () => {
  let component: ExportLogs;
  let fixture: ComponentFixture<ExportLogs>;
  let activeModalMock: { close: ReturnType<typeof vi.fn>; dismiss: ReturnType<typeof vi.fn> };
  let dateFormatServiceMock: { format: ReturnType<typeof vi.fn> };
  let toastServiceMock: { success: ReturnType<typeof vi.fn>; danger: ReturnType<typeof vi.fn> };
  let exportSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    activeModalMock = { close: vi.fn(), dismiss: vi.fn() };
    dateFormatServiceMock = { format: vi.fn().mockReturnValue('2026-09-06 10:00') };
    toastServiceMock = { success: vi.fn(), danger: vi.fn() };
    exportSpy = vi
      .spyOn(window.bitbutler.log, 'export')
      .mockResolvedValue({ cancelled: false, path: '/home/user/bitbutler.log' });

    await TestBed.configureTestingModule({
      imports: [ExportLogs, TranslateModule.forRoot()],
      providers: [
        { provide: NgbActiveModal, useValue: activeModalMock },
        { provide: DateFormatService, useValue: dateFormatServiceMock },
        { provide: ToastService, useValue: toastServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExportLogs);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('defaults scope to all and format to the default template', () => {
    fixture.detectChanges();
    expect(component.exportForm.get('scope')?.value).toBe('all');
    expect(component.exportForm.get('format')?.value).toBe(
      '[{{date}}] [{{process}}] [{{level}}] ({{filename}}:{{line}}) - {{message}}',
    );
  });

  describe('exportedLogs', () => {
    it('returns the "all" input by default', () => {
      const all = [makeLog({ id: 1 })];
      fixture.componentRef.setInput('all', all);
      fixture.detectChanges();
      expect(component.exportedLogs()).toEqual(all);
    });

    it('returns the "filtered" input when scope is filtered', () => {
      const filtered = [makeLog({ id: 2 })];
      fixture.componentRef.setInput('all', [makeLog({ id: 1 })]);
      fixture.componentRef.setInput('filtered', filtered);
      fixture.detectChanges();

      component.exportForm.get('scope')?.setValue('filtered');
      expect(component.exportedLogs()).toEqual(filtered);
    });

    it('returns the "selected" input when scope is selected', () => {
      const selected = [makeLog({ id: 3 })];
      fixture.componentRef.setInput('all', [makeLog({ id: 1 })]);
      fixture.componentRef.setInput('selected', selected);
      fixture.detectChanges();

      component.exportForm.get('scope')?.setValue('selected');
      expect(component.exportedLogs()).toEqual(selected);
    });
  });

  describe('startExport', () => {
    it('does nothing when the format control is empty', async () => {
      fixture.detectChanges();
      component.exportForm.get('format')?.setValue('');

      await component.startExport();

      expect(exportSpy).not.toHaveBeenCalled();
    });

    it('formats every log in the current scope and writes it via window.bitbutler.log.export', async () => {
      fixture.componentRef.setInput('all', [
        makeLog({ id: 1, message: 'first' }),
        makeLog({ id: 2, message: 'second' }),
      ]);
      fixture.detectChanges();
      component.exportForm.get('format')?.setValue('{{message}}');

      await component.startExport();

      expect(exportSpy).toHaveBeenCalledWith({
        content: 'first\nsecond',
        defaultFilename: 'bitbutler.log',
      });
    });

    it('shows a success toast and closes the modal when the write succeeds', async () => {
      fixture.componentRef.setInput('all', [makeLog()]);
      fixture.detectChanges();

      await component.startExport();

      expect(toastServiceMock.success).toHaveBeenCalledWith(
        '/home/user/bitbutler.log',
        expect.any(String),
      );
      expect(activeModalMock.close).toHaveBeenCalled();
    });

    it('leaves the modal open without a toast when the save dialog is cancelled', async () => {
      exportSpy.mockResolvedValue({ cancelled: true });
      fixture.componentRef.setInput('all', [makeLog()]);
      fixture.detectChanges();

      await component.startExport();

      expect(toastServiceMock.success).not.toHaveBeenCalled();
      expect(activeModalMock.close).not.toHaveBeenCalled();
    });

    it('shows a danger toast and keeps the modal open when the IPC call rejects', async () => {
      exportSpy.mockRejectedValue(new Error('disk full'));
      fixture.componentRef.setInput('all', [makeLog()]);
      fixture.detectChanges();

      await component.startExport();

      expect(toastServiceMock.danger).toHaveBeenCalledWith('Error: disk full', expect.any(String));
      expect(activeModalMock.close).not.toHaveBeenCalled();
    });
  });

  describe('variableGuide', () => {
    it('renders one row per known format token', () => {
      fixture.componentRef.setInput('all', [makeLog({ message: 'hi' })]);
      fixture.detectChanges();

      const messageRow = component.variableGuide().find((row) => row.token === 'message');
      expect(messageRow?.example).toBe('hi');
    });
  });

  describe('close', () => {
    it('dismisses the modal', () => {
      fixture.detectChanges();
      component.close();
      expect(activeModalMock.dismiss).toHaveBeenCalled();
    });
  });
});
