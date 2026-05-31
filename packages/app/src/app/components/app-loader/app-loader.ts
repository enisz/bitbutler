import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BbSpinner } from '../bb-spinner/bb-spinner';

@Component({
  selector: 'app-app-loader',
  imports: [BbSpinner],
  templateUrl: './app-loader.html',
  styleUrl: './app-loader.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLoader {
  private readonly translateService = inject(TranslateService);

  readonly title = input(this.translateService.instant('components.app-loader.default-title'));
  readonly message = input('');
}
