import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ToastOverlay } from './toast-overlay';

describe('ToastOverlay', () => {
  let component: ToastOverlay;
  let fixture: ComponentFixture<ToastOverlay>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToastOverlay],
    }).compileComponents();

    fixture = TestBed.createComponent(ToastOverlay);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
