import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ElectronService } from '../../../services/electron.service';
import { ServerSettingsService } from '../../../services/server-settings.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { SettingsStateService } from '../settings-state.service';
import { Server } from './server';

describe('Server', () => {
  let component: Server;
  let fixture: ComponentFixture<Server>;

  let electronMock: {
    openPath: ReturnType<typeof vi.fn>;
    showOpenDialog: ReturnType<typeof vi.fn>;
  };
  let stateServiceMock: {
    registerSave: ReturnType<typeof vi.fn>;
    markDirty: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    electronMock = {
      openPath: vi.fn(),
      showOpenDialog: vi.fn().mockResolvedValue(null),
    };
    stateServiceMock = { registerSave: vi.fn(), markDirty: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Server],
      providers: [
        { provide: ElectronService, useValue: electronMock },
        { provide: SettingsStateService, useValue: stateServiceMock },
        { provide: TorrentStoreService, useValue: { torrentsArray: signal([]) } },
        { provide: ServerStoreService, useValue: { currentServerId: signal(null) } },
        {
          provide: ServerSettingsService,
          useValue: {
            reload: vi.fn().mockResolvedValue({
              pathMappings: [],
              polling: { foreground: 2000, background: 5000 },
            }),
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(Server);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('pathMappings getter', () => {
    it('should return the pathMappings FormArray', () => {
      expect(component.pathMappings).toBe(component.serverSettingsForm.controls.pathMappings);
    });
  });

  describe('addPathMapping', () => {
    it('should add one new mapping to the array', () => {
      const before = component.pathMappings.length;
      component.addPathMapping();
      expect(component.pathMappings.length).toBe(before + 1);
    });

    it('new mapping should have empty remote and local controls', () => {
      component.addPathMapping();
      const last = component.pathMappings.at(component.pathMappings.length - 1);
      expect(last.get('remote')?.value).toBe('');
      expect(last.get('local')?.value).toBe('');
    });
  });

  describe('removePathMapping', () => {
    it('should remove the mapping at the given index when more than one exist', () => {
      component.addPathMapping();
      const before = component.pathMappings.length;
      component.removePathMapping(0);
      expect(component.pathMappings.length).toBe(before - 1);
    });

    it('should reset the mapping to empty strings instead of removing when only one remains', () => {
      while (component.pathMappings.length > 1) {
        component.removePathMapping(0);
      }
      component.pathMappings.at(0).patchValue({ remote: 'r', local: 'l' });
      component.removePathMapping(0);
      expect(component.pathMappings.length).toBe(1);
      expect(component.pathMappings.at(0).get('remote')?.value).toBe('');
      expect(component.pathMappings.at(0).get('local')?.value).toBe('');
    });
  });

  describe('testMapping', () => {
    it('should call electronService.openPath with the given path', () => {
      component.testMapping('/some/local/path');
      expect(electronMock.openPath).toHaveBeenCalledWith('/some/local/path');
    });
  });
});
