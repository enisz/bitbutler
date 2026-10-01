import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { ICellEditorAngularComp } from 'ag-grid-angular';
import type { ICellEditorParams } from 'ag-grid-community';
import { SavePathSelect } from '../../save-path-select/save-path-select';

@Component({
  selector: 'app-save-path-cell-editor',
  standalone: true,
  imports: [ReactiveFormsModule, SavePathSelect],
  templateUrl: './save-path-cell-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SavePathCellEditor implements ICellEditorAngularComp {
  readonly pathControl = new FormControl('', { nonNullable: true });
  private value = '';

  constructor() {
    // SavePathSelect is a ControlValueAccessor bound via [formControl]; it has no output of its
    // own, so the edited value is picked up from the control's value stream rather than an event.
    this.pathControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((path) => this.onPathChange(path ?? ''));
  }

  agInit(params: ICellEditorParams<unknown, string>): void {
    this.value = params.value ?? '';
    this.pathControl.setValue(this.value);
  }

  getValue(): string {
    return this.value;
  }

  onPathChange(path: string): void {
    this.value = path;
  }

  isPopup(): boolean {
    return true;
  }
}
