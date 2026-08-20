import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BbProgress } from './bb-progress';

describe('BbProgressBar', () => {
  let component: BbProgress;
  let fixture: ComponentFixture<BbProgress>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BbProgress],
    }).compileComponents();

    fixture = TestBed.createComponent(BbProgress);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('progressPercent', () => {
    it('should default to 0', () => {
      expect(component.progressPercent()).toBe(0);
    });

    it('should convert 0-1 range to percentage', () => {
      fixture.componentRef.setInput('progress', 0.5);
      expect(component.progressPercent()).toBe(50);
    });

    it('should treat values > 1 as already a percentage', () => {
      fixture.componentRef.setInput('progress', 75);
      expect(component.progressPercent()).toBe(75);
    });

    it('should clamp values above 100 to 100', () => {
      fixture.componentRef.setInput('progress', 150);
      expect(component.progressPercent()).toBe(100);
    });

    it('should clamp negative values to 0', () => {
      fixture.componentRef.setInput('progress', -10);
      expect(component.progressPercent()).toBe(0);
    });

    it('should handle null gracefully', () => {
      fixture.componentRef.setInput('progress', null);
      expect(component.progressPercent()).toBe(0);
    });

    it('should handle undefined gracefully', () => {
      fixture.componentRef.setInput('progress', undefined);
      expect(component.progressPercent()).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      fixture.componentRef.setInput('progress', 0.333);
      expect(component.progressPercent()).toBe(33.3);
    });

    it('should treat a sub-1% value as already a percentage when rawPercent is true', () => {
      fixture.componentRef.setInput('rawPercent', true);
      fixture.componentRef.setInput('progress', 0.5);
      expect(component.progressPercent()).toBe(0.5);
    });
  });

  describe('displayVariant', () => {
    it('should return manual variant when no torrentState is set', () => {
      fixture.componentRef.setInput('variant', 'success');
      expect(component.displayVariant()).toBe('success');
    });

    it('should derive variant from torrentState when set', () => {
      fixture.componentRef.setInput('torrentState', 'downloading');
      const variant = component.displayVariant();
      expect(variant).toBeDefined();
    });

    it('should use manual variant as fallback when torrentState is undefined', () => {
      fixture.componentRef.setInput('variant', 'danger');
      fixture.componentRef.setInput('torrentState', undefined);
      expect(component.displayVariant()).toBe('danger');
    });
  });

  describe('mode', () => {
    it('should default to normal and render the percentage label', () => {
      fixture.componentRef.setInput('progress', 0.5);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.bb-progress-label')).not.toBeNull();
    });

    it('should render no label in compact mode', () => {
      fixture.componentRef.setInput('mode', 'compact');
      fixture.componentRef.setInput('progress', 0.5);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.bb-progress-label')).toBeNull();
    });

    it('should add the compact modifier class in compact mode', () => {
      fixture.componentRef.setInput('mode', 'compact');
      fixture.detectChanges();
      expect(
        fixture.nativeElement
          .querySelector('.bb-progress')
          .classList.contains('bb-progress--compact'),
      ).toBe(true);
    });

    it('should not add the compact modifier class in normal mode', () => {
      fixture.detectChanges();
      expect(
        fixture.nativeElement
          .querySelector('.bb-progress')
          .classList.contains('bb-progress--compact'),
      ).toBe(false);
    });
  });
});
