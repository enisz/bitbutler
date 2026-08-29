import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { WidgetPicker } from './widget-picker';

describe('WidgetPicker', () => {
  let component: WidgetPicker;
  let fixture: ComponentFixture<WidgetPicker>;
  let activeModalMock: { close: ReturnType<typeof vi.fn>; dismiss: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    activeModalMock = { close: vi.fn(), dismiss: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [WidgetPicker],
      providers: [{ provide: NgbActiveModal, useValue: activeModalMock }],
    }).compileComponents();
    fixture = TestBed.createComponent(WidgetPicker);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should list both catalog entries', () => {
    expect(component.catalogEntries.map((e) => e.id).sort()).toEqual(['stat-tile', 'torrent-list']);
  });

  it('should close the modal with the chosen widget type id', () => {
    component.choose('stat-tile');
    expect(activeModalMock.close).toHaveBeenCalledWith('stat-tile');
  });

  it('should dismiss on cancel', () => {
    component.cancel();
    expect(activeModalMock.dismiss).toHaveBeenCalled();
  });
});
