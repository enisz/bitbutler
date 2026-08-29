import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WidgetMenu } from './widget-menu';

describe('WidgetMenu', () => {
  let fixture: ComponentFixture<WidgetMenu>;
  let component: WidgetMenu;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [WidgetMenu] }).compileComponents();
    fixture = TestBed.createComponent(WidgetMenu);
    component = fixture.componentInstance;
  });

  it('should render nothing when not visible', () => {
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.widget-menu')).toBeNull();
  });

  it('should render the toggle when visible', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.widget-menu')).toBeTruthy();
  });

  it('should emit configure when the Configure item is clicked', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    const emitted = vi.fn();
    component.configure.subscribe(emitted);

    fixture.nativeElement.querySelector('[data-test="widget-menu-configure"]').click();

    expect(emitted).toHaveBeenCalled();
  });

  it('should emit remove when the Delete item is clicked', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    const emitted = vi.fn();
    component.remove.subscribe(emitted);

    fixture.nativeElement.querySelector('[data-test="widget-menu-remove"]').click();

    expect(emitted).toHaveBeenCalled();
  });
});
