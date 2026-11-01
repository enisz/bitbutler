import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { QbService } from '../../services/qb.service';
import { ServerSettingsService } from '../../services/server-settings.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ServerSettingsFormService } from './server-settings-form.service';
import { SettingsStateService } from './settings-state.service';

describe('ServerSettingsFormService', () => {
  let service: ServerSettingsFormService;
  let currentServerId: ReturnType<typeof signal<string | null>>;
  let stateMock: {
    registerSave: ReturnType<typeof vi.fn>;
    registerPaneActions: ReturnType<typeof vi.fn>;
    markDirty: ReturnType<typeof vi.fn>;
  };
  let serverSettingsMock: {
    reload: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  const settings = (foreground: number) => ({
    polling: { foreground, background: 5000 },
    pathMappings: [{ remote: '/downloads', local: 'C:\\dl' }],
  });

  const flush = async () => {
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
  };

  beforeEach(async () => {
    currentServerId = signal<string | null>('s1');
    stateMock = { registerSave: vi.fn(), registerPaneActions: vi.fn(), markDirty: vi.fn() };
    serverSettingsMock = {
      reload: vi.fn().mockResolvedValue(settings(2000)),
      save: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        ServerSettingsFormService,
        { provide: SettingsStateService, useValue: stateMock },
        { provide: ServerSettingsService, useValue: serverSettingsMock },
        { provide: ServerStoreService, useValue: { currentServerId } },
        {
          provide: QbService,
          useValue: { app: { preferences: vi.fn().mockResolvedValue({ save_path: '/data' }) } },
        },
      ],
    });
    service = TestBed.inject(ServerSettingsFormService);
    await flush();
  });

  it('registers one save function for the server form', () => {
    expect(stateMock.registerSave).toHaveBeenCalledWith('server', expect.any(Function));
  });

  it('loads the polling intervals and path mappings into the form', () => {
    expect(service.loaded()).toBe(true);
    expect(service.form.controls.polling.controls.foreground.value).toBe(2000);
    expect(service.form.controls.pathMappings.length).toBe(1);
    expect(service.form.controls.pathMappings.at(0).getRawValue()).toEqual({
      remote: '/downloads',
      local: 'C:\\dl',
    });
  });

  it('adds one empty mapping row when the server has no mappings', async () => {
    serverSettingsMock.reload.mockResolvedValue({ ...settings(2000), pathMappings: [] });

    await service.load();

    expect(service.form.controls.pathMappings.length).toBe(1);
    expect(service.form.controls.pathMappings.at(0).getRawValue()).toEqual({
      remote: null,
      local: '',
    });
  });

  it('exposes the default remote path of the server', () => {
    expect(service.defaultRemotePath()).toBe('/data');
  });

  it('marks the server form dirty when a control changes', () => {
    service.form.controls.polling.controls.foreground.setValue(3000);

    expect(stateMock.markDirty).toHaveBeenCalledWith('server', true);
  });

  it('flags only the pane that owns the edited section, and clears it after save', async () => {
    expect(service.paneDirty()).toEqual({ polling: false, 'path-mappings': false });

    service.form.controls.polling.controls.foreground.setValue(3000);
    expect(service.paneDirty()).toEqual({ polling: true, 'path-mappings': false });

    await service.save();
    expect(service.paneDirty()).toEqual({ polling: false, 'path-mappings': false });

    service.form.controls.pathMappings.at(0).patchValue({ local: 'E:\\y' });
    expect(service.paneDirty()).toEqual({ polling: false, 'path-mappings': true });
  });

  it('clears the server dirty flag when a change is reverted by hand', () => {
    const foreground = service.form.controls.polling.controls.foreground;
    foreground.setValue(3000);
    foreground.setValue(2000);

    expect(stateMock.markDirty).toHaveBeenLastCalledWith('server', false);
  });

  it('save fills an empty remote path with the default remote path', async () => {
    service.form.controls.pathMappings.at(0).patchValue({ remote: null, local: 'D:\\x' });

    await service.save();

    expect(serverSettingsMock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        pathMappings: [{ remote: '/data', local: 'D:\\x' }],
      }),
    );
  });

  it('save keeps a non-empty remote path unchanged', async () => {
    service.form.controls.pathMappings.at(0).patchValue({ remote: '/custom', local: 'D:/x' });

    await service.save();

    expect(serverSettingsMock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        pathMappings: [{ remote: '/custom', local: 'D:/x' }],
      }),
    );
  });

  it('reloads and clears the dirty flag when the current server changes', async () => {
    serverSettingsMock.reload.mockResolvedValue(settings(4000));
    stateMock.markDirty.mockClear();

    currentServerId.set('s2');
    await flush();

    expect(service.form.controls.polling.controls.foreground.value).toBe(4000);
    expect(stateMock.markDirty).toHaveBeenLastCalledWith('server', false);
  });

  it('ignores the result of an outdated load when a newer one started', async () => {
    let resolveOld!: (value: unknown) => void;
    serverSettingsMock.reload
      .mockReturnValueOnce(new Promise((resolve) => (resolveOld = resolve)))
      .mockResolvedValueOnce(settings(9000));

    const first = service.load();
    const second = service.load();
    await second;
    resolveOld(settings(1000));
    await first;

    expect(service.form.controls.polling.controls.foreground.value).toBe(9000);
  });

  describe('pane actions', () => {
    type Actions = { discard: () => void; restoreDefaults: () => void };
    const actions = (paneId: string): Actions =>
      stateMock.registerPaneActions.mock.calls.find(([id]) => id === paneId)![1] as Actions;

    it('registers discard and restore defaults for the polling and path mappings panes', () => {
      for (const paneId of ['polling', 'path-mappings']) {
        expect(actions(paneId).discard).toBeTypeOf('function');
        expect(actions(paneId).restoreDefaults).toBeTypeOf('function');
      }
    });

    it('discards the polling intervals back to the saved ones', () => {
      service.form.controls.polling.controls.foreground.setValue(9000);
      expect(service.paneDirty().polling).toBe(true);

      actions('polling').discard();

      expect(service.form.controls.polling.controls.foreground.value).toBe(2000);
      expect(service.paneDirty().polling).toBe(false);
    });

    it('restores the default polling intervals and leaves the path mappings alone', () => {
      service.form.controls.polling.patchValue({ foreground: 9000, background: 12000 });
      service.form.controls.pathMappings.at(0).controls.local.setValue('D:\\other');

      actions('polling').restoreDefaults();

      expect(service.form.controls.polling.getRawValue()).toEqual({
        foreground: 2000,
        background: 5000,
      });
      expect(service.form.controls.pathMappings.at(0).controls.local.value).toBe('D:\\other');
    });

    it('discards edited path mappings back to the saved rows', () => {
      service.form.controls.pathMappings.at(0).controls.local.setValue('D:\\other');
      service.form.controls.pathMappings.push(
        new FormGroup({
          remote: new FormControl<string | null>('/extra'),
          local: new FormControl('E:\\extra', { nonNullable: true }),
        }),
      );
      expect(service.paneDirty()['path-mappings']).toBe(true);

      actions('path-mappings').discard();

      expect(service.form.controls.pathMappings.length).toBe(1);
      expect(service.form.controls.pathMappings.at(0).getRawValue()).toEqual({
        remote: '/downloads',
        local: 'C:\\dl',
      });
      expect(service.paneDirty()['path-mappings']).toBe(false);
    });

    it('restores the default path mappings as one empty row, and discard brings the rows back', () => {
      actions('path-mappings').restoreDefaults();

      expect(service.form.controls.pathMappings.length).toBe(1);
      expect(service.form.controls.pathMappings.at(0).getRawValue()).toEqual({
        remote: null,
        local: '',
      });
      expect(service.paneDirty()['path-mappings']).toBe(true);
      expect(stateMock.markDirty).toHaveBeenLastCalledWith('server', true);

      actions('path-mappings').discard();

      expect(service.form.controls.pathMappings.at(0).getRawValue().local).toBe('C:\\dl');
      expect(service.paneDirty()['path-mappings']).toBe(false);
    });
  });
});
