import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faChartColumn,
  faChartLine,
  faChartPie,
  faChevronRight,
  faHashtag,
  faMagnifyingGlass,
  faTable,
} from '@fortawesome/free-solid-svg-icons';
import { NgbActiveOffcanvas, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { WidgetChartType, WidgetTypeId } from '../../models/dashboard.model';
import { WIDGET_CATALOG, WidgetCatalogMeta } from '../../pages/dashboard/widget-catalog';

interface WidgetCategoryView {
  id: string;
  labelKey: string;
  items: WidgetCatalogMeta[];
  expanded: boolean;
}

@Component({
  selector: 'app-widget-picker',
  standalone: true,
  imports: [TranslatePipe, FontAwesomeModule, NgbTooltipModule, FormsModule],
  templateUrl: './widget-picker.html',
  styleUrl: './widget-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetPicker {
  private readonly activeOffcanvas = inject(NgbActiveOffcanvas);
  private readonly translate = inject(TranslateService);

  readonly icon = { faMagnifyingGlass, faChevronRight };
  readonly chartTypeFilters: { type: WidgetChartType; icon: IconDefinition }[] = [
    { type: 'number', icon: faHashtag },
    { type: 'pie', icon: faChartPie },
    { type: 'line', icon: faChartLine },
    { type: 'column', icon: faChartColumn },
    { type: 'table', icon: faTable },
  ];

  readonly query = signal('');
  readonly activeFilter = signal<WidgetChartType | 'all'>('all');
  private readonly collapsedCategories = signal<Set<string>>(new Set());

  // Re-evaluated on language change so a search match against the translated widget label stays
  // correct after a runtime language switch - `languageChanged()` itself is unused beyond
  // registering TranslateService.onLangChange as a reactive dependency of this computed.
  private readonly languageChanged = toSignal(this.translate.onLangChange);

  private readonly matches = computed<Map<string, WidgetCatalogMeta[]>>(() => {
    this.languageChanged();
    const q = this.query().trim().toLowerCase();
    const filter = this.activeFilter();
    const byCategory = new Map<string, WidgetCatalogMeta[]>();

    for (const meta of Object.values(WIDGET_CATALOG)) {
      if (filter !== 'all' && meta.chartType !== filter) continue;
      if (q && !this.translate.instant(meta.labelKey).toLowerCase().includes(q)) continue;

      const list = byCategory.get(meta.category) ?? [];
      list.push(meta);
      byCategory.set(meta.category, list);
    }

    return byCategory;
  });

  readonly categories = computed<WidgetCategoryView[]>(() => {
    const hasQuery = this.query().trim().length > 0;
    const collapsed = this.collapsedCategories();

    return Array.from(this.matches().entries()).map(([id, items]) => ({
      id,
      labelKey: `pages.dashboard.category.${id}`,
      items,
      expanded: hasQuery || !collapsed.has(id),
    }));
  });

  readonly isEmpty = computed(() => this.matches().size === 0);

  onQueryChange(value: string): void {
    this.query.set(value);
  }

  setFilter(type: WidgetChartType | 'all'): void {
    this.activeFilter.set(type);
  }

  toggleCategory(id: string): void {
    this.collapsedCategories.update((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  choose(widgetTypeId: WidgetTypeId): void {
    this.activeOffcanvas.close(widgetTypeId);
  }

  cancel(): void {
    this.activeOffcanvas.dismiss();
  }
}
