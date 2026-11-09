import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

@Component({
  selector: 'app-bb-bottom-sheet',
  standalone: true,
  templateUrl: './bb-bottom-sheet.html',
  styleUrl: './bb-bottom-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'close()',
  },
})
export class BbBottomSheet {
  public readonly open = model(false);
  public readonly title = input<string>('');

  protected close(): void {
    if (this.open()) this.open.set(false);
  }
}
