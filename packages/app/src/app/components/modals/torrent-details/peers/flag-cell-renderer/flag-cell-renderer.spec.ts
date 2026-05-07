import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FlagCellRenderer } from './flag-cell-renderer';

describe('FlagCellRenderer', () => {
  let component: FlagCellRenderer;
  let fixture: ComponentFixture<FlagCellRenderer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlagCellRenderer],
    }).compileComponents();

    fixture = TestBed.createComponent(FlagCellRenderer);
    component = fixture.componentInstance;
    component.agInit({ value: 'us' } as any);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should store params after agInit', () => {
    const params = { value: 'de', data: { country: 'Germany' } } as any;
    component.agInit(params);
    expect(component.params).toBe(params);
  });

  it('should return true from refresh', () => {
    expect(component.refresh({} as any)).toBe(true);
  });
});
