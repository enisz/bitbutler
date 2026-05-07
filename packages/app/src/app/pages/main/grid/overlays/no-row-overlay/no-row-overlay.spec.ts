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

  it('should have empty message by default', () => {
    expect(component.message).toBe('');
  });

  it('agInit should set message from params', () => {
    component.agInit({ message: 'No results found' } as any);
    expect(component.message).toBe('No results found');
  });

  it('agInit should use empty string when message not provided', () => {
    component.agInit({} as any);
    expect(component.message).toBe('');
  });

  it('refresh should update message and return true', () => {
    const result = component.refresh({ message: 'Updated message' } as any);
    expect(component.message).toBe('Updated message');
    expect(result).toBe(true);
  });
});
