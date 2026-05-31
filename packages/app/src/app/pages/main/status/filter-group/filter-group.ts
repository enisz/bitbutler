import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { IconDefinition, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { startWith } from 'rxjs/operators';
import { TooltipOverflow } from '../../../../directives/tooltip-overflow';

export interface FilterItem {
  key: string;
  label: string;
  count: number;
  icon?: IconDefinition | IconDefinition[];
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
  readonly activeKey = input.required<string>();
  readonly showAll = input(true);
  readonly showAllCount = input.required<number>();

  readonly itemSelected = output<string>();

  public readonly icons = { faXmark };
  public filterCtrl = new FormControl('', { nonNullable: true });

  private readonly filterText = toSignal(this.filterCtrl.valueChanges.pipe(startWith('')), {
    initialValue: '',
  });

  public readonly filteredItems = computed(() => {
    const text = this.filterText().toLowerCase();
    return (this.items() ?? []).filter((item) => item.label.toLowerCase().includes(text));
  });

  constructor() {
    effect(() => {
      const next = this.items() ?? [];
      const key = this.activeKey();
      if (key && key !== 'all' && !next.some((i) => i.key === key)) {
        this.itemSelected.emit('all');
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
