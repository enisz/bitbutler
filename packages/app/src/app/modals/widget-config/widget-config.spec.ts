import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectComponent } from '@ng-select/ng-select';
import { TranslateService } from '@ngx-translate/core';
import { WidgetTypeId } from '../../models/dashboard.model';
import { Torrent } from '../../models/torrent.model';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { WidgetConfig } from './widget-config';

describe('WidgetConfig', () => {
  let component: WidgetConfig;
  let fixture: ComponentFixture<WidgetConfig>;
  let activeModalMock: { close: ReturnType<typeof vi.fn>; dismiss: ReturnType<typeof vi.fn> };
  let torrentStoreMock: { torrentsArray: ReturnType<typeof signal<Torrent[]>> };

  beforeEach(async () => {
    activeModalMock = { close: vi.fn(), dismiss: vi.fn() };
    torrentStoreMock = { torrentsArray: signal<Torrent[]>([]) };
    await TestBed.configureTestingModule({
      imports: [WidgetConfig],
      providers: [
        { provide: NgbActiveModal, useValue: activeModalMock },
        { provide: TorrentStoreService, useValue: torrentStoreMock },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(WidgetConfig);
    component = fixture.componentInstance;
    TestBed.inject(TranslateService).setTranslation('en', {
      pages: {
        dashboard: { widgets: { 'stat-tile': { metric: { download_speed: 'Download Speed' } } } },
      },
    });
    TestBed.inject(TranslateService).use('en');
  });

  function withInputs(widgetTypeId: WidgetTypeId, initialConfig: unknown): void {
    fixture.componentRef.setInput('widgetTypeId', widgetTypeId);
    fixture.componentRef.setInput('initialConfig', initialConfig);
    fixture.detectChanges();
  }

  it('should seed config from initialConfig for a stat-tile', () => {
    withInputs('stat-tile', { metric: 'download_speed' });
    expect(component.config()).toEqual({ metric: 'download_speed' });
  });

  it('should render the translated metric label in the ng-select, not the raw enum value', async () => {
    withInputs('stat-tile', { metric: 'download_speed' });
    await fixture.whenStable();
    fixture.detectChanges();
    const value = fixture.nativeElement.querySelector('#widget-config-metric .ng-value');
    expect(value.textContent.trim()).toBe('Download Speed');
  });

  it('should update the metric for a stat-tile', () => {
    withInputs('stat-tile', { metric: 'download_speed' });
    component.updateStatTileMetric('global_ratio');
    expect(component.config()).toEqual({ metric: 'global_ratio' });
  });

  it('should update a single torrent-list field without disturbing the others', () => {
    withInputs('torrent-list', {
      count: 5,
      sortField: 'ratio',
      sortOrder: 'desc',
      columns: ['name'],
    });
    component.updateTorrentListField('count', 10);
    expect(component.config()).toEqual({
      count: 10,
      sortField: 'ratio',
      sortOrder: 'desc',
      columns: ['name'],
    });
  });

  it('should update the torrent-list title via updateTorrentListField', () => {
    withInputs('torrent-list', {
      count: 5,
      sortField: 'ratio',
      sortOrder: 'desc',
      columns: ['name'],
    });
    component.updateTorrentListField('title', 'Top Seeders');
    expect((component.config() as any).title).toBe('Top Seeders');
  });

  it('should offer every Torrent field as a sort/column option', () => {
    const values = component.torrentFieldOptions.map((o) => o.value);
    expect(values).toEqual(
      expect.arrayContaining([
        'seeding_time',
        'availability',
        'num_complete',
        'tracker',
        'auto_tmm',
      ]),
    );
    expect(values.length).toBeGreaterThan(40);
  });

  it('should sort torrentFieldOptions alphabetically by translated label', () => {
    const labels = component.torrentFieldOptions.map((o) => o.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });

  it('should render a title input bound to the torrent-list config', async () => {
    withInputs('torrent-list', {
      count: 5,
      sortField: 'ratio',
      sortOrder: 'desc',
      columns: ['name'],
      title: 'Top Seeders',
    });
    await fixture.whenStable();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#widget-config-title');
    expect(input.value).toBe('Top Seeders');
  });

  it('should update the columns list via updateTorrentListField', () => {
    withInputs('torrent-list', {
      count: 5,
      sortField: 'ratio',
      sortOrder: 'desc',
      columns: ['name'],
    });
    component.updateTorrentListField('columns', ['name', 'tracker']);
    expect((component.config() as any).columns).toEqual(['name', 'tracker']);
  });

  it('should render a multiselect ng-select for columns', async () => {
    withInputs('torrent-list', {
      count: 5,
      sortField: 'ratio',
      sortOrder: 'desc',
      columns: ['name'],
    });
    await fixture.whenStable();
    fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('#widget-config-columns');
    expect(select).toBeTruthy();
  });

  it('should clear the search box after picking a column, so the multiselect stays usable for the next pick', async () => {
    withInputs('torrent-list', {
      count: 5,
      sortField: 'ratio',
      sortOrder: 'desc',
      columns: ['name'],
    });
    await fixture.whenStable();
    fixture.detectChanges();
    const ngSelect = fixture.debugElement.query(By.css('#widget-config-columns'))
      .componentInstance as NgSelectComponent;
    expect(ngSelect.clearSearchOnAdd()).toBe(true);
  });

  it('should update sortField to the raw field value (not the {value,label} option object) when a selection is made in the UI', async () => {
    withInputs('torrent-list', {
      count: 5,
      sortField: 'ratio',
      sortOrder: 'desc',
      columns: ['name'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const ngSelect = fixture.debugElement.query(By.css('#widget-config-sort-field'))
      .componentInstance as NgSelectComponent;
    const option = ngSelect.itemsList.items.find((i) => i.value?.['value'] === 'size');
    ngSelect.select(option!);
    fixture.detectChanges();

    expect((component.config() as any).sortField).toBe('size');
  });

  it('should reflect the newly selected sortField back in the ng-select once chosen', async () => {
    withInputs('torrent-list', {
      count: 5,
      sortField: 'ratio',
      sortOrder: 'desc',
      columns: ['name'],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const ngSelect = fixture.debugElement.query(By.css('#widget-config-sort-field'))
      .componentInstance as NgSelectComponent;
    const option = ngSelect.itemsList.items.find((i) => i.value?.['value'] === 'size');
    ngSelect.select(option!);
    fixture.detectChanges();

    expect(ngSelect.selectedItems.map((i) => i.value?.['value'])).toEqual(['size']);
  });

  it('should close the modal with the current config on save', () => {
    withInputs('stat-tile', { metric: 'download_speed' });
    component.updateStatTileMetric('active_count');
    component.save();
    expect(activeModalMock.close).toHaveBeenCalledWith({ metric: 'active_count' });
  });

  it('should dismiss on cancel', () => {
    withInputs('stat-tile', { metric: 'download_speed' });
    component.cancel();
    expect(activeModalMock.dismiss).toHaveBeenCalled();
  });

  it('should seed config from initialConfig for a pie-chart', () => {
    withInputs('pie-chart', { groupBy: 'state' });
    expect(component.config()).toEqual({ groupBy: 'state' });
  });

  it('should update groupBy for a pie-chart', () => {
    withInputs('pie-chart', { groupBy: 'state' });
    component.updatePieChartGroupBy('category');
    expect(component.config()).toEqual({ groupBy: 'category' });
  });

  it('should render the widget type name in the header for every widget type', async () => {
    TestBed.inject(TranslateService).setTranslation('en', {
      pages: { dashboard: { catalog: { 'torrent-list': 'Torrent List' } } },
    });
    withInputs('torrent-list', {
      count: 5,
      sortField: 'name',
      sortOrder: 'asc',
      columns: ['name'],
      title: 'Top Seeders',
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Torrent List');
  });

  it('should always allow saving a stat-tile', () => {
    withInputs('stat-tile', { metric: 'download_speed' });
    expect(component.canSave()).toBe(true);
  });

  it('should always allow saving a pie-chart', () => {
    withInputs('pie-chart', { groupBy: 'state' });
    expect(component.canSave()).toBe(true);
  });

  it('should disallow saving a torrent-list when the title is blank', () => {
    withInputs('torrent-list', {
      count: 5,
      sortField: 'name',
      sortOrder: 'asc',
      columns: ['name'],
      title: '   ',
    });
    expect(component.canSave()).toBe(false);
  });

  it('should disallow saving a torrent-list when columns is empty', () => {
    withInputs('torrent-list', {
      count: 5,
      sortField: 'name',
      sortOrder: 'asc',
      columns: [],
      title: 'Top Seeders',
    });
    expect(component.canSave()).toBe(false);
  });

  it('should disallow saving a torrent-list when count is not a positive number', () => {
    withInputs('torrent-list', {
      count: 0,
      sortField: 'name',
      sortOrder: 'asc',
      columns: ['name'],
      title: 'Top Seeders',
    });
    expect(component.canSave()).toBe(false);
  });

  it('should allow saving a fully filled-out torrent-list config', () => {
    withInputs('torrent-list', {
      count: 5,
      sortField: 'name',
      sortOrder: 'asc',
      columns: ['name'],
      title: 'Top Seeders',
    });
    expect(component.canSave()).toBe(true);
  });

  it('should offer all 4 single-valued fields for a pie-chart', () => {
    withInputs('pie-chart', { groupBy: 'state' });
    expect(component.groupByOptions.sort()).toEqual(
      ['category', 'save_path', 'state', 'tracker'].sort(),
    );
  });

  it('should update groupBy to tracker for a pie-chart', () => {
    withInputs('pie-chart', { groupBy: 'state' });
    component.updatePieChartGroupBy('tracker');
    expect(component.config()).toEqual({ groupBy: 'tracker' });
  });

  it('should offer all 9 breakdown fields, grouped into categorical/numeric, for a bar-chart', () => {
    withInputs('bar-chart', { field: 'state' });
    const values = component.breakdownFieldOptions.map((o) => o.value);
    expect(values.sort()).toEqual(
      [
        'state',
        'category',
        'tracker',
        'save_path',
        'tags',
        'ratio',
        'progress',
        'size',
        'eta',
      ].sort(),
    );
    const ratioOption = component.breakdownFieldOptions.find((o) => o.value === 'ratio')!;
    const categoryOption = component.breakdownFieldOptions.find((o) => o.value === 'category')!;
    expect(ratioOption.group).not.toBe(categoryOption.group);
  });

  it('should seed config from initialConfig for a bar-chart', () => {
    withInputs('bar-chart', { field: 'category' });
    expect(component.config()).toEqual({ field: 'category' });
  });

  it('should update the field for a bar-chart', () => {
    withInputs('bar-chart', { field: 'state' });
    component.updateBarChartField('ratio');
    expect(component.config()).toEqual({ field: 'ratio' });
  });

  it('should always allow saving a bar-chart', () => {
    withInputs('bar-chart', { field: 'state' });
    expect(component.canSave()).toBe(true);
  });

  it('should default to "metric" source for a plain metric config', () => {
    withInputs('stat-tile', { metric: 'download_speed' });
    expect(component.statTileSource()).toBe('metric');
  });

  it('should report "torrent-count" source for a torrent-count config', () => {
    withInputs('stat-tile', { source: 'torrent-count', field: 'category', value: 'linux' });
    expect(component.statTileSource()).toBe('torrent-count');
  });

  it('should switch to torrent-count mode with the first available state value', () => {
    torrentStoreMock.torrentsArray.set([{ state: 'downloading' } as Torrent]);
    withInputs('stat-tile', { metric: 'download_speed' });
    component.updateStatTileSource('torrent-count');
    expect(component.config()).toEqual({
      source: 'torrent-count',
      field: 'state',
      value: 'downloading',
    });
  });

  it('should switch back to metric mode with a sensible default', () => {
    withInputs('stat-tile', { source: 'torrent-count', field: 'category', value: 'linux' });
    component.updateStatTileSource('metric');
    expect(component.config()).toEqual({ metric: 'download_speed' });
  });

  it('should update the torrent-count field and reset value to the first available option', () => {
    torrentStoreMock.torrentsArray.set([
      { category: 'linux' } as Torrent,
      { category: 'games' } as Torrent,
    ]);
    withInputs('stat-tile', { source: 'torrent-count', field: 'state', value: 'downloading' });
    component.updateTorrentCountField('category');
    const config = component.config() as any;
    expect(config.field).toBe('category');
    expect(['linux', 'games']).toContain(config.value);
  });

  it('should update the torrent-count value without changing the field', () => {
    withInputs('stat-tile', { source: 'torrent-count', field: 'category', value: 'linux' });
    component.updateTorrentCountValue('games');
    expect(component.config()).toEqual({
      source: 'torrent-count',
      field: 'category',
      value: 'games',
    });
  });

  it('should list live torrentCountValueOptions for the currently selected field', () => {
    torrentStoreMock.torrentsArray.set([
      { category: 'linux' } as Torrent,
      { category: 'linux' } as Torrent,
      { category: 'games' } as Torrent,
    ]);
    withInputs('stat-tile', { source: 'torrent-count', field: 'category', value: 'linux' });
    const values = component.torrentCountValueOptions().map((o) => o.value);
    expect(values.sort()).toEqual(['games', 'linux']);
  });

  it('should disallow saving a torrent-count stat-tile with an empty value', () => {
    withInputs('stat-tile', { source: 'torrent-count', field: 'category', value: '' });
    expect(component.canSave()).toBe(false);
  });

  it('should allow saving a torrent-count stat-tile with a value set', () => {
    withInputs('stat-tile', { source: 'torrent-count', field: 'category', value: 'linux' });
    expect(component.canSave()).toBe(true);
  });
});
