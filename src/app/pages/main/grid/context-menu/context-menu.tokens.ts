import { InjectionToken } from '@angular/core';
import type { ContextMenuConfig } from './context-menu.types';

export const CONTEXT_MENU_CONFIG = new InjectionToken<ContextMenuConfig>('CONTEXT_MENU_CONFIG');
