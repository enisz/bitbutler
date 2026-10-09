import { Signal, WritableSignal, computed, signal } from '@angular/core';

/**
 * Dirty tracking and save orchestration shared by both settings pages. A "form" is one
 * independently saved unit; several panes can be bound to the same form.
 */
export abstract class PaneStateService<TFormId extends string> {
  private readonly dirtyFlags: WritableSignal<Record<TFormId, boolean>>;
  private readonly saveFns = new Map<TFormId, () => Promise<void>>();

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
