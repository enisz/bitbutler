import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

export type ContextMenuVariant = 'default' | 'danger' | 'warning' | 'success' | 'info';

export type ContextMenuEntry = ContextMenuItem | ContextMenuHeader | ContextMenuDivider;

export interface ContextMenuItem {
  kind: 'item';
  id: string;
  label: string;
  icon?: IconDefinition;
  disabled?: boolean;
  variant?: ContextMenuVariant;
}

export interface ContextMenuHeader {
  kind: 'header';
  label: string;
}

export interface ContextMenuDivider {
  kind: 'divider';
}
