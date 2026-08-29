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
});
