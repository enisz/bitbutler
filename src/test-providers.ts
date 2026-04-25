import { provideZonelessChangeDetection } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';
import { FilesizePipe } from './app/pipes/filesize-pipe';

export default [provideZonelessChangeDetection(), provideTranslateService(), FilesizePipe];
