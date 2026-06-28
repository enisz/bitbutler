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
});
