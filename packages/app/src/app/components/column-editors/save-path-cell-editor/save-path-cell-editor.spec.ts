import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { ICellEditorParams } from 'ag-grid-community';
import { SavePathCellEditor } from './save-path-cell-editor';

describe('SavePathCellEditor', () => {
  let fixture: ComponentFixture<SavePathCellEditor>;
  let component: SavePathCellEditor;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SavePathCellEditor] }).compileComponents();
    fixture = TestBed.createComponent(SavePathCellEditor);
    component = fixture.componentInstance;
  });

  it('initializes its value from agInit params', () => {
    component.agInit({ value: '/data/movies' } as ICellEditorParams<unknown, string>);
    expect(component.getValue()).toBe('/data/movies');
  });

  it('reflects a changed path through onPathChange before getValue is called', () => {
    component.agInit({ value: '/data/movies' } as ICellEditorParams<unknown, string>);
    component.onPathChange('/data/movies-2');
    expect(component.getValue()).toBe('/data/movies-2');
  });

  it('reflects a change to pathControl.setValue through to getValue (exercises the real valueChanges subscription)', () => {
    component.agInit({ value: '/data/movies' } as ICellEditorParams<unknown, string>);
    component.pathControl.setValue('/data/movies-2');
    expect(component.getValue()).toBe('/data/movies-2');
  });

  it('exposes isPopup as true so the embedded save-path select is not clipped by the cell bounds', () => {
    expect(component.isPopup()).toBe(true);
    // ag-grid itself handles editor teardown when a row is removed mid-edit (destroyPopupEditor
    // runs the same way as pressing Escape); this test just documents/pins that we rely on that
    // default behavior rather than adding custom isCancelBeforeStart/isCancelAfterEnd logic here.
  });
});
