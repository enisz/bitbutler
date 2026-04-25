import { provideZonelessChangeDetection } from '@angular/core';
import { HumanizeDurationPipe } from './app/pipes/humanize-duration-pipe';
import { provideTranslateService } from '@ngx-translate/core';
import { FilesizePipe } from './app/pipes/filesize-pipe';

export default [
  provideZonelessChangeDetection(),
  provideTranslateService(),
  FilesizePipe,
  HumanizeDurationPipe,
];
