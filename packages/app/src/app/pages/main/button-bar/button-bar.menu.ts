import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

export type ToolbarVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'info'
  | 'warning'
  | 'danger';

export type ToolbarEntry = ToolbarAction | ToolbarDivider | ToolbarGroup;

export interface ToolbarAction {
  kind: 'action';
  id: string;
  label: string;
  icon?: IconDefinition;
  disabled?: boolean;
  variant?: ToolbarVariant;
}

export interface ToolbarDivider {
  kind: 'divider';
}

export interface ToolbarGroup {
  kind: 'group';
  id: string;
  label: string;
  icon?: IconDefinition;
  disabled?: boolean;
  variant?: ToolbarVariant;
  items: ToolbarAction[];
}
