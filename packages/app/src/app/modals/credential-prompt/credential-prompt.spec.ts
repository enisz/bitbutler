import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { CredentialPrompt } from './credential-prompt';

describe('CredentialPrompt', () => {
  let component: CredentialPrompt;
  let fixture: ComponentFixture<CredentialPrompt>;
  let mockActiveModal: Partial<NgbActiveModal>;

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CredentialPrompt, TranslateModule.forRoot()],
      providers: [{ provide: NgbActiveModal, useValue: mockActiveModal }],
    }).compileComponents();

    fixture = TestBed.createComponent(CredentialPrompt);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('serverName', 'My Server');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows only the server name in the subtitle when no url is given', () => {
    expect(component.subtitle()).toBe('My Server');
  });

  it('shows the name and url in the subtitle when a url is given', () => {
    fixture.componentRef.setInput('serverUrl', 'http://my.host:8090');
    fixture.detectChanges();
    expect(component.subtitle()).toBe('My Server <http://my.host:8090>');
    expect(fixture.nativeElement.querySelector('.modal-header').textContent).toContain(
      'My Server <http://my.host:8090>',
    );
  });

  it('pre-fills username when prefillUsername input is set', () => {
    fixture.componentRef.setInput('prefillUsername', 'admin');
    fixture.detectChanges();
    expect(component.credentialForm.get('username')?.value).toBe('admin');
  });

  it('connect() closes modal with username, password, and save=false when saveCredentials is unchecked', () => {
    component.credentialForm.patchValue({
      username: 'user1',
      password: 'pass1',
      saveCredentials: false,
    });
    component.connect();
    expect(mockActiveModal.close).toHaveBeenCalledWith({
      username: 'user1',
      password: 'pass1',
      save: false,
    });
  });

  it('connect() closes modal with save=true when saveCredentials is checked and fields are non-empty', () => {
    component.credentialForm.patchValue({
      username: 'user1',
      password: 'pass1',
      saveCredentials: true,
    });
    component.connect();
    expect(mockActiveModal.close).toHaveBeenCalledWith({
      username: 'user1',
      password: 'pass1',
      save: true,
    });
  });

  it('connect() closes with save=false when saveCredentials is checked but both fields are empty', () => {
    component.credentialForm.patchValue({ username: '', password: '', saveCredentials: true });
    component.connect();
    expect(mockActiveModal.close).toHaveBeenCalledWith({ username: '', password: '', save: false });
  });

  it('cancel() dismisses the modal', () => {
    component.cancel();
    expect(mockActiveModal.dismiss).toHaveBeenCalled();
  });
});
