import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ButtonBar } from './button-bar';

describe('ButtonBar', () => {
  let component: ButtonBar;
  let fixture: ComponentFixture<ButtonBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonBar],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonBar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
