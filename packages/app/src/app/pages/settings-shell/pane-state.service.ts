import { Signal, WritableSignal, computed, signal } from '@angular/core';

/** What a pane can do to its own unsaved state; both actions are optional. */
export interface PaneActions {
  /** Reverts the pane to its last saved values. */
  discard?: () => void;
  /** Fills the pane with its default values without saving them. */
  restoreDefaults?: () => void;
}

/**
 * Dirty tracking and save orchestration shared by both settings pages. A "form" is one
 * independently saved unit; several panes can be bound to the same form.
 */
export abstract class PaneStateService<TFormId extends string> {
  private readonly dirtyFlags: WritableSignal<Record<TFormId, boolean>>;
  private readonly saveFns = new Map<TFormId, () => Promise<void>>();
  private readonly paneActions = new Map<string, PaneActions>();
  private readonly versions = signal<Record<string, number>>({});

  /** Bumped per pane by `rebuildPane`; the shell recreates a pane when its number changes. */
  public readonly paneVersions = this.versions.asReadonly();

  public readonly isDirty: Signal<boolean>;
  public readonly isDirtyMap: Signal<Record<TFormId, boolean>>;

  protected constructor(private readonly formIds: readonly TFormId[]) {
    this.dirtyFlags = signal(this.cleanFlags());
    this.isDirty = computed(() => Object.values(this.dirtyFlags()).some(Boolean));
    this.isDirtyMap = this.dirtyFlags.asReadonly();
  }

  public markDirty(id: TFormId, dirty: boolean): void {
    this.dirtyFlags.update((flags) => ({ ...flags, [id]: dirty }));
  }

  public registerSave(id: TFormId, fn: () => Promise<void>): void {
    this.saveFns.set(id, fn);
  }

  /** Adds to what is already registered for the pane, so its form and its page can each add theirs. */
  public registerPaneActions(paneId: string, actions: PaneActions): void {
    this.paneActions.set(paneId, { ...this.paneActions.get(paneId), ...actions });
  }

  public discardPane(paneId: string): void {
    this.paneActions.get(paneId)?.discard?.();
  }

  public restorePaneDefaults(paneId: string): void {
    this.paneActions.get(paneId)?.restoreDefaults?.();
  }

  /**
   * Recreates one pane so it reads its persisted values again, and marks its form clean. For
   * panes that keep their edits in the component itself rather than in a page-level form.
   */
  public rebuildPane(paneId: string, formId: TFormId): void {
    this.versions.update((versions) => ({ ...versions, [paneId]: (versions[paneId] ?? 0) + 1 }));
    this.markDirty(formId, false);
  }

  public resetDirty(): void {
    this.dirtyFlags.set(this.cleanFlags());
  }

  /**
   * Saves every dirty form. Forms that save are marked clean even when another form fails;
   * the first failure is rethrown so the caller can report it.
   */
  public async saveAll(): Promise<void> {
    const dirtyIds = this.formIds.filter((id) => this.dirtyFlags()[id]);
    const results = await Promise.allSettled(
      dirtyIds.map((id) => this.saveFns.get(id)?.() ?? Promise.resolve()),
    );

    const failures: unknown[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        this.markDirty(dirtyIds[index], false);
      } else {
        failures.push(result.reason);
      }
    });

    if (failures.length > 0) throw failures[0];
  }

  private cleanFlags(): Record<TFormId, boolean> {
    return Object.fromEntries(this.formIds.map((id) => [id, false])) as Record<TFormId, boolean>;
  }
}
