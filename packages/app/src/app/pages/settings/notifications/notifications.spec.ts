import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DateFormatService } from '../../../services/date-format.service';
import { GeneralSettingsFormService } from '../general-settings-form.service';
import { SettingsStateService } from '../settings-state.service';
import { Notifications } from './notifications';

describe('Notifications', () => {
  let fixture: ComponentFixture<Notifications>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Notifications],
      providers: [
        GeneralSettingsFormService,
        { provide: SettingsStateService, useValue: { registerSave: vi.fn(), markDirty: vi.fn() } },
        { provide: DateFormatService, useValue: { applyFromSettings: vi.fn() } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(Notifications);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  });

  it('renders the system and in-app notification cards', () => {
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelectorAll('app-bb-section-card')).toHaveLength(2);
    expect(root.querySelector('#notifications-os-enabled')).not.toBeNull();
    expect(root.querySelector('#notifications-app-enabled')).not.toBeNull();
  });

  it('offers the four toast positions in screen-corner order for the 2x2 card grid', () => {
    expect(fixture.componentInstance.toastPositions().map((position) => position.value)).toEqual([
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
    ]);
  });
});
