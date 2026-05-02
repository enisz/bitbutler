import { Component, inject } from '@angular/core';
import { Theme, ThemeService } from './theme.service';

@Component({
  selector: 'bb-theme-picker',
  standalone: true,
  template: `
    <div class="theme-picker">
      <span class="theme-picker-label">Theme</span>
      <div class="theme-picker-options">
        @for (theme of themes; track theme.value) {
          <button
            class="theme-btn"
            [class.active]="themeService.theme() === theme.value"
            [attr.title]="theme.label"
            (click)="themeService.setTheme(theme.value)"
          >
            {{ theme.label }}
          </button>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .theme-picker {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .theme-picker-label {
        font-size: 0.8rem;
        opacity: 0.7;
      }
      .theme-picker-options {
        display: flex;
        gap: 0.25rem;
        flex-wrap: wrap;
      }
      .theme-btn {
        padding: 0.2rem 0.5rem;
        font-size: 0.75rem;
        border: 1px solid var(--bs-border-color);
        border-radius: 4px;
        background: transparent;
        color: var(--bs-body-color);
        cursor: pointer;
        transition: background 0.15s;
      }
      .theme-btn:hover,
      .theme-btn.active {
        background: var(--bs-primary);
        color: white;
        border-color: var(--bs-primary);
      }
    `,
  ],
})
export class ThemePickerComponent {
  readonly themeService = inject(ThemeService);

  readonly themes: { value: Theme; label: string }[] = [
    { value: 'bitbutler', label: 'BitButler' },
    { value: 'aurora', label: 'Aurora' },
    { value: 'mint-green', label: 'Mint' },
    { value: 'purple-haze', label: 'Purple' },
    { value: 'ocean-breeze', label: 'Ocean' },
    { value: 'pumpkin-spice', label: 'Pumpkin' },
    { value: 'deep-sea', label: 'Deep Sea' },
    { value: 'crimson-ember', label: 'Crimson' },
  ];
}
