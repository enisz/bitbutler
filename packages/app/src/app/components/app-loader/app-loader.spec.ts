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

  it('should have an empty message by default', () => {
    expect(component.message()).toBe('');
  });

  it('should accept a custom title input', () => {
    fixture.componentRef.setInput('title', 'Loading data…');
    fixture.detectChanges();
    expect(component.title()).toBe('Loading data…');
  });

  it('should accept a custom message input', () => {
    fixture.componentRef.setInput('message', 'Please wait');
    fixture.detectChanges();
    expect(component.message()).toBe('Please wait');
  });
});
