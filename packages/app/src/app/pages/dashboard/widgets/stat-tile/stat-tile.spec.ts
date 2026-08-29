import { ComponentFixture, TestBed } from '@angular/core/testing';
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

  it('should show "value of total" for active_count', () => {
    component.data = { metric: 'active_count', value: 18, total: 42 };
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('18');
    expect(text).toContain('42');
  });

  // Regression coverage: the widget wires <app-widget-menu> identically across all three widget
  // types (gated by editMode, configure/remove routed to onConfigure()/onRemove()) - a typo in
  // any one of them would currently ship green with no test catching it.
  describe('widget menu integration', () => {
    it('should show the widget menu only in edit mode, and route configure/remove to onConfigure()/onRemove()', () => {
      component.data = { metric: 'download_speed', value: 1024 };
      component.onConfigure = vi.fn();
      component.onRemove = vi.fn();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.widget-menu')).toBeNull();

      fixture.componentRef.setInput('editMode', true);
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
