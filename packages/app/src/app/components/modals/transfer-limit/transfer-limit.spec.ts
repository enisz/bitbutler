import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { TransferLimit } from './transfer-limit';

const makeTorrent = (overrides: Partial<Torrent> = {}): Torrent =>
  ({ name: 'My Torrent', hash: 'abc123', up_limit: 0, dl_limit: 0, ...overrides }) as Torrent;

const makeStore = (torrents: Torrent[] = []) => signal(new Map(torrents.map((t) => [t.hash, t])));

describe('TransferLimit', () => {
  let component: TransferLimit;
  let fixture: ComponentFixture<TransferLimit>;
  let mockActiveModal: Partial<NgbActiveModal>;
  let mockQbService: any;
  let mockToastService: { danger: ReturnType<typeof vi.fn> };
  let torrentsMap: ReturnType<typeof makeStore>;

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };
    mockQbService = {
      transfer: {
        uploadLimit: vi.fn().mockResolvedValue(0),
        downloadLimit: vi.fn().mockResolvedValue(0),
        setUploadLimit: vi.fn().mockResolvedValue(undefined),
        setDownloadLimit: vi.fn().mockResolvedValue(undefined),
      },
      torrents: {
        setUploadLimit: vi.fn().mockResolvedValue(undefined),
        setDownloadLimit: vi.fn().mockResolvedValue(undefined),
      },
    };

    mockToastService = { danger: vi.fn() };

    torrentsMap = makeStore([makeTorrent()]);

    await TestBed.configureTestingModule({
      imports: [TransferLimit],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        {
          provide: TorrentStoreService,
          useValue: { torrentsMap },
        },
        { provide: QbService, useValue: mockQbService },
        { provide: ToastService, useValue: mockToastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TransferLimit);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('target', 'torrent');
    fixture.componentRef.setInput('hashes', ['abc123']);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('torrent target - zero limits', () => {
    it('leaves uploadLimit null when up_limit is 0', async () => {
      await fixture.whenStable();
      expect(component.form.controls.transferRateLimits.value?.uploadLimit).toBeNull();
    });

    it('leaves downloadLimit null when dl_limit is 0', async () => {
      await fixture.whenStable();
      expect(component.form.controls.transferRateLimits.value?.downloadLimit).toBeNull();
    });

    it('does not call getUploadLimit or getDownloadLimit', () => {
      expect(mockQbService.transfer.uploadLimit).not.toHaveBeenCalled();
      expect(mockQbService.transfer.downloadLimit).not.toHaveBeenCalled();
    });
  });

  describe('torrent target - set limits', () => {
    beforeEach(async () => {
      torrentsMap.set(
        new Map([['abc123', makeTorrent({ up_limit: 512 * 1024, dl_limit: 1024 * 1024 })]]),
      );
      const f = TestBed.createComponent(TransferLimit);
      component = f.componentInstance;
      f.componentRef.setInput('target', 'torrent');
      f.componentRef.setInput('hashes', ['abc123']);
      f.detectChanges();
      await f.whenStable();
    });

    it('converts up_limit bytes to KiB for uploadLimit', () => {
      expect(component.form.controls.transferRateLimits.value?.uploadLimit).toBe(512);
    });

    it('converts dl_limit bytes to KiB for downloadLimit', () => {
      expect(component.form.controls.transferRateLimits.value?.downloadLimit).toBe(1024);
    });
  });

  describe('canSave', () => {
    it('returns true when form is valid and not saving', () => {
      expect(component.canSave()).toBe(true);
    });

    it('returns false while saving', () => {
      component.saving.set(true);
      expect(component.canSave()).toBe(false);
    });
  });

  describe('hasClearableValues', () => {
    it('returns false when both limits are null', () => {
      component.form.controls.transferRateLimits.setValue({
        uploadLimit: null,
        downloadLimit: null,
      });
      expect(component.hasClearableValues()).toBe(false);
    });

    it('returns true when uploadLimit is set', () => {
      component.form.controls.transferRateLimits.setValue({
        uploadLimit: 512,
        downloadLimit: null,
      });
      expect(component.hasClearableValues()).toBe(true);
    });

    it('returns true when downloadLimit is set', () => {
      component.form.controls.transferRateLimits.setValue({
        uploadLimit: null,
        downloadLimit: 1024,
      });
      expect(component.hasClearableValues()).toBe(true);
    });
  });

  describe('tooltipText', () => {
    it('returns null for global target', () => {
      const f = TestBed.createComponent(TransferLimit);
      const c = f.componentInstance;
      f.componentRef.setInput('target', 'global');
      f.componentRef.setInput('hashes', []);
      f.detectChanges();
      expect(c.tooltipText()).toBeNull();
    });

    it('returns non-null for torrent target with hashes', () => {
      expect(component.tooltipText()).toBeDefined();
    });
  });

  describe('handleSubmit - torrent target', () => {
    it('calls setUploadLimit and setDownloadLimit with component hashes', async () => {
      component.form.controls.transferRateLimits.setValue({
        uploadLimit: 512,
        downloadLimit: 1024,
      });
      await component.handleSubmit();
      expect(mockQbService.torrents.setUploadLimit).toHaveBeenCalledWith('server-1', 512 * 1024, [
        'abc123',
      ]);
      expect(mockQbService.torrents.setDownloadLimit).toHaveBeenCalledWith(
        'server-1',
        1024 * 1024,
        ['abc123'],
      );
    });

    it('shows a danger toast with the raw error when setUploadLimit fails', async () => {
      mockQbService.torrents.setUploadLimit.mockRejectedValueOnce(new Error('disk full'));
      component.form.controls.transferRateLimits.setValue({
        uploadLimit: 512,
        downloadLimit: 1024,
      });

      await component.handleSubmit();

      expect(mockToastService.danger).toHaveBeenCalledWith(
        'disk full',
        'components.modals.transfer-limit.toast.set-failed-title',
      );
    });

    it('does not close the modal when saving fails', async () => {
      mockQbService.torrents.setUploadLimit.mockRejectedValueOnce(new Error('disk full'));
      component.form.controls.transferRateLimits.setValue({
        uploadLimit: 512,
        downloadLimit: 1024,
      });

      await component.handleSubmit();

      expect(mockActiveModal.close).not.toHaveBeenCalled();
      expect(component.saving()).toBe(false);
    });
  });

  describe('clearAll', () => {
    it('resets upload and download limits to null', () => {
      component.form.controls.transferRateLimits.setValue({
        uploadLimit: 512,
        downloadLimit: 1024,
      });
      component.clearAll();
      expect(component.form.controls.transferRateLimits.value).toEqual({
        uploadLimit: null,
        downloadLimit: null,
      });
    });

    it('does not close the modal', () => {
      component.clearAll();
      expect(mockActiveModal.close).not.toHaveBeenCalled();
    });
  });
});
