import { InjectionToken } from '@angular/core';
import type { ContextMenuConfig } from './context-menu.types';

export const CONTEXT_MENU_CONFIG = new InjectionToken<ContextMenuConfig>('CONTEXT_MENU_CONFIG');
export const CANCEL_ANCESTOR_CLOSE = new InjectionToken<() => void>('CANCEL_ANCESTOR_CLOSE');
export const CLOSE_ROOT = new InjectionToken<() => void>('CLOSE_ROOT');
