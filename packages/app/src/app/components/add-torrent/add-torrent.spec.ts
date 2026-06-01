import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { TorrentDraft } from '@bitbutler/shared';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { DEFAULT_GENERAL_SETTINGS } from '../../models/general-settings.model';
import { AddTorrentSettingsService } from '../../services/add-torrent-settings.service';
import { GeneralSettingsService } from '../../services/general-settings.service';
import { OpenFilesService } from '../../services/open-files.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { AddTorrent } from './add-torrent';

describe('AddTorrent', () => {
  let component: AddTorrent;
  let fixture: ComponentFixture<AddTorrent>;
  let mockActiveModal: Partial<NgbActiveModal>;
  let mockOpenFilesService: any;

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };
    mockOpenFilesService = {
      pendingDrafts: signal([]),
      consumeCurrentDraft: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AddTorrent],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: NgbModal, useValue: { open: vi.fn() } },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: TorrentStoreService, useValue: { torrentsArray: signal([]) } },
        { provide: OpenFilesService, useValue: mockOpenFilesService },
        {
          provide: AddTorrentSettingsService,
          useValue: {
            load: vi.fn().mockResolvedValue({}),
            save: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: GeneralSettingsService,
          useValue: {
            load: vi.fn().mockResolvedValue({ behavior: { deleteTorrentFile: false } }),
            asObservable: vi.fn().mockReturnValue(of(DEFAULT_GENERAL_SETTINGS)),
          },
        },
        {
          provide: QbService,
          useValue: {
            getAppPreferences: vi.fn().mockResolvedValue({ save_path: '/downloads' }),
            torrentsAdd: vi.fn().mockResolvedValue(undefined),
            torrentContents: vi.fn().mockResolvedValue([]),
            renameTorrentFile: vi.fn(),
            renameTorrentFolder: vi.fn(),
            setFilePriority: vi.fn(),
            setShareLimits: vi.fn().mockResolvedValue(undefined),
            getAllCategories: vi.fn().mockResolvedValue({}),
            getAllTags: vi.fn().mockResolvedValue([]),
            createTags: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddTorrent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with isSubmitting = false', () => {
    expect(component.isSubmitting()).toBe(false);
  });

  it('should start with showTree = false', () => {
    expect(component.showTree()).toBe(false);
  });

  describe('canSubmit', () => {
    it('should return false when no torrent file is selected', () => {
      expect(component.canSubmit()).toBe(false);
    });

    it('should return false while submitting', () => {
      component.isSubmitting.set(true);
      expect(component.canSubmit()).toBe(false);
    });
  });

  describe('rename validator (via form)', () => {
    it('should be invalid when rename contains a forward slash', () => {
      component.addForm.controls.rename.setValue('folder/name');
      expect(component.addForm.controls.rename.errors).toHaveProperty('noSlash');
    });

    it('should be invalid when rename contains a backslash', () => {
      component.addForm.controls.rename.setValue('folder\\name');
      expect(component.addForm.controls.rename.errors).toHaveProperty('noSlash');
    });

    it('should be valid when rename contains no slashes', () => {
      component.addForm.controls.rename.setValue('valid-name');
      expect(component.addForm.controls.rename.errors).toBeNull();
    });
  });

  describe('handleCancel', () => {
    it('should dismiss the modal when no pending drafts', () => {
      mockOpenFilesService.pendingDrafts.set([]);
      component.handleCancel();
      expect(mockActiveModal.dismiss).toHaveBeenCalled();
    });

    it('should consume the current draft when queue is non-empty', () => {
      mockOpenFilesService.pendingDrafts.set([{ draft: {}, selected: {} } as any]);
      component.handleCancel();
      expect(mockOpenFilesService.consumeCurrentDraft).toHaveBeenCalled();
    });
  });

  describe('tryRenameContentAfterAdd', () => {
    let mockQbService: any;
    const hash = 'abcdef1234567890';
    const draft: Partial<TorrentDraft> = { torrent: { infoHashV1: hash } as any };

    beforeEach(() => {
      mockQbService = TestBed.inject(QbService) as any;
      component.manualDraft.set(draft as TorrentDraft);
      mockQbService.torrentContents.mockResolvedValue([{ name: 'file.mkv', index: 0 }]);
    });

    it('should call setShareLimits when inactiveSeedingTimeLimit is no-limit (-1)', async () => {
      await (component as any).tryRenameContentAfterAdd('server-1', {
        ratioLimit: -2,
        seedingTimeLimit: -2,
        inactiveSeedingTimeLimit: -1,
      });
      expect(mockQbService.setShareLimits).toHaveBeenCalledWith('server-1', [hash], -2, -2, -1);
    });

    it('should call setShareLimits when inactiveSeedingTimeLimit is a custom value', async () => {
      await (component as any).tryRenameContentAfterAdd('server-1', {
        ratioLimit: 2,
        seedingTimeLimit: 120,
        inactiveSeedingTimeLimit: 60,
      });
      expect(mockQbService.setShareLimits).toHaveBeenCalledWith('server-1', [hash], 2, 120, 60);
    });

    it('should not call setShareLimits when inactiveSeedingTimeLimit is global (-2)', async () => {
      await (component as any).tryRenameContentAfterAdd('server-1', {
        ratioLimit: -2,
        seedingTimeLimit: -2,
        inactiveSeedingTimeLimit: -2,
      });
      expect(mockQbService.setShareLimits).not.toHaveBeenCalled();
    });

    it('should not call setShareLimits when shareLimits is null', async () => {
      await (component as any).tryRenameContentAfterAdd('server-1', null);
      expect(mockQbService.setShareLimits).not.toHaveBeenCalled();
    });
  });
});
