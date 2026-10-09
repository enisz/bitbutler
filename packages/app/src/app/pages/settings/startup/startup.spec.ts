import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ServerRecord } from '@bitbutler/shared';
import { DateFormatService } from '../../../services/date-format.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { GeneralSettingsFormService } from '../general-settings-form.service';
import { SettingsStateService } from '../settings-state.service';
import { Startup } from './startup';

describe('Startup', () => {
  let component: Startup;
  let fixture: ComponentFixture<Startup>;

  let stateServiceMock: {
    registerSave: ReturnType<typeof vi.fn>;
    markDirty: ReturnType<typeof vi.fn>;
  };
  let serverStoreMock: { servers: ReturnType<typeof signal<ServerRecord[]>> };
  let dateFormatServiceMock: { applyFromSettings: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    stateServiceMock = { registerSave: vi.fn(), markDirty: vi.fn() };
    serverStoreMock = { servers: signal([]) };
    dateFormatServiceMock = { applyFromSettings: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Startup],
      providers: [
        GeneralSettingsFormService,
        { provide: SettingsStateService, useValue: stateServiceMock },
        { provide: ServerStoreService, useValue: serverStoreMock },
        { provide: DateFormatService, useValue: dateFormatServiceMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(Startup);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('hasDefaultServer', () => {
    it('returns false when no server has auto_login', () => {
      serverStoreMock.servers.set([
        {
          id: '1',
          name: 'test',
          auto_login: false,
          host: 'localhost',
          protocol: 'http',
          port: 8080,
          username: '',
          created_at: '',
          has_password: false,
          export_available: null,
          webapi_version: null,
          qb_version: null,
        },
      ]);
      fixture.detectChanges();
      expect(component.hasDefaultServer()).toBe(false);
    });

    it('returns true when at least one server has auto_login', () => {
      serverStoreMock.servers.set([
        {
          id: '1',
          name: 'test',
          auto_login: true,
          host: 'localhost',
          protocol: 'http',
          port: 8080,
          username: '',
          created_at: '',
          has_password: false,
          export_available: null,
          webapi_version: null,
          qb_version: null,
        },
      ]);
      fixture.detectChanges();
      expect(component.hasDefaultServer()).toBe(true);
    });
  });

  describe('showNoDefaultHostHint', () => {
    it('is false when openAtLogin is false and no default server', () => {
      serverStoreMock.servers.set([]);
      component.generalSettingsForm.controls.startup.controls.openAtLogin.setValue(false);
      fixture.detectChanges();
      expect(component.showNoDefaultHostHint()).toBe(false);
    });

    it('is true when openAtLogin is true and no default server', () => {
      serverStoreMock.servers.set([]);
      component.generalSettingsForm.controls.startup.controls.openAtLogin.setValue(true);
      fixture.detectChanges();
      expect(component.showNoDefaultHostHint()).toBe(true);
    });

    it('is false when openAtLogin is true and a default server exists', () => {
      serverStoreMock.servers.set([
        {
          id: '1',
          name: 'test',
          auto_login: true,
          host: 'localhost',
          protocol: 'http',
          port: 8080,
          username: '',
          created_at: '',
          has_password: false,
          export_available: null,
          webapi_version: null,
          qb_version: null,
        },
      ]);
      component.generalSettingsForm.controls.startup.controls.openAtLogin.setValue(true);
      fixture.detectChanges();
      expect(component.showNoDefaultHostHint()).toBe(false);
    });

    it('is false when openAtLogin is false even if no default server exists', () => {
      serverStoreMock.servers.set([]);
      component.generalSettingsForm.controls.startup.controls.openAtLogin.setValue(false);
      fixture.detectChanges();
      expect(component.showNoDefaultHostHint()).toBe(false);
    });
  });
});
