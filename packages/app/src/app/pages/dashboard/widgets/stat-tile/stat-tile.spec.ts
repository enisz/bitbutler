import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { StatTile } from './stat-tile';

describe('StatTile', () => {
  let fixture: ComponentFixture<StatTile>;
  let component: StatTile;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StatTile] }).compileComponents();
    fixture = TestBed.createComponent(StatTile);
    component = fixture.componentInstance;
  });

  it('should format download_speed as bytes/sec', () => {
    component.data = { metric: 'download_speed', value: 1024 };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('/s');
  });

  it('should format global_ratio with two decimals', () => {
    component.data = { metric: 'global_ratio', value: 2.3 };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('2.30');
  });

  it('should format session_ratio with two decimals', () => {
    component.data = { metric: 'session_ratio', value: 1.5 };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('1.50');
  });

  it('should format session_downloaded as bytes', () => {
    component.data = { metric: 'session_downloaded', value: 2048 };
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('/s');
  });

  it('should show "value of total" for active_count', () => {
    component.data = { metric: 'active_count', value: 18, total: 42 };
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('18');
    expect(text).toContain('42');
  });

  it('should format the 4 new server metrics via the catalog', () => {
    // Uses setInput (rather than a second `component.data = ...` assignment) for the second
    // update - under zoneless OnPush, a second plain-property mutation in the same test doesn't
    // notify the CD scheduler, so detectChanges() would silently no-op and re-check stale output.
    component.data = { metric: 'dht_nodes', value: 12 };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('12');

    fixture.componentRef.setInput('data', { metric: 'download_limit', value: 500 });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('/s');
  });

  it('should render a torrent-count tile using the field label and the raw key when there is no labelKey', () => {
    component.data = {
      source: 'torrent-count',
      field: 'category',
      key: 'linux',
      labelKey: undefined,
      value: 7,
    };
    TestBed.inject(TranslateService).setTranslation('en', {
      pages: { main: { grid: { 'grid-lib': { 'col-def': { category: 'Category' } } } } },
    });
    TestBed.inject(TranslateService).use('en');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Category');
    expect(text).toContain('linux');
    expect(text).toContain('7');
    expect(text).not.toContain('of'); // no total suffix for torrent-count mode
  });

  it('should render a torrent-count tile using the translated bucket label when one is present', () => {
    component.data = {
      source: 'torrent-count',
      field: 'ratio',
      key: 'lt-0-1',
      labelKey: 'pages.dashboard.widgets.breakdown.ratio.bucket.lt-0-1',
      value: 3,
    };
    TestBed.inject(TranslateService).setTranslation('en', {
      pages: {
        main: { grid: { 'grid-lib': { 'col-def': { ratio: 'Ratio' } } } },
        dashboard: { widgets: { breakdown: { ratio: { bucket: { 'lt-0-1': '< 0.1' } } } } },
      },
    });
    TestBed.inject(TranslateService).use('en');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('< 0.1');
  });

  // Regression coverage: the widget wires <app-widget-menu> identically across all three widget
  // types (always visible, configure/remove routed to onConfigure()/onRemove()) - a typo in any
  // one of them would currently ship green with no test catching it.
  describe('widget menu integration', () => {
    it('should show the widget menu and route configure/remove to onConfigure()/onRemove()', () => {
      component.data = { metric: 'download_speed', value: 1024 };
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
