import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ConfirmService } from '../../services/confirm.service';
import { ToastService } from '../../services/toast.service';
import { Settings } from './settings';
import { SettingsStateService } from './settings-state.service';

describe('Settings', () => {
  let component: Settings;
  let fixture: ComponentFixture<Settings>;

  let stateServiceMock: {
    isDirty: ReturnType<typeof signal<boolean>>;
    isDirtyMap: ReturnType<typeof signal<any>>;
    saveAll: ReturnType<typeof vi.fn>;
    resetDirty: ReturnType<typeof vi.fn>;
  };
  let confirmMock: { confirm: ReturnType<typeof vi.fn> };
  let toastMock: { success: ReturnType<typeof vi.fn>; danger: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    stateServiceMock = {
      isDirty: signal(false),
      isDirtyMap: signal({
        general: false,
        server: false,
        'torrent-list-grid': false,
        'status-bar': false,
      }),
      saveAll: vi.fn().mockResolvedValue(undefined),
      resetDirty: vi.fn(),
    };
    confirmMock = { confirm: vi.fn().mockResolvedValue(false) };
    toastMock = { success: vi.fn(), danger: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Settings],
      providers: [
        { provide: NgbActiveModal, useValue: { close: vi.fn(), dismiss: vi.fn() } },
        { provide: ConfirmService, useValue: confirmMock },
        { provide: ToastService, useValue: toastMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(Settings, {
        set: {
          providers: [{ provide: SettingsStateService, useValue: stateServiceMock }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(Settings);
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

    it('should include general, server, torrent-list-grid and status-bar tabs', () => {
      const ids = component.tabs.map((t) => t.id);
      expect(ids).toContain('general');
      expect(ids).toContain('server');
      expect(ids).toContain('torrent-list-grid');
      expect(ids).toContain('status-bar');
    });
  });

  describe('selectTab', () => {
    it('should update the activeTabId signal', () => {
      component.selectTab('server');
      expect(component.activeTabId()).toBe('server');
    });

    it('should update again on subsequent calls', () => {
      component.selectTab('server');
      component.selectTab('status-bar');
      expect(component.activeTabId()).toBe('status-bar');
    });
  });

  describe('canDeactivate', () => {
    it('should return true immediately when the form is not dirty', async () => {
      stateServiceMock.isDirty.set(false);
      const result = await component.canDeactivate();
      expect(result).toBe(true);
      expect(confirmMock.confirm).not.toHaveBeenCalled();
    });

    it('should open a confirm dialog when dirty', async () => {
      stateServiceMock.isDirty.set(true);
      confirmMock.confirm.mockResolvedValue(false);
      await component.canDeactivate();
      expect(confirmMock.confirm).toHaveBeenCalled();
    });

    it('should reset dirty state and return true when the user confirms', async () => {
      stateServiceMock.isDirty.set(true);
      confirmMock.confirm.mockResolvedValue(true);
      const result = await component.canDeactivate();
      expect(stateServiceMock.resetDirty).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should not reset dirty state and return false when the user cancels', async () => {
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
      stateServiceMock.saveAll.mockRejectedValueOnce(new Error('disk full'));
      await component.onSave();
      expect(toastMock.danger).toHaveBeenCalledWith(
        'disk full',
        'pages.settings.error.save-failed-title',
      );
    });

    it('should not close the modal when saveAll fails', async () => {
      const activeModal = TestBed.inject(NgbActiveModal);
      stateServiceMock.saveAll.mockRejectedValueOnce(new Error('disk full'));
      await component.onSave();
      expect(activeModal.close).not.toHaveBeenCalled();
    });
  });
});
