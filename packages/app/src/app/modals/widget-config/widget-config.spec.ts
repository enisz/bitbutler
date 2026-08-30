import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectComponent } from '@ng-select/ng-select';
import { TranslateService } from '@ngx-translate/core';
import { WidgetTypeId } from '../../models/dashboard.model';
import { WidgetConfig } from './widget-config';

describe('WidgetConfig', () => {
  let component: WidgetConfig;
  let fixture: ComponentFixture<WidgetConfig>;
  let activeModalMock: { close: ReturnType<typeof vi.fn>; dismiss: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    activeModalMock = { close: vi.fn(), dismiss: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [WidgetConfig],
      providers: [{ provide: NgbActiveModal, useValue: activeModalMock }],
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
    const value = fixture.nativeElement.querySelector('.ng-value');
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
});
