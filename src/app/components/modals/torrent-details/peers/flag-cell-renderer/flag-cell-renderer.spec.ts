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
});
