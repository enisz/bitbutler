import { WIDGET_CATALOG } from './widget-catalog';

describe('WIDGET_CATALOG', () => {
  it('should have an entry for every WidgetTypeId', () => {
    expect(Object.keys(WIDGET_CATALOG).sort()).toEqual([
      'active-downloads',
      'bar-chart',
      'pie-chart',
      'stat-tile',
      'torrent-list',
    ]);
  });

  it('should map stat-tile to the StatTile component selector', () => {
    expect(WIDGET_CATALOG['stat-tile'].componentSelector).toBe('app-stat-tile');
  });

  it('should map torrent-list to the TorrentListWidget component selector', () => {
    expect(WIDGET_CATALOG['torrent-list'].componentSelector).toBe('app-torrent-list-widget');
  });

  it('should give torrent-list a sensible default config', () => {
    expect(WIDGET_CATALOG['torrent-list'].defaultConfig).toEqual({
      count: 5,
      sortField: 'name',
      sortOrder: 'asc',
      columns: ['name'],
    });
  });

  it('should map pie-chart to the PieChartWidget component selector with a sensible default config', () => {
    expect(WIDGET_CATALOG['pie-chart'].componentSelector).toBe('app-pie-chart-widget');
    expect(WIDGET_CATALOG['pie-chart'].defaultConfig).toEqual({ groupBy: 'state' });
    expect(WIDGET_CATALOG['pie-chart'].chartType).toBe('pie');
  });

  it('should map bar-chart to the BarChartWidget component selector with a sensible default config', () => {
    expect(WIDGET_CATALOG['bar-chart'].componentSelector).toBe('app-bar-chart-widget');
    expect(WIDGET_CATALOG['bar-chart'].defaultConfig).toEqual({ field: 'state' });
    expect(WIDGET_CATALOG['bar-chart'].chartType).toBe('column');
  });

  it('should map active-downloads to the ActiveDownloadsWidget component selector with a sensible default config', () => {
    expect(WIDGET_CATALOG['active-downloads'].componentSelector).toBe(
      'app-active-downloads-widget',
    );
    expect(WIDGET_CATALOG['active-downloads'].defaultConfig).toEqual({ count: 5 });
  });

  it('should give every entry an icon, a chart type and a category', () => {
    for (const entry of Object.values(WIDGET_CATALOG)) {
      expect(entry.icon).toBeTruthy();
      expect(entry.chartType).toBeTruthy();
      expect(entry.category).toBeTruthy();
    }
  });
});
