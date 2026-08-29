import { WIDGET_CATALOG } from './widget-catalog';

describe('WIDGET_CATALOG', () => {
  it('should have an entry for every WidgetTypeId', () => {
    expect(Object.keys(WIDGET_CATALOG).sort()).toEqual(['pie-chart', 'stat-tile', 'torrent-list']);
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
      sortField: 'ratio',
      sortOrder: 'desc',
      columns: ['name', 'ratio'],
    });
  });

  it('should give every entry an icon and a description key', () => {
    for (const entry of Object.values(WIDGET_CATALOG)) {
      expect(entry.icon).toBeTruthy();
      expect(entry.descriptionKey).toMatch(/^pages\.dashboard\.catalog-type\./);
    }
  });
});
