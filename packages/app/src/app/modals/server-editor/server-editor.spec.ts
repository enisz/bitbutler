import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';
import { CommandBusService } from '../../services/command-bus.service';
import { ConfirmService } from '../../services/confirm.service';
import { ServerService } from '../../services/server.service';
import { ServerEditor } from './server-editor';

describe('ServerEditor', () => {
  let component: ServerEditor;
  let fixture: ComponentFixture<ServerEditor>;
  let mockActiveModal: Partial<NgbActiveModal>;
  let mockServerService: Partial<ServerService>;
  let mockCommandBus: Partial<CommandBusService>;
  let mockConfirmService: { confirm: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };
    mockServerService = {
      getById: vi.fn().mockResolvedValue(null),
      add: vi.fn().mockResolvedValue({ id: 'new-id' }),
      update: vi.fn().mockResolvedValue(true),
    };
    mockCommandBus = {
      commands$: new Subject<any>().asObservable(),
      emit: vi.fn(),
    };
    mockConfirmService = { confirm: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [ServerEditor],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ServerService, useValue: mockServerService },
        { provide: CommandBusService, useValue: mockCommandBus },
        { provide: ConfirmService, useValue: mockConfirmService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ServerEditor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start in add mode (editMode = false) when no id is provided', () => {
    expect(component.editMode()).toBe(false);
  });

  it('should set editMode to true when id input is provided', async () => {
    fixture.componentRef.setInput('id', 'server-1');
    await component.ngOnInit();
    expect(component.editMode()).toBe(true);
  });

  it('should expose form field getters', () => {
    component.editorForm.patchValue({ name: 'My Server', host: 'localhost', port: 9090 });
    expect(component.name).toBe('My Server');
    expect(component.host).toBe('localhost');
    expect(component.port).toBe(9090);
  });

  it('should default protocol to http', () => {
    expect(component.protocol).toBe('http');
  });

  it('should default autoLogin to true', () => {
    expect(component.autoLogin).toBe(true);
  });

  describe('connectionSubtitle', () => {
    it('renders <protocol://host:port> using the field defaults when nothing has been entered yet', () => {
      expect(component.connectionSubtitle()).toBe('<http://:8080>');
    });

    it('updates in real time as the name, protocol, host, or port fields change', () => {
      // Set the name first - in add mode it mirrors into an untouched host field.
      component.editorForm.get('name')?.setValue('My Server');
      component.editorForm.get('host')?.setValue('example.com');
      expect(component.connectionSubtitle()).toBe('My Server <http://example.com:8080>');

      component.editorForm.get('protocol')?.setValue('https');
      expect(component.connectionSubtitle()).toBe('My Server <https://example.com:8080>');

      component.editorForm.get('port')?.setValue(9090);
      expect(component.connectionSubtitle()).toBe('My Server <https://example.com:9090>');
    });

    it('trims surrounding whitespace from the name and host', () => {
      component.editorForm.get('name')?.setValue('  My Server  ');
      component.editorForm.get('host')?.setValue('  example.com  ');
      expect(component.connectionSubtitle()).toBe('My Server <http://example.com:8080>');
    });
  });

  describe('delete button', () => {
    const deleteButton = (): HTMLButtonElement | null =>
      fixture.nativeElement.querySelector('.modal-footer .btn-danger');

    it('is hidden in add mode', () => {
      expect(deleteButton()).toBeNull();
    });

    it('is shown in edit mode', async () => {
      fixture.componentRef.setInput('id', 'server-1');
      await component.ngOnInit();
      fixture.detectChanges();
      expect(deleteButton()).not.toBeNull();
    });
  });

  describe('handleDelete', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('id', 'server-1');
    });

    it('deletes the server and dismisses the modal once confirmed', async () => {
      await component.handleDelete();
      expect(mockConfirmService.confirm).toHaveBeenCalled();
      expect(mockCommandBus.emit).toHaveBeenCalledWith({ type: 'SERVER_DELETED', id: 'server-1' });
      expect(mockActiveModal.dismiss).toHaveBeenCalled();
      expect(mockActiveModal.close).not.toHaveBeenCalled();
    });

    it('does nothing when the confirmation is cancelled', async () => {
      mockConfirmService.confirm.mockResolvedValue(false);
      await component.handleDelete();
      expect(mockCommandBus.emit).not.toHaveBeenCalled();
      expect(mockActiveModal.dismiss).not.toHaveBeenCalled();
    });
  });

  describe('canSave signal', () => {
    it('should be false when form is invalid', () => {
      component.editorForm.reset();
      expect(component.canSave()).toBe(false);
    });

    it('should be true when all required fields are filled', () => {
      component.editorForm.patchValue({
        name: 'Server',
        host: 'localhost',
        protocol: 'http',
        port: 8080,
        username: 'admin',
        password: 'secret',
        autoLogin: true,
      });
      expect(component.canSave()).toBe(true);
    });
  });

  describe('close', () => {
    it('should dismiss the modal', () => {
      component.close();
      expect(mockActiveModal.dismiss).toHaveBeenCalled();
    });
  });

  describe('ngOnInit load failure', () => {
    it('dismisses the modal instead of leaving a silently blank form', async () => {
      (mockServerService.getById as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('IPC failed'),
      );
      fixture.componentRef.setInput('id', 'server-1');

      await component.ngOnInit();
      await fixture.whenStable();

      expect(mockActiveModal.dismiss).toHaveBeenCalled();
    });
  });

  describe('handleSave double-submit guard', () => {
    it('sets processing while the save is in flight and clears it afterwards', async () => {
      let resolveUpdate!: (v: boolean) => void;
      (mockServerService.update as ReturnType<typeof vi.fn>).mockReturnValue(
        new Promise<boolean>((resolve) => {
          resolveUpdate = resolve;
        }),
      );
      fixture.componentRef.setInput('id', 'server-1');
      component.editorForm.patchValue({ name: 'Server', host: 'localhost' });

      component.handleSave();
      expect(component.processing()).toBe(true);

      resolveUpdate(true);
      await fixture.whenStable();

      expect(component.processing()).toBe(false);
    });

    it('ignores a second call while a save is already in flight', async () => {
      (mockServerService.add as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
      component.editorForm.patchValue({ name: 'Server', host: 'localhost' });

      component.handleSave();
      component.handleSave();

      expect(mockServerService.add).toHaveBeenCalledTimes(1);
    });
  });
});
