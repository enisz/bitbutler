import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NoRowOverlay } from './no-row-overlay';

describe('NoRowOverlay', () => {
  let component: NoRowOverlay;
  let fixture: ComponentFixture<NoRowOverlay>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NoRowOverlay],
    }).compileComponents();

    fixture = TestBed.createComponent(NoRowOverlay);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
