import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BbProgressCompact } from './bb-progress-compact';

describe('BbProgressCompact', () => {
  let component: BbProgressCompact;
  let fixture: ComponentFixture<BbProgressCompact>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BbProgressCompact],
    }).compileComponents();

    fixture = TestBed.createComponent(BbProgressCompact);
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
  });

  describe('displayVariant', () => {
    it('should return manual variant when no torrentState is set', () => {
      fixture.componentRef.setInput('variant', 'success');
      expect(component.displayVariant()).toBe('success');
    });

    it('should derive variant from torrentState when set', () => {
      fixture.componentRef.setInput('torrentState', 'downloading');
      expect(component.displayVariant()).toBe('info');
    });
  });

  describe('rendering', () => {
    it('renders no text content inside the bar', () => {
      fixture.componentRef.setInput('progress', 0.42);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent.trim()).toBe('');
    });

    it('sets the fill width from progressPercent', () => {
      fixture.componentRef.setInput('progress', 0.42);
      fixture.detectChanges();
      const fill: HTMLElement = fixture.nativeElement.querySelector('.bb-progress-compact__fill');
      expect(fill.style.width).toBe('42%');
    });
  });
});
