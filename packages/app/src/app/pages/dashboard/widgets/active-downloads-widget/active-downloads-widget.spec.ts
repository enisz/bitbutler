import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ActiveDownloadsData } from '../../../../models/dashboard.model';
import { Torrent } from '../../../../models/torrent.model';
import { CommandBusService } from '../../../../services/command-bus.service';
import { ActiveDownloadsWidget } from './active-downloads-widget';

const makeTorrent = (overrides: Partial<Torrent> = {}): Torrent =>
  ({
    hash: 'h1',
    name: 'ubuntu-24.04.2-desktop-amd64.iso',
    state: 'downloading',
    progress: 0.72,
    dlspeed: 6_500_000,
    eta: 240,
    ...overrides,
  }) as Torrent;

const makeData = (rows: Torrent[] = [makeTorrent()]): ActiveDownloadsData => ({ rows });

describe('ActiveDownloadsWidget', () => {
  let fixture: ComponentFixture<ActiveDownloadsWidget>;
  let component: ActiveDownloadsWidget;
  let commandBusMock: { emit: ReturnType<typeof vi.fn> };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    commandBusMock = { emit: vi.fn() };
    routerMock = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ActiveDownloadsWidget],
      providers: [
        { provide: CommandBusService, useValue: commandBusMock },
        { provide: Router, useValue: routerMock },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ActiveDownloadsWidget);
    component = fixture.componentInstance;
    TestBed.inject(TranslateService).setTranslation('en', {
      pages: {
        dashboard: {
          catalog: { 'active-downloads': 'Active Downloads' },
          widgets: { 'active-downloads': { idle: 'Idle', empty: 'No active downloads' } },
        },
      },
      general: { button: { 'view-all': 'View All' } },
    });
    TestBed.inject(TranslateService).use('en');
  });

  describe('speedLabel', () => {
    it('should format a positive download speed as bytes/sec', () => {
      component.data = makeData([makeTorrent({ dlspeed: 1024 })]);
      expect(component.speedLabel(component.data.rows[0])).toContain('/s');
    });

    it('should return null for a zero download speed', () => {
      component.data = makeData([makeTorrent({ dlspeed: 0 })]);
      expect(component.speedLabel(component.data.rows[0])).toBeNull();
    });
  });

  describe('percentLabel', () => {
    it('should round to the nearest whole percent', () => {
      expect(component.percentLabel(makeTorrent({ progress: 0.724 }))).toBe('72%');
      expect(component.percentLabel(makeTorrent({ progress: 0.041 }))).toBe('4%');
    });
  });

  describe('etaLabel', () => {
    it('should format a known eta as a single compact segment', () => {
      expect(component.etaLabel(makeTorrent({ eta: 240 }))).toBe('4m');
      expect(component.etaLabel(makeTorrent({ eta: 3600 }))).toBe('1h');
    });

    it('should show a dash for the qBittorrent "unknown eta" sentinel', () => {
      expect(component.etaLabel(makeTorrent({ eta: 8_640_000 }))).toBe('—');
    });
  });

  describe('rendering', () => {
    it('should show the translated catalog title in the header', () => {
      component.data = makeData();
      fixture.detectChanges();
      const title = fixture.nativeElement.querySelector('.active-downloads-widget__title');
      expect(title.textContent.trim()).toBe('Active Downloads');
    });

    it('should render one row per torrent with its name and a compact progress bar', () => {
      component.data = makeData([
        makeTorrent({ hash: 'a', name: 'ubuntu.iso' }),
        makeTorrent({ hash: 'b', name: 'debian.iso' }),
      ]);
      fixture.detectChanges();

      const rows = fixture.nativeElement.querySelectorAll('.active-downloads-widget__row');
      expect(rows.length).toBe(2);
      expect(rows[0].textContent).toContain('ubuntu.iso');
      expect(rows[0].querySelector('app-bb-progress')).toBeTruthy();
    });

    it('should show "Idle" instead of a speed for a zero-speed row', () => {
      component.data = makeData([makeTorrent({ dlspeed: 0 })]);
      fixture.detectChanges();
      const row = fixture.nativeElement.querySelector('.active-downloads-widget__row');
      expect(row.textContent).toContain('Idle');
    });

    it('should show the empty-state message when there are no rows', () => {
      component.data = makeData([]);
      fixture.detectChanges();
      const empty = fixture.nativeElement.querySelector('.active-downloads-widget__empty');
      expect(empty.textContent.trim()).toBe('No active downloads');
      expect(fixture.nativeElement.querySelector('.active-downloads-widget__row')).toBeFalsy();
    });
  });

  describe('interactions', () => {
    it('should open the torrent details modal via the command bus when a row is clicked', () => {
      component.data = makeData([makeTorrent({ hash: 'abc123' })]);
      fixture.detectChanges();

      fixture.nativeElement.querySelector('.active-downloads-widget__row').click();

      expect(commandBusMock.emit).toHaveBeenCalledWith({
        type: 'UI_OPEN_TORRENT_DETAILS',
        hash: 'abc123',
      });
    });

    it('should navigate to the main torrent list when "View all" is clicked', () => {
      component.data = makeData();
      fixture.detectChanges();

      fixture.nativeElement.querySelector('.active-downloads-widget__view-all').click();

      expect(routerMock.navigate).toHaveBeenCalledWith(['/pages/torrent-list']);
    });
  });

  // Regression coverage: the widget wires <app-widget-menu> identically across all widget types
  // (always visible, configure/remove routed to onConfigure()/onRemove()).
  describe('widget menu integration', () => {
    it('should show the widget menu and route configure/remove to onConfigure()/onRemove()', () => {
      component.data = makeData([]);
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
