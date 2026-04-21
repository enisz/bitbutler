import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
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
    CommonModule,
    FontAwesomeModule,
    FormsModule,
    ReactiveFormsModule,
    NgbTooltip,
    TranslatePipe,
    TooltipOverflow,
  ],
  templateUrl: './filter-group.html',
  styleUrl: './filter-group.scss',
})
export class FilterGroupComponent implements OnInit, OnChanges {
  @Input({ required: true }) label!: string;

  private readonly items$ = new BehaviorSubject<FilterItem[]>([]);
  @Input()
  set items(value: FilterItem[] | null) {
    this.items$.next(value ?? []);
  }

  get items(): FilterItem[] {
    return this.items$.value;
  }

  @Input({ required: true }) activeKey!: string;
  @Input() showAll = true;
  @Input({ required: true }) showAllCount!: number;

  @Output() itemSelected = new EventEmitter<string>();

  public filterCtrl = new FormControl('', { nonNullable: true });
  public filteredItems$!: Observable<FilterItem[]>;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items']) {
      const next: FilterItem[] = changes['items'].currentValue ?? [];
      if (
        this.activeKey &&
        this.activeKey !== 'all' &&
        !next.some((i) => i.key === this.activeKey)
      ) {
        this.itemSelected.emit('all');
      }
    }
  }

  ngOnInit(): void {
    this.filteredItems$ = combineLatest([
      this.items$,
      this.filterCtrl.valueChanges.pipe(startWith('')),
    ]).pipe(
      map(([items, filterText]) =>
        items.filter((item) => item.label.toLowerCase().includes(filterText.toLowerCase())),
      ),
    );
  }

  public onItemSelected(key: string): void {
    this.itemSelected.emit(key);
  }

  public isIconArray(icon: IconDefinition | IconDefinition[]): icon is IconDefinition[] {
    return Array.isArray(icon);
  }
}
