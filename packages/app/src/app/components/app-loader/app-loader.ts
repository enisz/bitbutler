import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
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

  @Input() public title = this.translateService.instant('components.app-loader.default-title');
  @Input() public message = '';
}
