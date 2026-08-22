import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FAMILY_ACCENT_COLORS, ThemeFamily } from '../../services/theme.service';

@Component({
  selector: 'app-bb-logo',
  standalone: true,
  imports: [],
  templateUrl: './bb-logo.html',
  styleUrl: './bb-logo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BbLogo {
  readonly size = input<number>(190);
  /** Pins the logo to a specific theme family's accent color instead of the active theme's. */
  readonly family = input<ThemeFamily | undefined>(undefined);

  protected readonly accentColor = computed(() => {
    const family = this.family();
    return family ? FAMILY_ACCENT_COLORS[family] : null;
  });
}
