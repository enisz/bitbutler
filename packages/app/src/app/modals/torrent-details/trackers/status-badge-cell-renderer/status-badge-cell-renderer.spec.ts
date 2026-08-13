import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QbTrackerStatus } from '../../../../models/qbittorrent.model';
import { StatusBadgeCellRenderer } from './status-badge-cell-renderer';

describe('StatusBadgeCellRenderer', () => {
  let component: StatusBadgeCellRenderer;
  let fixture: ComponentFixture<StatusBadgeCellRenderer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatusBadgeCellRenderer],
    }).compileComponents();

    fixture = TestBed.createComponent(StatusBadgeCellRenderer);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('maps Working to the ok variant and uses the formatted label', () => {
    component.agInit({ value: QbTrackerStatus.Working, valueFormatted: 'Working' } as any);
    fixture.detectChanges();
    expect(component.variant).toBe('ok');
    expect(component.label).toBe('Working');
  });

  it('maps NotWorking to the warn variant', () => {
    component.agInit({ value: QbTrackerStatus.NotWorking, valueFormatted: 'Not working' } as any);
    expect(component.variant).toBe('warn');
  });

  it('maps NotContacted and Updating to the idle variant', () => {
    component.agInit({
      value: QbTrackerStatus.NotContacted,
      valueFormatted: 'Not contacted',
    } as any);
    expect(component.variant).toBe('idle');
    component.agInit({ value: QbTrackerStatus.Updating, valueFormatted: 'Updating' } as any);
    expect(component.variant).toBe('idle');
  });

  it('returns true from refresh', () => {
    component.agInit({ value: QbTrackerStatus.Working, valueFormatted: 'Working' } as any);
    expect(
      component.refresh({ value: QbTrackerStatus.Working, valueFormatted: 'Working' } as any),
    ).toBe(true);
  });

  it('updates params and reflects the new variant/label when refreshed', () => {
    component.agInit({ value: QbTrackerStatus.Working, valueFormatted: 'Working' } as any);
    expect(component.variant).toBe('ok');
    expect(component.label).toBe('Working');

    const newParams = { value: QbTrackerStatus.NotWorking, valueFormatted: 'Not working' } as any;
    component.refresh(newParams);

    expect(component.params).toBe(newParams);
    expect(component.variant).toBe('warn');
    expect(component.label).toBe('Not working');
  });
});
