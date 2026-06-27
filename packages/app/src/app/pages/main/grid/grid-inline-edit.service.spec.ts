import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CellValueChangedEvent } from 'ag-grid-community';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { GridInlineEditService } from './grid-inline-edit.service';

function makeMockApi(colDefs: any[] = []) {
  return {
    getColumnDefs: vi.fn().mockReturnValue(colDefs),
    updateGridOptions: vi.fn(),
  };
}

function makeEvent(
  colId: string,
  data: Partial<Torrent>,
  newValue: any,
): CellValueChangedEvent<Torrent> {
  return { colDef: { colId }, data: { hash: 'abc123', ...data } as Torrent, newValue } as any;
}

describe('GridInlineEditService', () => {
  let service: GridInlineEditService;
  let qb: any;

  beforeEach(() => {
    qb = {
      torrents: {
        rename: vi.fn().mockResolvedValue(undefined),
        setLocation: vi.fn().mockResolvedValue(undefined),
        setDownloadPath: vi.fn().mockResolvedValue(undefined),
        setCategory: vi.fn().mockResolvedValue(undefined),
        removeAllTags: vi.fn().mockResolvedValue(undefined),
        addTags: vi.fn().mockResolvedValue(undefined),
        setDownloadLimit: vi.fn().mockResolvedValue(undefined),
        setUploadLimit: vi.fn().mockResolvedValue(undefined),
        setShareLimits: vi.fn().mockResolvedValue(undefined),
        toggleSequentialDownload: vi.fn().mockResolvedValue(undefined),
        setForceStart: vi.fn().mockResolvedValue(undefined),
        setSuperSeeding: vi.fn().mockResolvedValue(undefined),
        setAutoManagement: vi.fn().mockResolvedValue(undefined),
        toggleFirstLastPiecePrio: vi.fn().mockResolvedValue(undefined),
      },
    };

    TestBed.configureTestingModule({
      providers: [
        GridInlineEditService,
        { provide: QbService, useValue: qb },
        {
          provide: ServerStoreService,
          useValue: { currentServer: signal({ id: 'server-1' }) },
        },
      ],
    });

    service = TestBed.inject(GridInlineEditService);
  });

  describe('applyEditableState', () => {
    it('sets editable: true on eligible text/numeric columns when isInlineEdit is true', () => {
      const api = makeMockApi([
        { colId: 'name', field: 'name' },
        { colId: 'size', field: 'size' },
        { colId: 'dl_limit_raw', field: 'dl_limit' },
      ]);
      service.applyEditableState(api as any, true);
      const { columnDefs } = api.updateGridOptions.mock.calls[0][0];
      expect(columnDefs.find((d: any) => d.colId === 'name').editable).toBe(true);
      expect(columnDefs.find((d: any) => d.colId === 'size').editable).toBeUndefined();
      expect(columnDefs.find((d: any) => d.colId === 'dl_limit_raw').editable).toBe(true);
    });

    it('sets editable: true on eligible boolean columns when isInlineEdit is true', () => {
      const api = makeMockApi([{ colId: 'seq_dl', field: 'seq_dl', editable: false }]);
      service.applyEditableState(api as any, true);
      const { columnDefs } = api.updateGridOptions.mock.calls[0][0];
      expect(columnDefs.find((d: any) => d.colId === 'seq_dl').editable).toBe(true);
    });

    it('removes editable from text/numeric columns when isInlineEdit is false', () => {
      const api = makeMockApi([{ colId: 'name', field: 'name', editable: true }]);
      service.applyEditableState(api as any, false);
      const { columnDefs } = api.updateGridOptions.mock.calls[0][0];
      expect(columnDefs.find((d: any) => d.colId === 'name').editable).toBeUndefined();
    });

    it('restores editable: false for boolean columns when isInlineEdit is false', () => {
      const api = makeMockApi([{ colId: 'force_start', field: 'force_start', editable: true }]);
      service.applyEditableState(api as any, false);
      const { columnDefs } = api.updateGridOptions.mock.calls[0][0];
      expect(columnDefs.find((d: any) => d.colId === 'force_start').editable).toBe(false);
    });

    it('does not touch columns that are not in INLINE_EDITABLE_COL_IDS', () => {
      const api = makeMockApi([{ colId: 'size', field: 'size' }]);
      service.applyEditableState(api as any, true);
      const { columnDefs } = api.updateGridOptions.mock.calls[0][0];
      expect(columnDefs.find((d: any) => d.colId === 'size').editable).toBeUndefined();
    });
  });

  describe('handleCellValueChanged — text columns', () => {
    it('calls torrents.rename for name column', async () => {
      await service.handleCellValueChanged(makeEvent('name', {}, 'New Name'));
      expect(qb.torrents.rename).toHaveBeenCalledWith('server-1', 'abc123', 'New Name');
    });

    it('calls torrents.setLocation for save_path column', async () => {
      await service.handleCellValueChanged(makeEvent('save_path', {}, '/mnt/new'));
      expect(qb.torrents.setLocation).toHaveBeenCalledWith('server-1', ['abc123'], '/mnt/new');
    });

    it('calls torrents.setDownloadPath for download_path column', async () => {
      await service.handleCellValueChanged(makeEvent('download_path', {}, '/mnt/dl'));
      expect(qb.torrents.setDownloadPath).toHaveBeenCalledWith('server-1', ['abc123'], '/mnt/dl');
    });

    it('calls torrents.setCategory for category column', async () => {
      await service.handleCellValueChanged(makeEvent('category', {}, 'Movies'));
      expect(qb.torrents.setCategory).toHaveBeenCalledWith('server-1', ['abc123'], 'Movies');
    });

    it('calls setCategory with empty string when category is null', async () => {
      await service.handleCellValueChanged(makeEvent('category', {}, null));
      expect(qb.torrents.setCategory).toHaveBeenCalledWith('server-1', ['abc123'], '');
    });
  });

  describe('handleCellValueChanged — tags column', () => {
    it('calls removeAllTags then addTags with trimmed non-empty tags', async () => {
      await service.handleCellValueChanged(makeEvent('tags', {}, 'action, comedy , drama'));
      expect(qb.torrents.removeAllTags).toHaveBeenCalledWith('server-1', ['abc123']);
      expect(qb.torrents.addTags).toHaveBeenCalledWith(
        'server-1',
        ['abc123'],
        ['action', 'comedy', 'drama'],
      );
    });

    it('calls only removeAllTags when new value is empty string', async () => {
      await service.handleCellValueChanged(makeEvent('tags', {}, ''));
      expect(qb.torrents.removeAllTags).toHaveBeenCalledWith('server-1', ['abc123']);
      expect(qb.torrents.addTags).not.toHaveBeenCalled();
    });

    it('calls only removeAllTags when new value is null', async () => {
      await service.handleCellValueChanged(makeEvent('tags', {}, null));
      expect(qb.torrents.removeAllTags).toHaveBeenCalledWith('server-1', ['abc123']);
      expect(qb.torrents.addTags).not.toHaveBeenCalled();
    });
  });

  describe('handleCellValueChanged — numeric columns', () => {
    it('calls setDownloadLimit for dl_limit_raw', async () => {
      await service.handleCellValueChanged(makeEvent('dl_limit_raw', {}, 1024));
      expect(qb.torrents.setDownloadLimit).toHaveBeenCalledWith('server-1', 1024, ['abc123']);
    });

    it('calls setUploadLimit for up_limit_raw', async () => {
      await service.handleCellValueChanged(makeEvent('up_limit_raw', {}, 2048));
      expect(qb.torrents.setUploadLimit).toHaveBeenCalledWith('server-1', 2048, ['abc123']);
    });

    it('calls setShareLimits with correct params for seeding_time_limit_raw', async () => {
      const data: Partial<Torrent> = { ratio_limit: 2.0, inactive_seeding_time_limit: -1 };
      await service.handleCellValueChanged(makeEvent('seeding_time_limit_raw', data, 1440));
      expect(qb.torrents.setShareLimits).toHaveBeenCalledWith(
        'server-1',
        ['abc123'],
        2.0,
        1440,
        -1,
      );
    });

    it('calls setShareLimits with correct params for inactive_seeding_time_limit_raw', async () => {
      const data: Partial<Torrent> = { ratio_limit: -1, seeding_time_limit: 720 };
      await service.handleCellValueChanged(makeEvent('inactive_seeding_time_limit_raw', data, 360));
      expect(qb.torrents.setShareLimits).toHaveBeenCalledWith('server-1', ['abc123'], -1, 720, 360);
    });
  });

  describe('handleCellValueChanged — boolean columns', () => {
    it('calls toggleSequentialDownload for seq_dl', async () => {
      await service.handleCellValueChanged(makeEvent('seq_dl', {}, true));
      expect(qb.torrents.toggleSequentialDownload).toHaveBeenCalledWith('server-1', ['abc123']);
    });

    it('calls setForceStart with boolean newValue for force_start', async () => {
      await service.handleCellValueChanged(makeEvent('force_start', {}, true));
      expect(qb.torrents.setForceStart).toHaveBeenCalledWith('server-1', ['abc123'], true);
    });

    it('calls setSuperSeeding with boolean newValue for super_seeding', async () => {
      await service.handleCellValueChanged(makeEvent('super_seeding', {}, false));
      expect(qb.torrents.setSuperSeeding).toHaveBeenCalledWith('server-1', ['abc123'], false);
    });

    it('calls setAutoManagement with boolean newValue for auto_tmm', async () => {
      await service.handleCellValueChanged(makeEvent('auto_tmm', {}, true));
      expect(qb.torrents.setAutoManagement).toHaveBeenCalledWith('server-1', ['abc123'], true);
    });

    it('calls toggleFirstLastPiecePrio for f_l_piece_prio', async () => {
      await service.handleCellValueChanged(makeEvent('f_l_piece_prio', {}, true));
      expect(qb.torrents.toggleFirstLastPiecePrio).toHaveBeenCalledWith('server-1', ['abc123']);
    });
  });

  describe('handleCellValueChanged — guard conditions', () => {
    it('does nothing when event.data is null', async () => {
      const event = { colDef: { colId: 'name' }, data: null, newValue: 'x' } as any;
      await service.handleCellValueChanged(event);
      expect(qb.torrents.rename).not.toHaveBeenCalled();
    });

    it('does nothing when no server is selected', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          GridInlineEditService,
          { provide: QbService, useValue: qb },
          { provide: ServerStoreService, useValue: { currentServer: signal(null) } },
        ],
      });
      const svc = TestBed.inject(GridInlineEditService);
      await svc.handleCellValueChanged(makeEvent('name', {}, 'x'));
      expect(qb.torrents.rename).not.toHaveBeenCalled();
    });
  });
});
