import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppLoader } from './app-loader';

describe('AppLoader', () => {
  let component: AppLoader;
  let fixture: ComponentFixture<AppLoader>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppLoader],
    }).compileComponents();

    fixture = TestBed.createComponent(AppLoader);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
