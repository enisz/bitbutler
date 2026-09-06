import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  OnInit,
  computed,
  inject,
  input,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { LogEntry } from '@bitbutler/shared';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faChevronDown,
  faChevronUp,
  faFileExport,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbCollapse } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { AutofocusDirective } from '../../directives/autofocus';
import { DateFormatService } from '../../services/date-format.service';
import { ToastService } from '../../services/toast.service';
import { LOG_EXPORT_FORMAT_TOKENS, renderLogFormatTemplate } from './log-export-format.lib';

export type ExportLogsScope = 'all' | 'filtered' | 'selected';

const DEFAULT_FORMAT = '[{{date}}] [{{process}}] [{{level}}] ({{filename}}:{{line}}) - {{message}}';

const SAMPLE_LOG: LogEntry = {
  id: 1,
  timestamp: Math.floor(Date.now() / 1000),
  process: 'main',
  level: 'info',
  message: 'Sample log message',
  context: null,
  filename: 'main.ts',
  line: 42,
};

interface FormatTokenGuideRow {
  token: string;
  description: string;
  example: string;
}

@Component({
  selector: 'app-export-logs',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    FontAwesomeModule,
    NgbCollapse,
    BbBtnContent,
    AutofocusDirective,
  ],
  templateUrl: './export-logs.html',
  styleUrl: './export-logs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExportLogs implements OnInit {
  private readonly activeModal = inject(NgbActiveModal);
  private readonly dateFormatService = inject(DateFormatService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly injector = inject(Injector);

  public readonly icons = { faFileExport, faXmark, faChevronDown, faChevronUp };

  public readonly all = input<LogEntry[]>([]);
  public readonly filtered = input<LogEntry[]>([]);
  public readonly selected = input<LogEntry[]>([]);

  public exportForm!: FormGroup;
  public readonly variableGuideExpanded = signal(false);
  public readonly exporting = signal(false);

  private scopeValue!: ReturnType<typeof toSignal<ExportLogsScope>>;

  public readonly allCount = computed(() => this.all().length);
  public readonly filteredCount = computed(() => this.filtered().length);
  public readonly selectedCount = computed(() => this.selected().length);
  public readonly hasFiltered = computed(() => this.filteredCount() > 0);
  public readonly hasSelection = computed(() => this.selectedCount() > 0);

  public readonly exportedLogs = computed<LogEntry[]>(() => {
    switch (this.scopeValue?.()) {
      case 'selected':
        return this.selected();
      case 'filtered':
        return this.filtered();
      default:
        return this.all();
    }
  });

  private readonly sampleEntry = computed<LogEntry>(() => this.exportedLogs()[0] ?? SAMPLE_LOG);

  public readonly variableGuide = computed<FormatTokenGuideRow[]>(() =>
    LOG_EXPORT_FORMAT_TOKENS.map((token) => ({
      token,
      description: this.translateService.instant(
        `components.modals.export-logs.variable-guide.token.${token}`,
      ),
      example: renderLogFormatTemplate(`{{${token}}}`, this.sampleEntry(), this.dateFormatService),
    })),
  );

  ngOnInit(): void {
    this.exportForm = new FormGroup({
      scope: new FormControl<ExportLogsScope>('all', { nonNullable: true }),
      format: new FormControl(DEFAULT_FORMAT, {
        nonNullable: true,
        validators: [Validators.required],
      }),
    });

    const scopeControl = this.exportForm.get('scope')!;
    this.scopeValue = runInInjectionContext(this.injector, () =>
      toSignal(scopeControl.valueChanges, { initialValue: scopeControl.value as ExportLogsScope }),
    );
  }

  toggleVariableGuide(): void {
    this.variableGuideExpanded.update((v) => !v);
  }

  async startExport(): Promise<void> {
    if (this.exportForm.invalid) return;

    const { format } = this.exportForm.getRawValue();
    const content = this.exportedLogs()
      .map((entry) => renderLogFormatTemplate(format, entry, this.dateFormatService))
      .join('\n');

    this.exporting.set(true);
    try {
      const result = await window.bitbutler.log.export({
        content,
        defaultFilename: 'bitbutler.log',
      });
      if (result.cancelled) return;

      this.toastService.success(
        result.path ?? '',
        this.translateService.instant('components.modals.export-logs.toast.success.title'),
      );
      this.activeModal.close();
    } catch (error) {
      this.toastService.danger(
        String(error),
        this.translateService.instant('components.modals.export-logs.toast.error.title'),
      );
    } finally {
      this.exporting.set(false);
    }
  }

  close(): void {
    this.activeModal.dismiss();
  }
}
