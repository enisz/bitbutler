import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faChartColumn,
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

interface WidgetTypeGroupView {
  id: WidgetChartType;
  labelKey: string;
  items: WidgetCatalogMeta[];
  expanded: boolean;
}

@Component({
  selector: 'app-widget-picker',
  standalone: true,
  imports: [TranslatePipe, FontAwesomeModule, NgbTooltipModule, FormsModule, NgTemplateOutlet],
  templateUrl: './widget-picker.html',
  styleUrl: './widget-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetPicker {
  private readonly activeOffcanvas = inject(NgbActiveOffcanvas);
  private readonly translate = inject(TranslateService);

  readonly icon = { faMagnifyingGlass, faChevronRight };
  // No catalog entry uses chartType 'line' yet - its filter tab would just be a dead end that
  // always renders the empty state, so it's left out until a line-chart widget exists.
  readonly chartTypeFilters: { type: WidgetChartType; icon: IconDefinition }[] = [
    { type: 'number', icon: faHashtag },
    { type: 'pie', icon: faChartPie },
    { type: 'column', icon: faChartColumn },
    { type: 'table', icon: faTable },
  ];

  readonly query = signal('');
  readonly activeFilter = signal<WidgetChartType | 'all'>('all');
  private readonly collapsedTypeGroups = signal<Set<WidgetChartType>>(new Set());

  // Re-evaluated on language change so a search match against the translated widget label stays
  // correct after a runtime language switch - `languageChanged()` itself is unused beyond
  // registering TranslateService.onLangChange as a reactive dependency of this computed.
  private readonly languageChanged = toSignal(this.translate.onLangChange);

  // Grouped by chart type rather than a catalog "category" field (every entry used to share the
  // single 'transfers' value, so that field added a level of grouping without adding any actual
  // information) - the chart-type filter row above doubles as this grouping's own labels, so
  // switching to it removes a whole redundant field from WidgetCatalogMeta.
  private readonly matches = computed<Map<WidgetChartType, WidgetCatalogMeta[]>>(() => {
    this.languageChanged();
    const q = this.query().trim().toLowerCase();
    const filter = this.activeFilter();
    const byType = new Map<WidgetChartType, WidgetCatalogMeta[]>();

    for (const meta of Object.values(WIDGET_CATALOG)) {
      if (filter !== 'all' && meta.chartType !== filter) continue;
      if (q && !this.translate.instant(meta.labelKey).toLowerCase().includes(q)) continue;

      const list = byType.get(meta.chartType) ?? [];
      list.push(meta);
      byType.set(meta.chartType, list);
    }

    return byType;
  });

  readonly typeGroups = computed<WidgetTypeGroupView[]>(() => {
    const hasQuery = this.query().trim().length > 0;
    const collapsed = this.collapsedTypeGroups();

    return Array.from(this.matches().entries()).map(([id, items]) => ({
      id,
      labelKey: `pages.dashboard.chart-type.${id}`,
      items,
      expanded: hasQuery || !collapsed.has(id),
    }));
  });

  // With a specific chart-type filter active, every match already shares that one type, so the
  // accordion grouping (and its now-redundant single header) is dropped in favor of a plain list.
  readonly flatItems = computed<WidgetCatalogMeta[]>(() =>
    Array.from(this.matches().values()).flat(),
  );

  readonly isEmpty = computed(() => this.matches().size === 0);

  onQueryChange(value: string): void {
    this.query.set(value);
  }

  setFilter(type: WidgetChartType | 'all'): void {
    this.activeFilter.set(type);
  }

  toggleTypeGroup(id: WidgetChartType): void {
    this.collapsedTypeGroups.update((current) => {
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
