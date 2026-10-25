import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateLoader, TranslateModule, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';
import { ExportConfiguration } from './export-configuration';

describe('ExportConfiguration', () => {
  let fixture: ComponentFixture<ExportConfiguration>;
  let component: ExportConfiguration;
  let activeModal: { close: ReturnType<typeof vi.fn>; dismiss: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; danger: ReturnType<typeof vi.fn> };
  let exportToFile: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    activeModal = { close: vi.fn(), dismiss: vi.fn() };
    toast = { success: vi.fn(), danger: vi.fn() };
    exportToFile = vi.spyOn((window as any).bitbutler.config, 'exportToFile');

    await TestBed.configureTestingModule({
      imports: [
        ExportConfiguration,
        TranslateModule.forRoot({
          loader: {
            provide: TranslateLoader,
            useValue: {
              getTranslation: () =>
                of({
                  components: {
                    modals: {
                      'export-configuration': { servers: '{{ count }} server(s) and settings' },
                    },
                  },
                }),
            },
          },
        }),
      ],
      providers: [
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: ToastService, useValue: toast },
        {
          provide: ServerStoreService,
          useValue: { servers: signal([{ id: 'a' }, { id: 'b' }, { id: 'c' }]) },
        },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).use('us');
    fixture = TestBed.createComponent(ExportConfiguration);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows the number of servers from the store', () => {
    expect(component.serverCount()).toBe(3);
    expect(fixture.nativeElement.textContent).toContain('3 server(s) and settings');
  });

  it('export() closes the modal and shows a success toast with the saved path', async () => {
    exportToFile.mockResolvedValue({ canceled: false, path: '/tmp/out.bbc' });

    await component.export();

    expect(activeModal.close).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(
      '/tmp/out.bbc',
      'components.modals.export-configuration.toast.exported-title',
    );
  });

  it('export() keeps the modal open and shows no toast when the dialog is cancelled', async () => {
    exportToFile.mockResolvedValue({ canceled: true });

    await component.export();

    expect(activeModal.close).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.danger).not.toHaveBeenCalled();
    expect(component.exporting()).toBe(false);
  });

  it('export() shows a danger toast with the raw error and keeps the modal open on failure', async () => {
    exportToFile.mockRejectedValue(new Error('disk full'));

    await component.export();

    expect(toast.danger).toHaveBeenCalledWith(
      'disk full',
      'components.modals.export-configuration.toast.export-failed-title',
    );
    expect(activeModal.close).not.toHaveBeenCalled();
    expect(component.exporting()).toBe(false);
  });

  it('is marked as exporting while the save is pending', async () => {
    let resolve!: (value: { canceled: boolean }) => void;
    exportToFile.mockReturnValue(new Promise((r) => (resolve = r)));

    const pending = component.export();
    expect(component.exporting()).toBe(true);
    resolve({ canceled: true });
    await pending;

    expect(component.exporting()).toBe(false);
  });

  it('cancel() dismisses the modal', () => {
    component.cancel();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });
});
