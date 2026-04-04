import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ServerEditor } from './server-editor';

describe('ServerEditor', () => {
  let component: ServerEditor;
  let fixture: ComponentFixture<ServerEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServerEditor],
    }).compileComponents();

    fixture = TestBed.createComponent(ServerEditor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
