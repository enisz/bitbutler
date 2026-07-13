import { TestBed } from '@angular/core/testing';
import { ExportService } from './export.service';

describe('ExportService', () => {
  let service: ExportService;
  let onImportProgressCb: (e: {
    current: number;
    total: number;
    name: string;
    skipped: number;
  }) => void;
  let onImportDoneCb: (e: { total: number; failed: number; alreadyExisted: number }) => void;

  beforeEach(() => {
    (window as any).bitbutler.export.onImportProgress = (cb: typeof onImportProgressCb) => {
      onImportProgressCb = cb;
      return () => {};
    };
    (window as any).bitbutler.export.onImportDone = (cb: typeof onImportDoneCb) => {
      onImportDoneCb = cb;
      return () => {};
    };

    TestBed.configureTestingModule({});
    service = TestBed.inject(ExportService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should start with idle export phase', () => {
    expect(service.exportPhase()).toBe('idle');
  });

  it('should start with idle import phase', () => {
    expect(service.importPhase()).toBe('idle');
  });

  it('resetExport sets phase back to idle', () => {
    service.resetExport();
    expect(service.exportPhase()).toBe('idle');
  });

  it('resetImport sets phase back to idle', () => {
    service.resetImport();
    expect(service.importPhase()).toBe('idle');
  });

  it('maps import progress events onto current/total/name without a stray skipped field', () => {
    onImportProgressCb({ current: 2, total: 5, name: 'Foo', skipped: 1 });
    const state = service.importState();
    expect(state.phase).toBe('running');
    expect(state.current).toBe(2);
    expect(state.total).toBe(5);
    expect(state.name).toBe('Foo');
  });

  it('maps the import done event to failed and alreadyExisted', () => {
    onImportDoneCb({ total: 3, failed: 1, alreadyExisted: 2 });
    const state = service.importState();
    expect(state.phase).toBe('done');
    expect(state.current).toBe(3);
    expect(state.failed).toBe(1);
    expect(state.alreadyExisted).toBe(2);
  });
});
