import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BbcMetadata } from '@bitbutler/shared';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateLoader, TranslateModule, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { ConfigurationService } from '../../services/configuration.service';
import { ConfirmService } from '../../services/confirm.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';
import { ImportConfiguration } from './import-configuration';

const META: BbcMetadata = {
  version: 1,
  exportedAt: Date.UTC(2026, 9, 22),
  hasSettings: true,
  servers: [
    { id: 's1', name: 'threadripper', host: 'tr.example', port: 8080, exists: true },
    { id: 's2', name: 'nas', host: 'nas.example', port: 8081, exists: false },
  ],
};

describe('ImportConfiguration', () => {
  let fixture: ComponentFixture<ImportConfiguration>;
  let component: ImportConfiguration;
  let activeModal: { close: ReturnType<typeof vi.fn>; dismiss: ReturnType<typeof vi.fn> };
  let toast: { danger: ReturnType<typeof vi.fn> };
  let finishImport: ReturnType<typeof vi.fn>;
  let confirm: ReturnType<typeof vi.fn>;
  let forceLogout: ReturnType<typeof vi.fn>;
  let currentServerId: ReturnType<typeof signal<string | null>>;
  let read: ReturnType<typeof vi.spyOn>;
  let importFile: ReturnType<typeof vi.spyOn>;

  async function create(meta: BbcMetadata | Error = META): Promise<void> {
    if (meta instanceof Error) read.mockRejectedValue(meta);
    else read.mockResolvedValue(meta);

    fixture = TestBed.createComponent(ImportConfiguration);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('bbcPath', '/tmp/a.bbc');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const switches = (): HTMLInputElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('input[role="switch"]'));
  // The server checkboxes, without the "all servers" one above them.
  const serverChecks = (): HTMLInputElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('.bb-check-tree__items input'));

  beforeEach(async () => {
    activeModal = { close: vi.fn(), dismiss: vi.fn() };
    toast = { danger: vi.fn() };
    finishImport = vi.fn();
    confirm = vi.fn().mockResolvedValue(true);
    forceLogout = vi.fn().mockResolvedValue(undefined);
    currentServerId = signal<string | null>(null);
    read = vi.spyOn((window as any).bitbutler.config, 'read');
    importFile = vi.spyOn((window as any).bitbutler.config, 'importFile');

    await TestBed.configureTestingModule({
      imports: [
        ImportConfiguration,
        TranslateModule.forRoot({
          loader: {
            provide: TranslateLoader,
            useValue: {
              getTranslation: () =>
                of({
                  components: {
                    modals: {
                      'import-configuration': {
                        'badge-exists': 'will overwrite',
                        'badge-new': 'new',
                      },
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
        { provide: ConfigurationService, useValue: { finishImport } },
        { provide: ConfirmService, useValue: { confirm } },
        { provide: QbService, useValue: { forceLogout } },
        {
          provide: ServerStoreService,
          useValue: {
            currentServerId,
            servers: signal([{ id: 's1', name: 'threadripper', host: 'tr.example' }]),
          },
        },
      ],
    }).compileComponents();
    TestBed.inject(TranslateService).use('us');
  });

  it('reads the file on init and renders a switch for settings and a checkbox per server, all on', async () => {
    await create();

    expect(read).toHaveBeenCalledWith({ path: '/tmp/a.bbc' });
    expect(switches()).toHaveLength(1);
    expect(switches()[0].checked).toBe(true);
    expect(serverChecks()).toHaveLength(2);
    expect(serverChecks().every((s) => s.checked)).toBe(true);
  });

  it('selects and clears every server from the all-servers checkbox', async () => {
    await create();
    const all = fixture.nativeElement.querySelector(
      '.bb-check-tree__all input',
    ) as HTMLInputElement;

    all.click();
    expect(component.selectedServerIds().size).toBe(0);

    all.click();
    expect([...component.selectedServerIds()].sort()).toEqual(['s1', 's2']);
  });

  it('tags servers as overwriting or new', async () => {
    await create();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('threadripper');
    expect(text).toContain('will overwrite');
    expect(text).toContain('nas');
    expect(text).toContain('new');
  });

  it('hides the settings switch when the file has no settings', async () => {
    await create({ ...META, hasSettings: false });

    expect(switches()).toHaveLength(0);
    expect(serverChecks()).toHaveLength(2);
    expect(component.applySettings()).toBe(false);
  });

  it('hides the servers section when the file has no servers', async () => {
    await create({ ...META, servers: [] });

    expect(switches()).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('app-bb-check-tree')).toBeNull();
  });

  it('disables Import when every switch is off', async () => {
    await create();

    component.setApplySettings(false);
    component.setSelectedServers([]);

    expect(component.canImport()).toBe(false);
  });

  it('enables Import when at least one switch is on', async () => {
    await create();

    component.setApplySettings(false);
    component.setSelectedServers(['s2']);

    expect(component.canImport()).toBe(true);
  });

  it('imports exactly the servers that are on, then finishes the import', async () => {
    await create();
    importFile.mockResolvedValue({ settings: false, servers: 1 });
    component.setApplySettings(false);
    component.setSelectedServers(['s2']);

    await component.import();

    expect(importFile).toHaveBeenCalledWith({
      path: '/tmp/a.bbc',
      applySettings: false,
      serverIds: ['s2'],
    });
    expect(activeModal.close).toHaveBeenCalled();
    expect(finishImport).toHaveBeenCalledWith({ settings: false, servers: 1 });
  });

  it('shows the read error in the modal and keeps Import disabled', async () => {
    await create(new Error('Invalid configuration file.'));

    expect(component.error()).toBe('Invalid configuration file.');
    expect(fixture.nativeElement.textContent).toContain('Invalid configuration file.');
    expect(component.canImport()).toBe(false);
  });

  it('shows a danger toast with the raw error and does not finish when the import fails', async () => {
    await create();
    importFile.mockRejectedValue(new Error('boom'));

    await component.import();

    expect(toast.danger).toHaveBeenCalledWith(
      'boom',
      'components.modals.import-configuration.toast.import-failed-title',
    );
    expect(finishImport).not.toHaveBeenCalled();
    expect(activeModal.close).not.toHaveBeenCalled();
    expect(component.importing()).toBe(false);
  });

  it('cancel() dismisses the modal', async () => {
    await create();

    component.cancel();

    expect(activeModal.dismiss).toHaveBeenCalled();
  });

  it('hides the settings switch and does not apply settings in servers-only mode', async () => {
    fixture = TestBed.createComponent(ImportConfiguration);
    component = fixture.componentInstance;
    read.mockResolvedValue(META);
    fixture.componentRef.setInput('bbcPath', '/tmp/a.bbc');
    fixture.componentRef.setInput('serversOnly', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(switches()).toHaveLength(0);
    expect(serverChecks()).toHaveLength(2);
    expect(component.applySettings()).toBe(false);
  });

  describe('importing over the current server', () => {
    beforeEach(() => {
      currentServerId.set('s1');
      importFile.mockResolvedValue({ settings: true, servers: 2 });
    });

    it('marks the current server in the list', async () => {
      await create();

      expect(fixture.nativeElement.textContent).toContain(
        'components.modals.import-configuration.badge-current',
      );
    });

    it('asks for confirmation, imports, then logs out before finishing', async () => {
      await create();

      await component.import();

      expect(confirm).toHaveBeenCalled();
      expect(forceLogout).toHaveBeenCalledWith('s1');
      expect(forceLogout.mock.invocationCallOrder[0]).toBeGreaterThan(
        importFile.mock.invocationCallOrder[0],
      );
      expect(finishImport).toHaveBeenCalled();
    });

    it('does nothing when the confirmation is declined', async () => {
      await create();
      confirm.mockResolvedValue(false);

      await component.import();

      expect(importFile).not.toHaveBeenCalled();
      expect(forceLogout).not.toHaveBeenCalled();
    });

    it('stays logged in when the import fails', async () => {
      await create();
      importFile.mockRejectedValue(new Error('boom'));

      await component.import();

      expect(forceLogout).not.toHaveBeenCalled();
    });

    it('neither asks nor logs out when the current server is not selected', async () => {
      await create();
      component.setSelectedServers(['s2']);

      await component.import();

      expect(confirm).not.toHaveBeenCalled();
      expect(forceLogout).not.toHaveBeenCalled();
    });
  });
});
