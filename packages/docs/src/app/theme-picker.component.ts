import { ChangeDetectionStrategy, Component, inject, linkedSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectComponent } from '@ng-select/ng-select';
import { ThemeFamily, ThemeMode, ThemeService } from './theme.service';

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
    <div class="theme-picker">
      <ng-select
        class="bb-select-compact bb-select-theme"
        [items]="families"
        bindValue="value"
        bindLabel="label"
        [searchable]="false"
        [clearable]="false"
        [ngModel]="selectedFamily()"
        (ngModelChange)="onFamilyChange($event)"
      ></ng-select>
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
    </div>
  `,
  styles: [
    `
      .theme-picker {
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }
    `,
  ],
})
export class ThemePickerComponent {
  private readonly themeService = inject(ThemeService);

  readonly selectedFamily = linkedSignal(this.themeService.family);
  readonly selectedMode = linkedSignal(this.themeService.mode);

  readonly families: SelectItem[] = [
    { value: 'bitbutler', label: 'BitButler' },
    { value: 'aurora', label: 'Aurora' },
    { value: 'mint-green', label: 'Mint Green' },
    { value: 'purple-haze', label: 'Purple Haze' },
    { value: 'ocean-breeze', label: 'Ocean Breeze' },
    { value: 'pumpkin-spice', label: 'Pumpkin Spice' },
    { value: 'deep-sea', label: 'Deep Sea' },
    { value: 'crimson-ember', label: 'Crimson Ember' },
  ];

  readonly modes: SelectItem[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];

  onFamilyChange(family: ThemeFamily): void {
    this.themeService.setFamily(family);
  }

  onModeChange(mode: ThemeMode): void {
    this.themeService.setMode(mode);
  }
}
