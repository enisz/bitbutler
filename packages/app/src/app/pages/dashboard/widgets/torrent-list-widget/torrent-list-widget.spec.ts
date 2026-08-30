import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TorrentListRow } from '../../../../models/dashboard.model';
import { TorrentListWidget } from './torrent-list-widget';

const row: TorrentListRow = {
  hash: 'h1',
  name: 'Ubuntu ISO',
  state: 'downloading',
  category: 'linux',
  ratio: 1.5,
  dlspeed: 1024,
  upspeed: 512,
  size: 1073741824,
  progress: 0.5,
  added_on: 0,
  eta: 60,
};

describe('TorrentListWidget', () => {
  let fixture: ComponentFixture<TorrentListWidget>;
  let component: TorrentListWidget;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TorrentListWidget] }).compileComponents();
    fixture = TestBed.createComponent(TorrentListWidget);
    component = fixture.componentInstance;
  });

  describe('formattedValue', () => {
    it('should format ratio with two decimals', () => {
      expect(component.formattedValue(row, 'ratio')).toBe('1.50');
    });

    it('should format dlspeed and upspeed as bytes/sec', () => {
      expect(component.formattedValue(row, 'dlspeed')).toContain('/s');
      expect(component.formattedValue(row, 'upspeed')).toContain('/s');
    });

    it('should format progress as a whole percentage', () => {
      expect(component.formattedValue(row, 'progress')).toBe('50%');
    });

    it('should pass name and state through unchanged', () => {
      expect(component.formattedValue(row, 'name')).toBe('Ubuntu ISO');
      expect(component.formattedValue(row, 'state')).toBe('downloading');
    });

    it('should show a dash for an empty category', () => {
      expect(component.formattedValue({ ...row, category: '' }, 'category')).toBe('-');
    });
  });

  it('should render one row per data.rows entry with the configured columns', () => {
    component.data = { columns: ['name', 'ratio'], rows: [row] };
    fixture.detectChanges();
    const cells = fixture.nativeElement.querySelectorAll('td');
    expect(cells.length).toBe(2);
    expect(cells[0].textContent).toContain('Ubuntu ISO');
    expect(cells[1].textContent).toContain('1.50');

    const scrollHost = fixture.nativeElement.querySelector('.torrent-list-widget__scroll');
    expect(scrollHost).toBeTruthy();
    expect(fixture.nativeElement.querySelector('table').classList).toContain(
      'torrent-list-widget__table',
    );
  });

  // Regression coverage: the widget wires <app-widget-menu> identically across all three widget
  // types (always visible, configure/remove routed to onConfigure()/onRemove()) - a typo in any
  // one of them would currently ship green with no test catching it.
  describe('widget menu integration', () => {
    it('should show the widget menu and route configure/remove to onConfigure()/onRemove()', () => {
      component.data = { columns: ['name'], rows: [row] };
      component.onConfigure = vi.fn();
      component.onRemove = vi.fn();
      fixture.detectChanges();

      const menu = fixture.nativeElement.querySelector('.widget-menu');
      expect(menu).toBeTruthy();

      menu.querySelector('[data-test="widget-menu-configure"]').click();
      expect(component.onConfigure).toHaveBeenCalled();

      menu.querySelector('[data-test="widget-menu-remove"]').click();
      expect(component.onRemove).toHaveBeenCalled();
    });
  });
});
