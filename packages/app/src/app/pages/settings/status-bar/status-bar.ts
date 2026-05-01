import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  CdkDropListGroup,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { AsyncPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faGripVertical } from '@fortawesome/free-solid-svg-icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { switchMap, tap } from 'rxjs';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { StatusBarSettings } from '../../../models/status-bar-settings.model';
import { StatusBarSettingsService } from '../../../services/status-bar-settings.service';
import { SettingsStateService } from '../settings-state.service';
import { SettingsTabComponent } from '../settings.interface';

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
    FaIconComponent,
    BbSpinner,
    AsyncPipe,
    TranslatePipe,
  ],
  templateUrl: './status-bar.html',
  styleUrl: './status-bar.scss',
})
export class StatusBar implements SettingsTabComponent, OnInit {
  private statusBarService = inject(StatusBarSettingsService);
  private readonly translateService = inject(TranslateService);
  private readonly stateService = inject(SettingsStateService);

  public faGripVertical = faGripVertical;

  private readonly MASTER_WIDGET_KEYS = [
    'connection-status',
    'nodes',
    'ratio',
    'global-down',
    'global-up',
    'download-speed',
    'upload-speed',
    'free-space',
    'session-stats',
    'selection',
    'polling-indicator',
  ];

  private MASTER_WIDGETS: Record<string, string> = {};

  public available: Widget[] = [];
  public left: Widget[] = [];
  public right: Widget[] = [];

  public settings$ = this.translateService
    .get(this.MASTER_WIDGET_KEYS.map((key) => `pages.settings.tab.status-bar.widget.${key}`))
    .pipe(
      tap((translations) => {
        this.MASTER_WIDGET_KEYS.forEach((key) => {
          this.MASTER_WIDGETS[key] = translations[`pages.settings.tab.status-bar.widget.${key}`];
        });
      }),
      switchMap(() => this.statusBarService.asObservable()),
      tap((settings: StatusBarSettings) => {
        this.available = this.mapIdsToWidgets(settings.available);
        this.left = this.mapIdsToWidgets(settings.left);
        this.right = this.mapIdsToWidgets(settings.right);
      }),
    );

  public ngOnInit(): void {
    this.stateService.registerSave('status-bar', () => this.save());
  }

  private mapIdsToWidgets(ids: string[]): Widget[] {
    return (ids ?? [])
      .filter((id) => !!this.MASTER_WIDGETS[id])
      .map((id) => ({ id, label: this.MASTER_WIDGETS[id] }));
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
