import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
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
  });

  function withInputs(widgetTypeId: 'stat-tile' | 'torrent-list', initialConfig: unknown): void {
    fixture.componentRef.setInput('widgetTypeId', widgetTypeId);
    fixture.componentRef.setInput('initialConfig', initialConfig);
    fixture.detectChanges();
  }

  it('should seed config from initialConfig for a stat-tile', () => {
    withInputs('stat-tile', { metric: 'download_speed' });
    expect(component.config()).toEqual({ metric: 'download_speed' });
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

  it('should add and remove a column via toggleColumn', () => {
    withInputs('torrent-list', {
      count: 5,
      sortField: 'ratio',
      sortOrder: 'desc',
      columns: ['name'],
    });
    component.toggleColumn('ratio');
    expect((component.config() as any).columns).toEqual(['name', 'ratio']);
    component.toggleColumn('name');
    expect((component.config() as any).columns).toEqual(['ratio']);
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
});
