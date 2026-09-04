import { WIDGET_CATALOG } from './widget-catalog';

describe('WIDGET_CATALOG', () => {
  it('should have an entry for every WidgetTypeId', () => {
    expect(Object.keys(WIDGET_CATALOG).sort()).toEqual([
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

  it('should give every entry an icon, a chart type and a category', () => {
    for (const entry of Object.values(WIDGET_CATALOG)) {
      expect(entry.icon).toBeTruthy();
      expect(entry.chartType).toBeTruthy();
      expect(entry.category).toBeTruthy();
    }
  });
});
