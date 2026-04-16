import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { Torrent } from '../../../../models/torrent.model';
import { AppCommand } from '../../../../models/command.model';

export interface GridContextMenuData {
  cell: {
    colId: string;
    field?: string;
    rowId: string;
    value: unknown;
  };

  row: Torrent;
  selected: Torrent[];
  rowPinned: 'top' | 'bottom' | null | undefined;
}

export type ContextMenuVariant = 'default' | 'info' | 'success' | 'warning' | 'danger';

export type ContextMenuEntry =
  | { kind: 'header'; label: string }
  | { kind: 'divider' }
  | {
      kind: 'item';
      id: string;
      label: string;
      icon?: IconDefinition;
      variant?: ContextMenuVariant;
      disabled?: boolean;
      action?: AppCommand | (() => void);
      hint?: string;
    }
  | {
      kind: 'submenu';
      id: string;
      label: string;
      icon?: IconDefinition;
      variant?: ContextMenuVariant;
      disabled?: boolean;
      children: ContextMenuEntry[];
    };

export type ContextMenuConfig<TPayload = unknown> = {
  items: ContextMenuEntry[];
  payload?: TPayload;

  title?: string;
};

export type ContextMenuPosition = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
