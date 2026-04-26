import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProgressCellRenderer } from './progress-cell-renderer';

describe('ProgressCellRenderer', () => {
  let component: ProgressCellRenderer;
  let fixture: ComponentFixture<ProgressCellRenderer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProgressCellRenderer],
    }).compileComponents();

    fixture = TestBed.createComponent(ProgressCellRenderer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have zero progress and undefined state by default', () => {
    expect(component.progress).toBe(0);
    expect(component.state).toBeUndefined();
  });

  it('agInit should set progress and state from params', () => {
    component.agInit({ value: 0.65, data: { progress: 0.65, state: 'downloading' } } as any);
    expect(component.progress).toBe(0.65);
    expect(component.state).toBe('downloading');
  });

  it('agInit should use data.progress when value is not a number', () => {
    component.agInit({ value: undefined, data: { progress: 0.5, state: 'stalledDL' } } as any);
    expect(component.progress).toBe(0.5);
  });

  it('agInit should not change progress when data is null', () => {
    component.agInit({ value: 1, data: null } as any);
    expect(component.progress).toBe(0);
  });

  it('refresh should update values and return true', () => {
    const result = component.refresh({
      value: 1,
      data: { progress: 1, state: 'uploading' },
    } as any);
    expect(component.progress).toBe(1);
    expect(component.state).toBe('uploading');
    expect(result).toBe(true);
  });
});
