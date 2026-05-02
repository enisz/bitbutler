import { ChangeDetectionStrategy, Component, inject, linkedSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectComponent } from '@ng-select/ng-select';
import { ThemeMode, ThemeService } from './theme.service';

interface SelectItem {
  value: string;
  label: string;
}

@Component({
  selector: 'bb-theme-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgSelectComponent, FormsModule],
  template: `
    <ng-select
      class="bb-select-compact bb-select-mode"
      [items]="modes"
      bindValue="value"
      bindLabel="label"
      [searchable]="false"
      [clearable]="false"
      [ngModel]="selectedMode()"
      (ngModelChange)="onModeChange($event)"
    ></ng-select>
  `,
})
export class ThemePickerComponent {
  private readonly themeService = inject(ThemeService);

  readonly selectedMode = linkedSignal(this.themeService.mode);

  readonly modes: SelectItem[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];

  onModeChange(mode: ThemeMode): void {
    this.themeService.setMode(mode);
  }
}
