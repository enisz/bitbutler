import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FlagsTooltipComponent } from './flags-tooltip';

describe('FlagsTooltipComponent', () => {
  let component: FlagsTooltipComponent;
  let fixture: ComponentFixture<FlagsTooltipComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlagsTooltipComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FlagsTooltipComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    component.agInit({ data: { flags: 'U I' } } as any);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should resolve known flags from the flags string', () => {
    component.agInit({ data: { flags: 'U I' } } as any);
    expect(component.activeFlags.length).toBe(2);
    expect(component.activeFlags[0].flag).toBe('U');
    expect(component.activeFlags[1].flag).toBe('I');
  });

  it('should preserve the order defined in PEER_FLAG_DEFINITIONS', () => {
    component.agInit({ data: { flags: 'U D' } } as any);
    expect(component.activeFlags[0].flag).toBe('D');
    expect(component.activeFlags[1].flag).toBe('U');
  });

  it('should silently ignore unknown flags', () => {
    component.agInit({ data: { flags: 'U Z' } } as any);
    expect(component.activeFlags.length).toBe(1);
    expect(component.activeFlags[0].flag).toBe('U');
  });

  it('should produce an empty list when flags is an empty string', () => {
    component.agInit({ data: { flags: '' } } as any);
    expect(component.activeFlags.length).toBe(0);
  });

  it('should produce an empty list when data is undefined', () => {
    component.agInit({ data: undefined } as any);
    expect(component.activeFlags.length).toBe(0);
  });

  it('should handle all 12 known flags', () => {
    component.agInit({ data: { flags: 'D U d u O S I E H X L P' } } as any);
    expect(component.activeFlags.length).toBe(12);
  });
});
