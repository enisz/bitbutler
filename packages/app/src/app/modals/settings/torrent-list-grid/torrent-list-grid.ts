import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FaIconComponent, FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faArrowDown,
  faArrowUp,
  faArrowsDownToLine,
  faArrowsUpToLine,
  faGripVertical,
  faTriangleExclamation,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectComponent } from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { type ColDef, type ColumnState } from 'ag-grid-community';
import { firstValueFrom, take, tap } from 'rxjs';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import {
  RowDoubleClickAction,
  TorrentListGridSettings,
} from '../../../models/torrent-list-grid.model';
import { getGridColDefs } from '../../../pages/main/grid/grid.lib';
import { TorrentListGridSettingsService } from '../../../services/torrent-list-grid.settings.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { UiFormatService } from '../../../services/ui-format.service';
import { SettingsStateService } from '../settings-state.service';
import { SettingsTabComponent } from '../settings.interface';

export interface NgSelectColumnItem {
  value: string;
  label: string;
}

type ColumnAction = 'move-to-top' | 'move-up' | 'move-down' | 'move-to-bottom' | 'remove';

const FOCUS_FALLBACKS: Record<ColumnAction, ColumnAction[]> = {
  'move-up': ['move-up', 'move-down', 'move-to-bottom', 'move-to-top'],
  'move-to-top': ['move-down', 'move-to-bottom', 'move-up', 'move-to-top'],
  'move-down': ['move-down', 'move-up', 'move-to-top', 'move-to-bottom'],
  'move-to-bottom': ['move-up', 'move-to-top', 'move-down', 'move-to-bottom'],
  remove: ['remove', 'move-down', 'move-up'],
};

@Component({
  selector: 'app-torrent-list-grid',
  standalone: true,
  imports: [
    BbSpinner,
    ReactiveFormsModule,
    NgSelectComponent,
    DragDropModule,
    FaIconComponent,
    BbPopover,
    FontAwesomeModule,
    TranslatePipe,
    NgbTooltipModule,
    TooltipOverflow,
  ],
  templateUrl: './torrent-list-grid.html',
  styleUrl: './torrent-list-grid.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TorrentListGrid implements SettingsTabComponent {
  private readonly torrentListGridSettingsService = inject(TorrentListGridSettingsService);
  private readonly uiFormatService = inject(UiFormatService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translateService = inject(TranslateService);
  private readonly stateService = inject(SettingsStateService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  faTriangleExclamation = faTriangleExclamation;

  public settings$ = this.torrentListGridSettingsService.asObservable().pipe(
    take(1),
    tap((settings: TorrentListGridSettings) => {
      const allDefs = getGridColDefs(
        this.uiFormatService,
        this.translateService,
        this.torrentStoreService,
      );
      this.initializeForm(settings, allDefs);
      this.loaded.set(true);
    }),
  );

  public torrentListGridForm = new FormGroup({
    columns: new FormControl<string[]>([]),
    pagination: new FormControl(false),
    animateRows: new FormControl(false),
    compactRows: new FormControl(false),
    pausePollingOnModal: new FormControl(false),
    rowDoubleClickAction: new FormControl<RowDoubleClickAction>('DETAILS'),
  });

  public columns = signal<NgSelectColumnItem[]>([]);
  public orderedColumns = signal<NgSelectColumnItem[]>([]);
  public faGripVertical = faGripVertical;
  public faArrowsUpToLine = faArrowsUpToLine;
  public faArrowUp = faArrowUp;
  public faArrowDown = faArrowDown;
  public faArrowsDownToLine = faArrowsDownToLine;
  public faXmark = faXmark;
  public loaded = signal(false);

  constructor() {
    const allDefs: ColDef[] = getGridColDefs(
      this.uiFormatService,
      this.translateService,
      this.torrentStoreService,
    );
    this.columns.set(
      allDefs
        .map((c) => ({ value: c.colId!, label: c.headerName ?? c.colId! }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    );

    this.torrentListGridSettingsService
      .asObservable()
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((settings) => {
        this.initializeForm(settings, allDefs);
        this.loaded.set(true);
      });

    this.stateService.registerSave('torrent-list-grid', () => this.save());

    this.torrentListGridForm
      .get('columns')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((selectedColIds) => {
        const current = this.orderedColumns();
        const ids = selectedColIds || [];
        const updated = current.filter((c) => ids.includes(c.value));
        ids.forEach((id) => {
          if (!updated.find((u) => u.value === id)) {
            const col = this.columns().find((c) => c.value === id);
            if (col) updated.push(col);
          }
        });
        this.orderedColumns.set(updated);
      });

    this.torrentListGridForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.stateService.markDirty('torrent-list-grid', true));
  }

  private initializeForm(settings: TorrentListGridSettings, allDefs: ColDef[]) {
    const currentState = (settings.columnState || []) as ColumnState[];

    const visibleColIds = currentState.filter((c) => !c.hide).map((c) => c.colId!);
    this.torrentListGridForm.patchValue(
      {
        columns: visibleColIds,
        pagination: settings.pagination,
        animateRows: settings.animateRows,
        compactRows: settings.compactRows ?? false,
        pausePollingOnModal: settings.pausePollingOnModal ?? false,
        rowDoubleClickAction: settings.rowDoubleClickAction,
      },
      { emitEvent: false },
    );

    this.orderedColumns.set(
      currentState
        .filter((c) => !c.hide)
        .map((c) => ({
          value: c.colId!,
          label: allDefs.find((d) => d.colId === c.colId)?.headerName ?? c.colId!,
        })),
    );
  }

  public drop(event: CdkDragDrop<NgSelectColumnItem[]>): void {
    const columns = [...this.orderedColumns()];
    moveItemInArray(columns, event.previousIndex, event.currentIndex);
    this.orderedColumns.set(columns);
    this.stateService.markDirty('torrent-list-grid', true);
  }

  public moveUp(index: number): void {
    const columns = [...this.orderedColumns()];
    if (index <= 0 || index >= columns.length) return;
    [columns[index - 1], columns[index]] = [columns[index], columns[index - 1]];
    this.orderedColumns.set(columns);
    this.stateService.markDirty('torrent-list-grid', true);
    this.retainActionFocus('move-up', columns[index - 1].value);
  }

  public moveDown(index: number): void {
    const columns = [...this.orderedColumns()];
    if (index < 0 || index >= columns.length - 1) return;
    [columns[index], columns[index + 1]] = [columns[index + 1], columns[index]];
    this.orderedColumns.set(columns);
    this.stateService.markDirty('torrent-list-grid', true);
    this.retainActionFocus('move-down', columns[index + 1].value);
  }

  public moveToTop(index: number): void {
    const columns = [...this.orderedColumns()];
    if (index <= 0 || index >= columns.length) return;
    const [moved] = columns.splice(index, 1);
    columns.unshift(moved);
    this.orderedColumns.set(columns);
    this.stateService.markDirty('torrent-list-grid', true);
    this.retainActionFocus('move-to-top', moved.value);
  }

  public moveToBottom(index: number): void {
    const columns = [...this.orderedColumns()];
    if (index < 0 || index >= columns.length - 1) return;
    const [moved] = columns.splice(index, 1);
    columns.push(moved);
    this.orderedColumns.set(columns);
    this.stateService.markDirty('torrent-list-grid', true);
    this.retainActionFocus('move-to-bottom', moved.value);
  }

  public remove(colId: string): void {
    const ordered = this.orderedColumns();
    const removedIndex = ordered.findIndex((c) => c.value === colId);
    const neighborColId = ordered[removedIndex + 1]?.value ?? ordered[removedIndex - 1]?.value;

    const columnsControl = this.torrentListGridForm.controls.columns;
    const currentIds = columnsControl.value ?? [];
    columnsControl.setValue(currentIds.filter((id) => id !== colId));

    this.retainActionFocus('remove', neighborColId);
  }

  /**
   * Angular's @for reorders/removes the underlying DOM nodes on every move
   * or delete, which drops browser focus to <body> regardless of whether
   * the clicked button became disabled. Once the affected row settles at
   * its new position, refocus the same action there, falling back to a
   * related one only if that exact action is now disabled - so focus never
   * jumps to an action the user didn't ask for.
   */
  private retainActionFocus(action: ColumnAction, colId: string | undefined): void {
    if (!colId) return;
    requestAnimationFrame(() => {
      if (document.activeElement !== document.body) return;

      const rows = this.elementRef.nativeElement.querySelectorAll<HTMLElement>('.column-drag-item');
      const row = Array.from(rows).find((r) => r.dataset['colId'] === colId);
      if (!row) return;

      for (const candidate of FOCUS_FALLBACKS[action]) {
        const button = row.querySelector<HTMLButtonElement>(
          `[data-action="${candidate}"]:not(:disabled)`,
        );
        if (button) {
          button.focus();
          return;
        }
      }
    });
  }

  private async save(): Promise<void> {
    const settings = await firstValueFrom(this.torrentListGridSettingsService.asObservable());
    const formValue = this.torrentListGridForm.getRawValue();
    const allDefs = getGridColDefs(
      this.uiFormatService,
      this.translateService,
      this.torrentStoreService,
    );

    const resolvedColumnState = (settings.columnState || []) as ColumnState[];
    const existingStateMap = new Map(resolvedColumnState.map((c) => [c.colId!, c]));
    const defsMap = new Map(allDefs.map((d) => [d.colId, d]));

    const orderedVisible = this.orderedColumns();
    const visibleIds = new Set(orderedVisible.map((c) => c.value));

    const newColumnState: ColumnState[] = orderedVisible.map((col) => {
      const existing = existingStateMap.get(col.value);
      const def = defsMap.get(col.value);
      return {
        colId: col.value,
        hide: false,
        width: existing?.width ?? (typeof def?.width === 'number' ? def.width : undefined),
        flex:
          existing?.flex ?? (def as any)?.flex ?? (typeof def?.width === 'number' ? undefined : 1),
        sort: existing?.sort ?? null,
        pinned: existing?.pinned ?? null,
      };
    });

    allDefs.forEach((def) => {
      if (!visibleIds.has(def.colId!)) {
        const existing = existingStateMap.get(def.colId!);
        newColumnState.push({
          colId: def.colId!,
          hide: true,
          width: existing?.width ?? (typeof def.width === 'number' ? def.width : undefined),
          flex:
            existing?.flex ?? (def as any)?.flex ?? (typeof def.width === 'number' ? undefined : 1),
          sort: existing?.sort ?? null,
          pinned: existing?.pinned ?? null,
        });
      }
    });

    await this.torrentListGridSettingsService.save({
      ...settings,
      pagination: formValue.pagination ?? settings.pagination,
      animateRows: formValue.animateRows ?? settings.animateRows,
      compactRows: formValue.compactRows ?? settings.compactRows,
      pausePollingOnModal: formValue.pausePollingOnModal ?? settings.pausePollingOnModal,
      rowDoubleClickAction: formValue.rowDoubleClickAction ?? settings.rowDoubleClickAction,
      columnState: newColumnState,
    });
  }
}
