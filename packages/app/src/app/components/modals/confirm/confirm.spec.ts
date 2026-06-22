import { ComponentFixture, TestBed } from '@angular/core/testing';
import { faCheck, faTrashCan, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Confirm } from './confirm';

describe('Confirm', () => {
  let component: Confirm;
  let fixture: ComponentFixture<Confirm>;
  let mockActiveModal: Partial<NgbActiveModal>;

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Confirm],
      providers: [{ provide: NgbActiveModal, useValue: mockActiveModal }],
    }).compileComponents();

    fixture = TestBed.createComponent(Confirm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default title translation key', () => {
    expect(component.title()).toBe('components.modals.confirm.title');
  });

  it('should have default message translation key', () => {
    expect(component.message()).toBe('components.modals.confirm.message');
  });

  it('should have default ok button translation key', () => {
    expect(component.btnOkText()).toBe('general.button.ok');
  });

  it('should have default cancel button translation key', () => {
    expect(component.btnCancelText()).toBe('general.button.cancel');
  });

  it('should accept custom title input', () => {
    fixture.componentRef.setInput('title', 'custom.title');
    expect(component.title()).toBe('custom.title');
  });

  it('should accept custom title params', () => {
    fixture.componentRef.setInput('titleParams', { name: 'test' });
    expect(component.titleParams()).toEqual({ name: 'test' });
  });

  it('should have default ok icon', () => {
    expect(component.okIcon()).toBe(faCheck);
  });

  it('should have default cancel icon', () => {
    expect(component.cancelIcon()).toBe(faXmark);
  });

  it('should accept custom okIcon input', () => {
    fixture.componentRef.setInput('okIcon', faTrashCan);
    expect(component.okIcon()).toBe(faTrashCan);
  });
});
