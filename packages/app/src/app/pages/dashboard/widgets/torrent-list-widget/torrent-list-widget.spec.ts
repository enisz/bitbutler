import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { TorrentListData } from '../../../../models/dashboard.model';
import { Torrent } from '../../../../models/torrent.model';
import { HumanizeDurationPipe } from '../../../../pipes/humanize-duration-pipe';
import { TorrentListWidget } from './torrent-list-widget';

const row: Torrent = {
  added_on: 1700000000,
  amount_left: 0,
  auto_tmm: true,
  availability: 1.2346,
  category: 'linux',
  completed: 0,
  completion_on: 1700003600,
  content_path: '',
  dl_limit: 0,
  dlspeed: 1024,
  download_path: '',
  downloaded: 0,
  downloaded_session: 0,
  eta: 60,
  f_l_piece_prio: false,
  force_start: false,
  hash: 'h1',
  inactive_seeding_time_limit: 0,
  infohash_v1: '',
  infohash_v2: '',
  last_activity: 0,
  magnet_uri: '',
  max_inactive_seeding_time: 0,
  max_ratio: 0,
  max_seeding_time: 0,
  name: 'Ubuntu ISO',
  num_complete: 168,
  num_incomplete: 0,
  num_leechs: 0,
  num_seeds: 0,
  priority: 0,
  progress: 0.5,
  ratio: 1.5,
  ratio_limit: 0,
  save_path: '',
  seeding_time: 3661,
  seeding_time_limit: 0,
  seen_complete: 0,
  seq_dl: false,
  size: 1073741824,
  state: 'downloading',
  super_seeding: false,
  tags: '',
  time_active: 0,
  total_size: 0,
  tracker: '',
  trackers_count: 3,
  up_limit: 0,
  uploaded: 0,
  uploaded_session: 0,
  upspeed: 512,
};

const makeData = (overrides: Partial<TorrentListData> = {}): TorrentListData => ({
  columns: ['name'],
  rows: [row],
  sortField: 'name',
  sortOrder: 'asc',
  ...overrides,
});

describe('TorrentListWidget', () => {
  let fixture: ComponentFixture<TorrentListWidget>;
  let component: TorrentListWidget;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TorrentListWidget] }).compileComponents();
    fixture = TestBed.createComponent(TorrentListWidget);
    component = fixture.componentInstance;
    TestBed.inject(TranslateService).setTranslation('en', {
      pages: { dashboard: { catalog: { 'torrent-list': 'Torrent List' } } },
      components: { 'column-filters': { boolean: { true: 'True', false: 'False' } } },
    });
    TestBed.inject(TranslateService).use('en');
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

    it('should show a dash for an empty string field', () => {
      expect(component.formattedValue({ ...row, category: '' }, 'category')).toBe('-');
      expect(component.formattedValue(row, 'tracker')).toBe('-');
    });

    it('should format seeding_time the same way eta is formatted (humanized duration)', () => {
      const humanizeDurationPipe = TestBed.inject(HumanizeDurationPipe);
      expect(component.formattedValue(row, 'seeding_time')).toBe(
        humanizeDurationPipe.transform(row.seeding_time * 1000, 'short', 2),
      );
    });

    it('should format availability with three decimals', () => {
      expect(component.formattedValue(row, 'availability')).toBe('1.235');
    });

    it('should pass num_complete through as a plain integer', () => {
      expect(component.formattedValue(row, 'num_complete')).toBe('168');
    });

    it('should format a boolean field via the translated true/false labels', () => {
      expect(component.formattedValue(row, 'auto_tmm')).toBe('True');
      expect(component.formattedValue({ ...row, auto_tmm: false }, 'auto_tmm')).toBe('False');
    });

    it('should format a timestamp field as a localized date, dashing out a non-positive value', () => {
      expect(component.formattedValue(row, 'completion_on')).toBe(
        new Date(row.completion_on * 1000).toLocaleDateString(),
      );
      expect(component.formattedValue({ ...row, completion_on: -1 }, 'completion_on')).toBe('-');
    });
  });

  describe('title header', () => {
    it('should show the translated default catalog label when no title is configured', () => {
      component.data = makeData();
      fixture.detectChanges();
      const header = fixture.nativeElement.querySelector('.torrent-list-widget__title');
      expect(header.textContent.trim()).toBe('Torrent List');
    });

    it('should show the raw configured title instead of the translated default', () => {
      component.data = makeData({ title: 'Top Seeders' });
      fixture.detectChanges();
      const header = fixture.nativeElement.querySelector('.torrent-list-widget__title');
      expect(header.textContent.trim()).toBe('Top Seeders');
    });
  });

  it('should render one row per data.rows entry with the configured columns', () => {
    component.data = makeData({ columns: ['name', 'ratio'] });
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

  describe('isRightAligned', () => {
    it('should right-align non-string field types', () => {
      expect(component.isRightAligned('ratio')).toBe(true);
      expect(component.isRightAligned('size')).toBe(true);
      expect(component.isRightAligned('num_complete')).toBe(true);
      expect(component.isRightAligned('progress')).toBe(true);
    });

    it('should left-align string and state field types', () => {
      expect(component.isRightAligned('name')).toBe(false);
      expect(component.isRightAligned('category')).toBe(false);
      expect(component.isRightAligned('state')).toBe(false);
    });
  });

  describe('column alignment in the rendered table', () => {
    it('should apply text-end only to non-name header/data cells', () => {
      component.data = makeData({ columns: ['name', 'ratio'] });
      fixture.detectChanges();
      const headers = fixture.nativeElement.querySelectorAll('th');
      const cells = fixture.nativeElement.querySelectorAll('td');
      expect(headers[0].classList).not.toContain('text-end');
      expect(headers[1].classList).toContain('text-end');
      expect(cells[0].classList).not.toContain('text-end');
      expect(cells[1].classList).toContain('text-end');
    });
  });

  describe('subtitleColumns', () => {
    it('should exclude the name column, preserving the rest in order', () => {
      component.data = makeData({ columns: ['name', 'size', 'ratio'] });
      expect(component.subtitleColumns()).toEqual(['size', 'ratio']);
    });

    it('should be empty when name is the only configured column', () => {
      component.data = makeData();
      expect(component.subtitleColumns()).toEqual([]);
    });
  });

  describe('isSortColumn', () => {
    it('should be true only for the configured sortField', () => {
      component.data = makeData({ columns: ['name', 'size', 'ratio'], sortField: 'ratio' });
      expect(component.isSortColumn('ratio')).toBe(true);
      expect(component.isSortColumn('size')).toBe(false);
    });
  });

  describe('sortIndicator', () => {
    it('should return an ascending arrow for asc and a descending arrow for desc', () => {
      component.data = makeData({ sortOrder: 'asc' });
      expect(component.sortIndicator()).toBe('▲');
      component.data = makeData({ sortOrder: 'desc' });
      expect(component.sortIndicator()).toBe('▼');
    });
  });

  describe('subtitle rendering', () => {
    it('should render a subtitle element listing the non-name columns', () => {
      component.data = makeData({ columns: ['name', 'size', 'ratio'] });
      fixture.detectChanges();
      const subtitle = fixture.nativeElement.querySelector('.torrent-list-widget__subtitle');
      expect(subtitle).toBeTruthy();
    });

    it('should mark the sorted column in the subtitle with the active class and a direction arrow', () => {
      component.data = makeData({
        columns: ['name', 'size', 'ratio'],
        sortField: 'ratio',
        sortOrder: 'desc',
      });
      fixture.detectChanges();
      const items = fixture.nativeElement.querySelectorAll('.torrent-list-widget__subtitle-item');
      const active = fixture.nativeElement.querySelector(
        '.torrent-list-widget__subtitle-item--active',
      );
      expect(items.length).toBe(2);
      expect(active).toBeTruthy();
      expect(active.textContent).toContain('▼');
      const sizeItem = Array.from(items as NodeListOf<HTMLElement>).find((el) =>
        el.textContent?.includes('col-def.size'),
      );
      expect(sizeItem?.classList).not.toContain('torrent-list-widget__subtitle-item--active');
    });

    it('should omit the subtitle element when there are no non-name columns', () => {
      component.data = makeData();
      fixture.detectChanges();
      const subtitle = fixture.nativeElement.querySelector('.torrent-list-widget__subtitle');
      expect(subtitle).toBeFalsy();
    });
  });

  // Regression coverage: the widget wires <app-widget-menu> identically across all three widget
  // types (always visible, configure/remove routed to onConfigure()/onRemove()) - a typo in any
  // one of them would currently ship green with no test catching it.
  describe('widget menu integration', () => {
    it('should show the widget menu and route configure/remove to onConfigure()/onRemove()', () => {
      component.data = makeData();
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
