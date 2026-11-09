import { Type } from '@angular/core';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

export interface SettingsPaneDef {
  id: string;
  labelKey: string;
  descriptionKey: string;
  icon: IconDefinition;
  /** Key into the page's dirty map; several panes can share a form. */
  formId: string;
  /** Shows the Restore defaults action in the pane header. */
  hasDefaults?: boolean;
  loadComponent: () => Promise<Type<unknown>>;
}

/** A phone-only row in the pane list that runs a menu action instead of opening a pane. */
export interface SettingsActionDef {
  id: string;
  labelKey: string;
  icon: IconDefinition;
  danger?: boolean;
  menuAction: string;
}

export interface SettingsNavGroup {
  labelKey: string;
  panes: SettingsPaneDef[];
  actions?: SettingsActionDef[];
}

export interface SettingsPageConfig {
  /** Route prefix without a trailing slash, e.g. `/pages/settings`. */
  basePath: string;
  titleKey: string;
  footerNoteKey: string;
  groups: SettingsNavGroup[];
}

export type SettingsPageStatus = 'loading' | 'ready' | 'error';
