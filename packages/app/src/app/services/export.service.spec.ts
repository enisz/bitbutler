import { TestBed } from '@angular/core/testing';
import { ExportService } from './export.service';

describe('ExportService', () => {
  let service: ExportService;

  beforeEach(() => {
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
});
