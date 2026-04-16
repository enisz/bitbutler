import { InjectionToken } from '@angular/core';
import type { ContextMenuConfig } from './context-menu.types';

export const CONTEXT_MENU_CONFIG = new InjectionToken<ContextMenuConfig>('CONTEXT_MENU_CONFIG');

/**
 * Injected into child ContextMenu instances. Calling it cancels the close timers
 * of all ancestor menu levels, preventing submenus from collapsing when the mouse
 * moves from a parent panel into a deeper child panel (CDK overlays are DOM siblings,
 * so mouseleave fires on every ancestor panel as focus moves deeper).
 */
export const CANCEL_ANCESTOR_CLOSE = new InjectionToken<() => void>('CANCEL_ANCESTOR_CLOSE');
