import { ComponentFixture, TestBed } from '@angular/core/testing';
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
    expect(component.title).toBe('components.modals.confirm.title');
  });

  it('should have default message translation key', () => {
    expect(component.message).toBe('components.modals.confirm.message');
  });

  it('should have default ok button translation key', () => {
    expect(component.btnOkText).toBe('general.button.ok');
  });

  it('should have default cancel button translation key', () => {
    expect(component.btnCancelText).toBe('general.button.cancel');
  });

  it('should accept custom title input', () => {
    component.title = 'custom.title';
    expect(component.title).toBe('custom.title');
  });

  it('should accept custom title params', () => {
    component.titleParams = { name: 'test' };
    expect(component.titleParams).toEqual({ name: 'test' });
  });
});
