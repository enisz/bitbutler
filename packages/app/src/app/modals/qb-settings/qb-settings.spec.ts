import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ConfirmService } from '../../services/confirm.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';
import { QbSettings } from './qb-settings';
import { QbSettingsStateService } from './qb-settings-state.service';

describe('QbSettings', () => {
  let component: QbSettings;
  let fixture: ComponentFixture<QbSettings>;

  let stateServiceMock: {
    isDirty: ReturnType<typeof signal<boolean>>;
    isDirtyMap: ReturnType<typeof signal<any>>;
    saveAll: ReturnType<typeof vi.fn>;
    resetDirty: ReturnType<typeof vi.fn>;
    setPreferences: ReturnType<typeof vi.fn>;
  };
  let confirmMock: { confirm: ReturnType<typeof vi.fn> };
  let toastMock: { success: ReturnType<typeof vi.fn>; danger: ReturnType<typeof vi.fn> };
  let qbMock: { app: { preferences: ReturnType<typeof vi.fn> } };
  let serverStoreMock: {
    currentServerId: ReturnType<typeof signal<string | null>>;
    currentServer: ReturnType<typeof signal<{ name: string } | null>>;
  };

  beforeEach(async () => {
    stateServiceMock = {
      isDirty: signal(false),
      isDirtyMap: signal({
        bandwidth: false,
        storage: false,
        'queue-limits': false,
        'seeding-ratios': false,
      }),
      saveAll: vi.fn().mockResolvedValue(undefined),
      resetDirty: vi.fn(),
      setPreferences: vi.fn(),
    };
    confirmMock = { confirm: vi.fn().mockResolvedValue(false) };
    toastMock = { success: vi.fn(), danger: vi.fn() };
    qbMock = { app: { preferences: vi.fn().mockResolvedValue({ dl_limit: 0 }) } };
    serverStoreMock = {
      currentServerId: signal('server-1'),
      currentServer: signal({ name: 'test-qb' }),
    };

    await TestBed.configureTestingModule({
      imports: [QbSettings],
      providers: [
        { provide: NgbActiveModal, useValue: { close: vi.fn(), dismiss: vi.fn() } },
        { provide: ConfirmService, useValue: confirmMock },
        { provide: ToastService, useValue: toastMock },
        { provide: QbService, useValue: qbMock },
        { provide: ServerStoreService, useValue: serverStoreMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(QbSettings, {
        set: {
          providers: [{ provide: QbSettingsStateService, useValue: stateServiceMock }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(QbSettings);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('tabs', () => {
    it('should define exactly 4 tabs', () => {
      expect(component.tabs).toHaveLength(4);
    });

    it('should contain bandwidth, storage, queue-limits and seeding-ratios tabs', () => {
      const ids = component.tabs.map((t) => t.id);
      expect(ids).toContain('bandwidth');
      expect(ids).toContain('storage');
      expect(ids).toContain('queue-limits');
      expect(ids).toContain('seeding-ratios');
    });

    it('should select the tab passed via tabToOpen on init', async () => {
      fixture = TestBed.createComponent(QbSettings);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('tabToOpen', 'storage');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.activeTabId()).toBe('storage');
    });

    it('should default to the bandwidth tab when tabToOpen is not provided', async () => {
      fixture = TestBed.createComponent(QbSettings);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.activeTabId()).toBe('bandwidth');
    });
  });

  describe('selectTab', () => {
    it('should update activeTabId signal', () => {
      component.selectTab('storage');
      expect(component.activeTabId()).toBe('storage');
    });
  });

  describe('canDeactivate', () => {
    it('should return true immediately when not dirty', async () => {
      stateServiceMock.isDirty.set(false);
      const result = await component.canDeactivate();
      expect(result).toBe(true);
      expect(confirmMock.confirm).not.toHaveBeenCalled();
    });

    it('should open confirm dialog when dirty', async () => {
      stateServiceMock.isDirty.set(true);
      await component.canDeactivate();
      expect(confirmMock.confirm).toHaveBeenCalled();
    });

    it('should reset dirty and return true when user confirms leave', async () => {
      stateServiceMock.isDirty.set(true);
      confirmMock.confirm.mockResolvedValue(true);
      const result = await component.canDeactivate();
      expect(stateServiceMock.resetDirty).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should not reset dirty and return false when user stays', async () => {
      stateServiceMock.isDirty.set(true);
      confirmMock.confirm.mockResolvedValue(false);
      const result = await component.canDeactivate();
      expect(stateServiceMock.resetDirty).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('onSave', () => {
    it('should call stateService.saveAll', async () => {
      await component.onSave();
      expect(stateServiceMock.saveAll).toHaveBeenCalled();
    });

    it('should show a success toast', async () => {
      await component.onSave();
      expect(toastMock.success).toHaveBeenCalled();
    });

    it('should show a danger toast with the raw error message when saveAll fails', async () => {
      stateServiceMock.saveAll.mockRejectedValueOnce(new Error('connection refused'));
      await component.onSave();
      expect(toastMock.danger).toHaveBeenCalledWith(
        'connection refused',
        'pages.qb-settings.error.save-failed-title',
      );
    });

    it('should not close the modal when saveAll fails', async () => {
      const activeModal = TestBed.inject(NgbActiveModal);
      stateServiceMock.saveAll.mockRejectedValueOnce(new Error('connection refused'));
      await component.onSave();
      expect(activeModal.close).not.toHaveBeenCalled();
    });
  });
});
