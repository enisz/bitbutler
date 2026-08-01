import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  CdkDropListGroup,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { faRotateLeft } from '@fortawesome/free-solid-svg-icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { switchMap, tap } from 'rxjs';
import { BbBtnContent } from '../../../components/bb-btn-content/bb-btn-content';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import {
  DEFAULT_STATUS_BAR_SETTINGS,
  StatusBarSettings,
} from '../../../models/status-bar-settings.model';
import { StatusBarSettingsService } from '../../../services/status-bar-settings.service';
import { SettingsStateService } from '../settings-state.service';
import { SettingsTabComponent } from '../settings.interface';
import { StatusBarWidgetPreview } from './widget-preview/widget-preview';

interface Widget {
  id: string;
  label: string;
}

@Component({
  selector: 'app-status-bar',
  standalone: true,
  imports: [
    CdkDrag,
    CdkDropList,
    CdkDropListGroup,
    StatusBarWidgetPreview,
    BbSpinner,
    BbBtnContent,
    TranslatePipe,
  ],
  templateUrl: './status-bar.html',
  styleUrl: './status-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBar implements SettingsTabComponent {
  private statusBarService = inject(StatusBarSettingsService);
  private readonly translateService = inject(TranslateService);
  private readonly stateService = inject(SettingsStateService);

  public faRotateLeft = faRotateLeft;

  private readonly MASTER_WIDGET_KEYS = [
    'connection-status',
    'nodes',
    'ratio',
    'alltime-ratio',
    'global-down',
    'alltime-down',
    'global-up',
    'alltime-up',
    'download-speed',
    'upload-speed',
    'free-space',
    'selection',
    'polling-indicator',
  ];

  private MASTER_WIDGETS: Record<string, string> = {};

  public available: Widget[] = [];
  public left: Widget[] = [];
  public right: Widget[] = [];

  private settings$ = this.translateService
    .get(this.MASTER_WIDGET_KEYS.map((key) => `pages.settings.tab.status-bar.widget.${key}`))
    .pipe(
      tap((translations) => {
        this.MASTER_WIDGET_KEYS.forEach((key) => {
          this.MASTER_WIDGETS[key] = translations[`pages.settings.tab.status-bar.widget.${key}`];
        });
      }),
      switchMap(() => this.statusBarService.asObservable()),
      tap((settings: StatusBarSettings) => {
        const placed = new Set([...settings.available, ...settings.left, ...settings.right]);
        const missing = this.MASTER_WIDGET_KEYS.filter((key) => !placed.has(key));
        this.available = this.mapIdsToWidgets([...settings.available, ...missing]);
        this.left = this.mapIdsToWidgets(settings.left);
        this.right = this.mapIdsToWidgets(settings.right);
      }),
    );

  public readonly settingsLoaded = toSignal(this.settings$, { initialValue: null });

  constructor() {
    this.stateService.registerSave('status-bar', () => this.save());
  }

  private mapIdsToWidgets(ids: string[]): Widget[] {
    return (ids ?? [])
      .filter((id) => !!this.MASTER_WIDGETS[id])
      .map((id) => ({ id, label: this.MASTER_WIDGETS[id] }));
  }

  public reset(): void {
    this.available = this.mapIdsToWidgets(DEFAULT_STATUS_BAR_SETTINGS.available);
    this.left = this.mapIdsToWidgets(DEFAULT_STATUS_BAR_SETTINGS.left);
    this.right = this.mapIdsToWidgets(DEFAULT_STATUS_BAR_SETTINGS.right);
    this.stateService.markDirty('status-bar', true);
  }

  public drop(event: CdkDragDrop<Widget[]>): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
    }
    this.stateService.markDirty('status-bar', true);
  }

  private async save(): Promise<void> {
    await this.statusBarService.save({
      available: this.available.map((w) => w.id),
      left: this.left.map((w) => w.id),
      right: this.right.map((w) => w.id),
    });
  }
}
