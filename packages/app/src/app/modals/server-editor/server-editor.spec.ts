import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';
import { CommandBusService } from '../../services/command-bus.service';
import { ServerService } from '../../services/server.service';
import { ServerEditor } from './server-editor';

describe('ServerEditor', () => {
  let component: ServerEditor;
  let fixture: ComponentFixture<ServerEditor>;
  let mockActiveModal: Partial<NgbActiveModal>;
  let mockServerService: Partial<ServerService>;
  let mockCommandBus: Partial<CommandBusService>;

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

    await TestBed.configureTestingModule({
      imports: [ServerEditor],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ServerService, useValue: mockServerService },
        { provide: CommandBusService, useValue: mockCommandBus },
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
