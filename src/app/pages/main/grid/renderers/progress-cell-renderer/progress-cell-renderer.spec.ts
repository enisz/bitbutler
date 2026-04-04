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
});
