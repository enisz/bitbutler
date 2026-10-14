import { inject } from '@angular/core';
import { CanDeactivateFn, Router } from '@angular/router';
import { ConfirmService } from '../services/confirm.service';

/** Navigation state key set by a forced logout so the page leaves without the prompt. */
export const FORCE_LEAVE_STATE_KEY = 'bbForceLeave';

export interface UnsavedChangesGuardable {
  /** Route prefix of the page, e.g. `/pages/settings`. Navigating inside it never prompts. */
  readonly basePath: string;
  readonly stateService: { isDirty(): boolean; resetDirty(): void };
}

export const unsavedChangesGuard: CanDeactivateFn<UnsavedChangesGuardable> = async (
  page,
  _currentRoute,
  _currentState,
  nextState,
) => {
  const router = inject(Router);
  const confirmService = inject(ConfirmService);
  const { stateService, basePath } = page;

  if (!stateService.isDirty()) return true;

  // Switching panes only changes the `:pane` segment, so the next URL is still under basePath.
  if (nextState.url.startsWith(`${basePath}/`)) return true;

  // An expired session cannot be saved into, so do not ask the user to stay on this page.
  if (router.currentNavigation()?.extras.state?.[FORCE_LEAVE_STATE_KEY]) {
    stateService.resetDirty();
    return true;
  }

  const confirmed = await confirmService.confirm(
    'components.modals.guard.unsaved-title',
    'components.modals.guard.unsaved-message',
    'components.modals.guard.btn-leave',
    'components.modals.guard.btn-stay',
  );

  if (confirmed) stateService.resetDirty();

  return confirmed;
};
