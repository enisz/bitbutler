import { provideZonelessChangeDetection } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';
import { SettingsStateService } from './app/modals/settings/settings-state.service';

export default [provideZonelessChangeDetection(), provideTranslateService(), SettingsStateService];
