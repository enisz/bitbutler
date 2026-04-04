import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CodeCellRenderer } from './code-cell-renderer';

describe('CodeCellRenderer', () => {
  let component: CodeCellRenderer;
  let fixture: ComponentFixture<CodeCellRenderer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CodeCellRenderer],
    }).compileComponents();

    fixture = TestBed.createComponent(CodeCellRenderer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
