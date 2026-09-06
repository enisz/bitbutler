import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import type { LogEntry } from '@bitbutler/shared';
import { faCode } from '@fortawesome/free-solid-svg-icons';
import { TranslateService } from '@ngx-translate/core';
import { AgGridAngular } from 'ag-grid-angular';
import type { CellContextMenuEvent, GridApi, GridOptions } from 'ag-grid-community';
import { Subject, distinctUntilChanged, firstValueFrom, map, throttleTime } from 'rxjs';
import { GRID_DARK_THEME, GRID_LIGHT_THEME } from '../../../app.const';
import { ContextMenuService } from '../../../services/context-menu.service';
import { LogGridSettingsService } from '../../../services/log-grid.settings.service';
import { ThemeService } from '../../../services/theme.service';
import { UiFormatService } from '../../../services/ui-format.service';
import { ContextMenuEntry } from '../../main/grid/context-menu/context-menu.types';
import { GridContextMenuService } from '../../main/grid/context-menu/grid-context-menu.service';
import { getLogGridColDefs, getLogRowClassRules } from './logs-grid.lib';

@Component({
  selector: 'app-logs-grid',
  standalone: true,
  imports: [AgGridAngular],
  templateUrl: './logs-grid.html',
  styleUrl: './logs-grid.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogsGrid implements AfterViewInit {
  logs = input<LogEntry[]>([]);

  private readonly contextMenuService = inject(ContextMenuService);
  private readonly gridContextMenuService = inject(GridContextMenuService);
  private readonly themeService = inject(ThemeService);
  private readonly uiFormatService = inject(UiFormatService);
  private readonly translateService = inject(TranslateService);
  private readonly logGridSettingsService = inject(LogGridSettingsService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly saveState$ = new Subject<void>();
  private api: GridApi<LogEntry> | null = null;

  public readonly theme = this.themeService.effectiveMode;

  public readonly colorCodingEnabled = toSignal(
    this.logGridSettingsService.asObservable().pipe(
      map((s) => s.colorCodingEnabled),
      distinctUntilChanged(),
    ),
    { initialValue: false },
  );

  public readonly compactRowsEnabled = toSignal(
    this.logGridSettingsService.asObservable().pipe(
      map((s) => s.compactRows),
      distinctUntilChanged(),
    ),
    { initialValue: false },
  );

  public readonly currentTheme = computed(() => {
    const base = this.theme() === 'dark' ? GRID_DARK_THEME : GRID_LIGHT_THEME;
    return this.compactRowsEnabled() ? base.withParams({ spacing: 4, rowHeight: 32 }) : base;
  });

  public gridOptions: GridOptions<LogEntry>;

  constructor() {
    this.gridOptions = {
      columnDefs: getLogGridColDefs(this.uiFormatService, this.translateService, () => this.logs()),
      rowClassRules: getLogRowClassRules(() => this.colorCodingEnabled()),
      getRowId: (params) => String(params.data.id),
      onCellContextMenu: (event) => {
        this.contextMenuService.open({ items: this.buildRowMenu(event) });
      },
      onColumnHeaderContextMenu: (event) => {
        this.contextMenuService.open({ items: this.gridContextMenuService.buildHeaderMenu(event) });
      },
      onGridReady: (event) => {
        this.api = event.api;
        void this.restoreColumnState();
      },
      onColumnResized: (e) => {
        if (e.finished) this.queueSave();
      },
      onColumnMoved: () => this.queueSave(),
      onColumnPinned: () => this.queueSave(),
      onColumnVisible: () => this.queueSave(),
      onSortChanged: () => this.queueSave(),
    };

    effect(() => {
      this.colorCodingEnabled();
      this.api?.redrawRows();
    });
  }

  ngAfterViewInit(): void {
    this.saveState$
      .pipe(throttleTime(500, undefined, { trailing: true }), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.saveColumnState());
  }

  private buildRowMenu(event: CellContextMenuEvent<LogEntry>): ContextMenuEntry[] {
    const row = event.data;
    if (!row) return [];

    return [
      {
        kind: 'item',
        id: 'copy.json',
        label: 'pages.main.grid.context-menu.item.copy-row-as-json',
        icon: faCode,
        action: () =>
          this.gridContextMenuService.copyToClipboard(
            JSON.stringify(row, null, 2),
            this.translateService.instant('pages.main.grid.context-menu.field.row-as-json'),
          ),
      },
    ];
  }

  private queueSave(): void {
    this.saveState$.next();
  }

  private async restoreColumnState(): Promise<void> {
    const settings = await firstValueFrom(this.logGridSettingsService.asObservable());
    if (settings.columnState && this.api) {
      this.api.applyColumnState({ state: settings.columnState, applyOrder: true });
    }
  }

  private async saveColumnState(): Promise<void> {
    if (!this.api) return;
    const settings = await firstValueFrom(this.logGridSettingsService.asObservable());
    await this.logGridSettingsService.save({ ...settings, columnState: this.api.getColumnState() });
  }
}
