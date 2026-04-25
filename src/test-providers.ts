import { provideZonelessChangeDetection } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';
import { FilesizePipe } from './app/pipes/filesize-pipe';
import { HumanizeDurationPipe } from './app/pipes/humanize-duration-pipe';

export default [
  provideZonelessChangeDetection(),
  provideTranslateService(),
  FilesizePipe,
  HumanizeDurationPipe,
];
