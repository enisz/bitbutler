import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { WidgetPicker } from './widget-picker';

describe('WidgetPicker', () => {
  let component: WidgetPicker;
  let fixture: ComponentFixture<WidgetPicker>;
  let activeOffcanvasMock: { close: ReturnType<typeof vi.fn>; dismiss: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    activeOffcanvasMock = { close: vi.fn(), dismiss: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [WidgetPicker],
      providers: [{ provide: NgbActiveOffcanvas, useValue: activeOffcanvasMock }],
    }).compileComponents();
    fixture = TestBed.createComponent(WidgetPicker);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should list every catalog entry', () => {
    expect(component.catalogEntries.map((e) => e.id).sort()).toEqual([
      'pie-chart',
      'stat-tile',
      'torrent-list',
    ]);
  });

  it('should close the offcanvas with the chosen widget type id', () => {
    component.choose('stat-tile');
    expect(activeOffcanvasMock.close).toHaveBeenCalledWith('stat-tile');
  });

  it('should dismiss on cancel', () => {
    component.cancel();
    expect(activeOffcanvasMock.dismiss).toHaveBeenCalled();
  });
});
