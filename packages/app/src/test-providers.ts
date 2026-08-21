import { provideZonelessChangeDetection } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';

export default [provideZonelessChangeDetection(), provideTranslateService()];
