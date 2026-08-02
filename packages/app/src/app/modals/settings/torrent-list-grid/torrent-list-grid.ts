import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FaIconComponent, FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faAnglesDown,
  faAnglesUp,
  faChevronDown,
  faChevronUp,
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
  public faAnglesUp = faAnglesUp;
  public faAnglesDown = faAnglesDown;
  public faChevronUp = faChevronUp;
  public faChevronDown = faChevronDown;
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

  public moveUp(index: number, event?: Event): void {
    const columns = [...this.orderedColumns()];
    if (index <= 0 || index >= columns.length) return;
    [columns[index - 1], columns[index]] = [columns[index], columns[index - 1]];
    this.orderedColumns.set(columns);
    this.stateService.markDirty('torrent-list-grid', true);
    this.retainActionFocus(event);
  }

  public moveDown(index: number, event?: Event): void {
    const columns = [...this.orderedColumns()];
    if (index < 0 || index >= columns.length - 1) return;
    [columns[index], columns[index + 1]] = [columns[index + 1], columns[index]];
    this.orderedColumns.set(columns);
    this.stateService.markDirty('torrent-list-grid', true);
    this.retainActionFocus(event);
  }

  public moveToTop(index: number, event?: Event): void {
    const columns = [...this.orderedColumns()];
    if (index <= 0 || index >= columns.length) return;
    const [moved] = columns.splice(index, 1);
    columns.unshift(moved);
    this.orderedColumns.set(columns);
    this.stateService.markDirty('torrent-list-grid', true);
    this.retainActionFocus(event);
  }

  public moveToBottom(index: number, event?: Event): void {
    const columns = [...this.orderedColumns()];
    if (index < 0 || index >= columns.length - 1) return;
    const [moved] = columns.splice(index, 1);
    columns.push(moved);
    this.orderedColumns.set(columns);
    this.stateService.markDirty('torrent-list-grid', true);
    this.retainActionFocus(event);
  }

  public remove(colId: string, event?: Event): void {
    const columnsControl = this.torrentListGridForm.controls.columns;
    const currentIds = columnsControl.value ?? [];
    columnsControl.setValue(currentIds.filter((id) => id !== colId));
    this.retainActionFocus(event);
  }

  /**
   * Disabling or removing the clicked button drops browser focus to <body>.
   * Restore it to the nearest still-enabled action button so keyboard users
   * don't lose their place in the list.
   */
  private retainActionFocus(event?: Event): void {
    const trigger = event?.currentTarget as HTMLElement | undefined;
    const list = trigger?.closest<HTMLElement>('.column-drop-list');
    const row = trigger?.closest<HTMLElement>('.column-drag-item');
    const rowIndex = row && list ? Array.from(list.children).indexOf(row) : -1;

    requestAnimationFrame(() => {
      if (document.activeElement !== document.body) return;

      if (row?.isConnected) {
        const sibling = row.querySelector<HTMLButtonElement>(
          '.column-actions button:not(:disabled)',
        );
        if (sibling) {
          sibling.focus();
          return;
        }
      }

      if (!list || rowIndex < 0) return;
      const rows = list.querySelectorAll<HTMLElement>('.column-drag-item');
      if (rows.length === 0) return;
      const fallbackRow = rows[Math.min(rowIndex, rows.length - 1)];
      fallbackRow
        .querySelector<HTMLButtonElement>('.column-actions button:not(:disabled)')
        ?.focus();
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
