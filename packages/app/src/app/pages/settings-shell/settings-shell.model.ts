import { Type } from '@angular/core';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

export interface SettingsPaneDef {
  id: string;
  labelKey: string;
  descriptionKey: string;
  icon: IconDefinition;
  /** Key into the page's dirty map; several panes can share a form. */
  formId: string;
  loadComponent: () => Promise<Type<unknown>>;
}

export interface SettingsNavGroup {
  labelKey: string;
  panes: SettingsPaneDef[];
}

export interface SettingsPageConfig {
  /** Route prefix without a trailing slash, e.g. `/pages/settings`. */
  basePath: string;
  titleKey: string;
  footerNoteKey: string;
  groups: SettingsNavGroup[];
}

export type SettingsPageStatus = 'loading' | 'ready' | 'error';
