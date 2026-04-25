import { provideZonelessChangeDetection } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';
import { FilesizePipe } from './app/pipes/filesize-pipe';
import { HumanizeDurationPipe } from './app/pipes/humanize-duration-pipe';
import { LocalTimestampPipe } from './app/pipes/local-timestamp-pipe';
import { RatioPipe } from './app/pipes/ratio-pipe';
import { RatioLimitPipe } from './app/pipes/ratio-limit-pipe';
import { TimeLimitPipe } from './app/pipes/time-limit-pipe';
import { SettingsStateService } from './app/pages/settings/settings-state.service';

export default [
  provideZonelessChangeDetection(),
  provideTranslateService(),
  FilesizePipe,
  HumanizeDurationPipe,
  LocalTimestampPipe,
  RatioPipe,
  RatioLimitPipe,
  TimeLimitPipe,
  SettingsStateService,
];
