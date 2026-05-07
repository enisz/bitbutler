import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommandBusService } from '../../../services/command-bus.service';
import { SettingsStateService } from '../settings-state.service';
import { General } from './general';

describe('General', () => {
  let component: General;
  let fixture: ComponentFixture<General>;

  let commandBusMock: { emit: ReturnType<typeof vi.fn> };
  let stateServiceMock: {
    registerSave: ReturnType<typeof vi.fn>;
    markDirty: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    commandBusMock = { emit: vi.fn() };
    stateServiceMock = { registerSave: vi.fn(), markDirty: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [General],
      providers: [
        { provide: CommandBusService, useValue: commandBusMock },
        { provide: SettingsStateService, useValue: stateServiceMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(General);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('getFamilyLogo', () => {
    it('should return the logo URL for a given family name', () => {
      expect(component.getFamilyLogo('aurora')).toBe('assets/images/bitbutler-logo-aurora.png');
    });

    it('should use the exact family name in the URL', () => {
      expect(component.getFamilyLogo('mint-green')).toBe(
        'assets/images/bitbutler-logo-mint-green.png',
      );
    });
  });

  describe('checkUpdates', () => {
    it('should emit UPDATE_CHECK_FOR_UPDATE', () => {
      component.checkUpdates();
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'UPDATE_CHECK_FOR_UPDATE' });
    });
  });
});
