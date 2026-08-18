import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { IconDefinition, faChevronDown, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { debounceTime, startWith } from 'rxjs/operators';
import { BbProgressVariant } from '../../../../components/bb-progress/bb-progress.types';
import { TooltipOverflow } from '../../../../directives/tooltip-overflow';

const FILTER_DEBOUNCE_MS = 150;

export interface FilterGroupAction {
  label: string;
  action: () => void;
}

export interface FilterItem {
  key: string;
  label: string;
  count: number;
  icon?: IconDefinition | IconDefinition[];
  variant?: BbProgressVariant;
}

@Component({
  selector: 'app-filter-group',
  standalone: true,
  imports: [
    NgClass,
    FontAwesomeModule,
    FormsModule,
    ReactiveFormsModule,
    NgbTooltip,
    TranslatePipe,
    TooltipOverflow,
  ],
  templateUrl: './filter-group.html',
  styleUrl: './filter-group.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterGroupComponent {
  readonly label = input.required<string>();
  readonly items = input<FilterItem[] | null>(null);
  readonly activeKeys = input.required<ReadonlySet<string>>();
  readonly showAll = input(true);
  readonly showAllCount = input.required<number>();
  readonly showFilter = input(false);
  readonly action = input<FilterGroupAction | null>(null);
  readonly initialOpen = input(true);

  readonly itemSelected = output<string>();
  readonly openChanged = output<boolean>();

  public readonly icons = { faXmark, faChevronDown };
  public filterCtrl = new FormControl('', { nonNullable: true });
  private readonly openOverride = signal<boolean | null>(null);
  public readonly open = computed(() => this.openOverride() ?? this.initialOpen());

  public toggleOpen(): void {
    const next = !this.open();
    this.openOverride.set(next);
    this.openChanged.emit(next);
  }

  private readonly filterText = toSignal(
    this.filterCtrl.valueChanges.pipe(startWith(''), debounceTime(FILTER_DEBOUNCE_MS)),
    { initialValue: '' },
  );

  public readonly filteredItems = computed(() => {
    const text = this.filterText().toLowerCase();
    return (this.items() ?? []).filter((item) => item.label.toLowerCase().includes(text));
  });

  constructor() {
    effect(() => {
      const next = this.items() ?? [];
      const validKeys = new Set(next.map((i) => i.key));
      for (const key of this.activeKeys()) {
        if (!validKeys.has(key)) {
          this.itemSelected.emit(key);
        }
      }
    });
  }

  public clearFilter(): void {
    this.filterCtrl.reset();
  }

  public onItemSelected(key: string): void {
    this.itemSelected.emit(key);
  }

  public isIconArray(icon: IconDefinition | IconDefinition[]): icon is IconDefinition[] {
    return Array.isArray(icon);
  }
}
