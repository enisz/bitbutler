import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-import-configuration',
  standalone: true,
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportConfiguration {
  public readonly bbcPath = input.required<string>();
}
