import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FAMILY_ACCENT_COLORS } from '../../services/theme.service';
import { BbLogo } from './bb-logo';

describe('BbLogo', () => {
  let component: BbLogo;
  let fixture: ComponentFixture<BbLogo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BbLogo],
    }).compileComponents();

    fixture = TestBed.createComponent(BbLogo);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render an svg sized by the default size input', () => {
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('width')).toBe('190');
    expect(svg?.getAttribute('height')).toBe('190');
  });

  it('should resize the svg when the size input changes', () => {
    fixture.componentRef.setInput('size', 48);
    fixture.detectChanges();

    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('48');
    expect(svg?.getAttribute('height')).toBe('48');
  });

  it('should leave color unset by default so it inherits the active theme accent', () => {
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg');
    expect(svg?.style.color).toBe('');
  });

  it('should pin color to the given family accent when family is set', () => {
    fixture.componentRef.setInput('family', 'aurora');
    fixture.detectChanges();

    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg');
    expect(svg?.style.color).toBe('rgb(43, 179, 177)');
    expect(FAMILY_ACCENT_COLORS['aurora']).toBe('#2bb3b1');
  });
});
