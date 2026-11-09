import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Type,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faArrowsRotate,
  faChevronLeft,
  faFloppyDisk,
  faRotateLeft,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { TranslatePipe } from '@ngx-translate/core';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { BbLogo } from '../../components/bb-logo/bb-logo';
import { BbSpinner } from '../../components/bb-spinner/bb-spinner';
import { BbTooltip } from '../../directives/bb-tooltip';
import { ElectronService } from '../../services/electron.service';
import { ViewportService } from '../../services/viewport.service';
import {
  SettingsActionDef,
  SettingsNavGroup,
  SettingsPageConfig,
  SettingsPageStatus,
  SettingsPaneDef,
} from './settings-shell.model';

/**
 * Layout for a settings page: sidebar nav, pane header, pane host and the Save/Cancel bar.
 * Presentational only; the page component owns state, saving and navigation.
 *
 * Every pane of the page stays mounted and only the active one is shown, so edits made in a
 * pane survive switching to another pane.
 */
@Component({
  selector: 'app-settings-shell',
  imports: [
    NgComponentOutlet,
    RouterLink,
    FontAwesomeModule,
    BbTooltip,
    TranslatePipe,
    BbBtnContent,
    BbLogo,
    BbSpinner,
  ],
  templateUrl: './settings-shell.html',
  styleUrl: './settings-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsShell {
  public readonly config = input.required<SettingsPageConfig>();
  public readonly activePaneId = input.required<string>();
  public readonly status = input<SettingsPageStatus>('ready');
  public readonly isDirty = input(false);
  public readonly dirtyMap = input<Record<string, boolean>>({});
  /** Per-pane override of `dirtyMap`, for panes that share a form; keyed by pane id. */
  public readonly paneDirtyMap = input<Record<string, boolean>>({});
  /** Bumping this value rebuilds every pane, so they re-read their persisted values. */
  public readonly paneVersion = input(0);
  /** Rebuilds a single pane when its number changes, leaving the others as they are. */
  public readonly paneVersions = input<Record<string, number>>({});
  public readonly subtitle = input<string | null>(null);
  public readonly errorKey = input('');

  public readonly save = output<void>();
  public readonly discardPane = output<string>();
  public readonly restorePaneDefaults = output<string>();
  public readonly back = output<void>();
  public readonly retry = output<void>();
  /** Phone only: an action row of the pane list was tapped. */
  public readonly actionRun = output<SettingsActionDef>();

  public readonly version = inject(ElectronService).getBitButlerVersion();
  public readonly icons = { faArrowsRotate, faChevronLeft, faFloppyDisk, faRotateLeft, faXmark };

  public readonly isPhone = inject(ViewportService).isPhone;
  /** Phone only: the pane list or one opened pane (the panes stay mounted either way). */
  public readonly phoneView = signal<'list' | 'pane'>('list');
  public readonly phoneAttr = computed(() => (this.isPhone() ? this.phoneView() : null));

  public openPane(): void {
    this.phoneView.set('pane');
  }

  public showPaneList(): void {
    this.phoneView.set('list');
  }

  public readonly panes = computed<SettingsPaneDef[]>(() =>
    this.config().groups.flatMap((group) => group.panes),
  );
  public readonly activePane = computed(
    () => this.panes().find((pane) => pane.id === this.activePaneId()) ?? this.panes()[0],
  );
  public readonly loadedComponents = signal<ReadonlyMap<string, Type<unknown>>>(new Map());

  public isActionsOnly(group: SettingsNavGroup): boolean {
    return group.panes.length === 0 && (group.actions?.length ?? 0) > 0;
  }

  public isPaneDirty(pane: SettingsPaneDef): boolean {
    return this.paneDirtyMap()[pane.id] ?? this.dirtyMap()[pane.formId] ?? false;
  }

  private readonly content = viewChild<ElementRef<HTMLElement>>('content');

  constructor() {
    effect(() => {
      void this.loadPanes(this.panes());
    });

    effect(() => {
      this.activePane();
      const element = this.content()?.nativeElement;
      if (element) element.scrollTop = 0;
    });
  }

  private async loadPanes(panes: SettingsPaneDef[]): Promise<void> {
    const entries = await Promise.all(
      panes.map(async (pane) => [pane.id, await pane.loadComponent()] as const),
    );
    this.loadedComponents.set(new Map(entries));
  }
}
