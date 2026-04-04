import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

@Component({
  selector: 'app-code-cell-renderer',
  imports: [],
  templateUrl: './code-cell-renderer.html',
  styleUrl: './code-cell-renderer.scss',
})
export class CodeCellRenderer implements ICellRendererAngularComp {
  public value: string = '';

  agInit(params: ICellRendererParams<any, any, any>): void {
    this.value = params.value;
  }
  refresh(params: ICellRendererParams<any, any, any>): boolean {
    this.value = params.value;
    return true;
  }
}
