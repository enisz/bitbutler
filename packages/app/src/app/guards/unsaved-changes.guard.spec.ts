import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import type { Mock } from 'vitest';
import { ConfirmService } from '../services/confirm.service';
import {
  FORCE_LEAVE_STATE_KEY,
  UnsavedChangesGuardable,
  unsavedChangesGuard,
} from './unsaved-changes.guard';

describe('unsavedChangesGuard', () => {
  const dirty = signal(false);
  let resetDirty: Mock<() => void>;
  let confirm: ReturnType<typeof vi.fn>;
  let navigationState: Record<string, unknown> | undefined;
  let page: UnsavedChangesGuardable;

  const run = (nextUrl: string) =>
    TestBed.runInInjectionContext(() =>
      unsavedChangesGuard(
        page,
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
        { url: nextUrl } as RouterStateSnapshot,
      ),
    );

  beforeEach(() => {
    dirty.set(false);
    resetDirty = vi.fn<() => void>();
    confirm = vi.fn().mockResolvedValue(false);
    navigationState = undefined;
    page = {
      basePath: '/pages/settings',
      stateService: { isDirty: dirty, resetDirty },
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: ConfirmService, useValue: { confirm } },
        {
          provide: Router,
          useValue: { currentNavigation: () => ({ extras: { state: navigationState } }) },
        },
      ],
    });
  });

  it('allows leaving without a prompt when nothing is dirty', async () => {
    expect(await run('/pages/torrent-list')).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('does not prompt when only the pane changes inside the same page', async () => {
    dirty.set(true);

    expect(await run('/pages/settings/appearance')).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(resetDirty).not.toHaveBeenCalled();
  });

  it('prompts when leaving the page dirty and stays when the user declines', async () => {
    dirty.set(true);
    confirm.mockResolvedValue(false);

    expect(await run('/pages/torrent-list')).toBe(false);
    expect(confirm).toHaveBeenCalledWith(
      'components.modals.guard.unsaved-title',
      'components.modals.guard.unsaved-message',
      'components.modals.guard.btn-leave',
      'components.modals.guard.btn-stay',
    );
    expect(resetDirty).not.toHaveBeenCalled();
  });

  it('leaves and resets the dirty state when the user confirms', async () => {
    dirty.set(true);
    confirm.mockResolvedValue(true);

    expect(await run('/pages/torrent-list')).toBe(true);
    expect(resetDirty).toHaveBeenCalledOnce();
  });

  it('leaves without a prompt when the navigation carries the force-leave flag', async () => {
    dirty.set(true);
    navigationState = { [FORCE_LEAVE_STATE_KEY]: true };

    expect(await run('/login')).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(resetDirty).toHaveBeenCalledOnce();
  });
});
