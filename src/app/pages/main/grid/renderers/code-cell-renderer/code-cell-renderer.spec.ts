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

  it('should have empty value by default', () => {
    expect(component.value).toBe('');
  });

  it('agInit should set value from params', () => {
    component.agInit({ value: 'abc123hash' } as any);
    expect(component.value).toBe('abc123hash');
  });

  it('refresh should update value and return true', () => {
    const result = component.refresh({ value: 'xyz789' } as any);
    expect(component.value).toBe('xyz789');
    expect(result).toBe(true);
  });
});
