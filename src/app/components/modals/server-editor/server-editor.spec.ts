import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { ServerEditor } from './server-editor';

describe('ServerEditor', () => {
  let component: ServerEditor;
  let fixture: ComponentFixture<ServerEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServerEditor],
      providers: [NgbActiveModal],
    }).compileComponents();

    fixture = TestBed.createComponent(ServerEditor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
