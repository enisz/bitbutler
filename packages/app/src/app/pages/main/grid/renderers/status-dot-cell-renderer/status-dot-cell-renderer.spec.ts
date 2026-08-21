import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatusDotCellRenderer } from './status-dot-cell-renderer';

describe('StatusDotCellRenderer', () => {
  let component: StatusDotCellRenderer;
  let fixture: ComponentFixture<StatusDotCellRenderer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatusDotCellRenderer],
    }).compileComponents();

    fixture = TestBed.createComponent(StatusDotCellRenderer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default to the secondary variant', () => {
    expect(component.variant).toBe('secondary');
  });

  it('agInit should derive the variant from data.state', () => {
    component.agInit({ data: { state: 'downloading' } } as any);
    expect(component.variant).toBe('info');
  });

  it('agInit should fall back to secondary when data is null', () => {
    component.agInit({ data: null } as any);
    expect(component.variant).toBe('secondary');
  });

  it('refresh should update the variant and return true', () => {
    const result = component.refresh({ data: { state: 'error' } } as any);
    expect(component.variant).toBe('danger');
    expect(result).toBe(true);
  });
});
