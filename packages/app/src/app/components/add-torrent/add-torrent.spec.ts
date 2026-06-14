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

const draftWithFiles: TorrentDraft = {
  source: 'manual',
  receivedAt: Date.now(),
  torrent: {
    name: 'test-torrent',
    totalSize: 100,
    files: [{ path: 'file1.txt', length: 100 }],
  },
};

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
            addCategory: vi.fn().mockResolvedValue(undefined),
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

    it('should return true in link mode with magnet links and an empty rename', () => {
      component.switchInputMode('link');
      component.addForm.controls.magnetLinks.setValue('magnet:?xt=urn:btih:abcdef');

      expect(component.canSubmit()).toBe(true);
    });

    it('should return false when the file tree is in edit mode even if the form is otherwise valid', () => {
      component.switchInputMode('link');
      component.addForm.controls.magnetLinks.setValue('magnet:?xt=urn:btih:abcdef');
      component.treeInEditMode.set(true);

      expect(component.canSubmit()).toBe(false);
    });
  });

  describe('rename validator (via form)', () => {
    it('should be invalid when rename contains a forward slash', () => {
      component.addForm.controls.rename.setValue('folder/name');
      expect(component.addForm.controls.rename.errors).toHaveProperty('pattern');
    });

    it('should be invalid when rename contains a backslash', () => {
      component.addForm.controls.rename.setValue('folder\\name');
      expect(component.addForm.controls.rename.errors).toHaveProperty('pattern');
    });

    it('should be invalid when rename contains other reserved characters', () => {
      component.addForm.controls.rename.setValue('bad<name>');
      expect(component.addForm.controls.rename.errors).toHaveProperty('pattern');
    });

    it('should be valid when rename contains no invalid characters', () => {
      component.addForm.controls.rename.setValue('valid-name');
      expect(component.addForm.controls.rename.errors).toBeNull();
    });
  });

  describe('tabIssues / hasActiveWarnings', () => {
    it('should report an invalid-fields issue on the general tab by default', () => {
      expect(component.tabIssues().general).toContain(
        'components.add-torrent.tab.general.issue.invalid-fields',
      );
      expect(component.hasActiveWarnings()).toBe(true);
    });

    it('should clear the general tab issue once rename is set to a valid value', () => {
      component.addForm.controls.rename.setValue('valid-name');

      expect(component.tabIssues().general).toBeUndefined();
      expect(component.hasActiveWarnings()).toBe(false);
    });

    it('should report an invalid-fields issue on the general tab for invalid characters', () => {
      component.addForm.controls.rename.setValue('bad<name>');

      expect(component.tabIssues().general).toContain(
        'components.add-torrent.tab.general.issue.invalid-fields',
      );
    });

    it('should report a noServerSelected issue on the general tab', () => {
      component.addForm.controls.rename.setValue('valid-name');
      component.addForm.setErrors({ noServerSelected: true });

      expect(component.tabIssues().general).toContain(
        'components.add-torrent.feedback.no-server-selected',
      );
    });

    it('should report an addFailed issue on the general tab', () => {
      component.addForm.controls.rename.setValue('valid-name');
      component.addForm.setErrors({ addFailed: true });

      expect(component.tabIssues().general).toContain('components.add-torrent.feedback.add-failed');
    });

    it('should report a files tab issue while the file tree is in edit mode', () => {
      component.treeInEditMode.set(true);

      expect(component.tabIssues().files).toContain(
        'components.add-torrent.tab.files.issue.edit-in-progress',
      );
      expect(component.hasActiveWarnings()).toBe(true);
    });
  });

  describe('filesTabDisabled / filesTabDisabledReason', () => {
    it('should be disabled with a no-files reason by default', () => {
      expect(component.filesTabDisabledReason()).toBe(
        'components.add-torrent.tab.files.disabled.no-files',
      );
      expect(component.filesTabDisabled()).toBe(true);
    });

    it('should be disabled with a link-mode reason when input mode is link', () => {
      component.switchInputMode('link');

      expect(component.filesTabDisabledReason()).toBe(
        'components.add-torrent.tab.files.disabled.link-mode',
      );
      expect(component.filesTabDisabled()).toBe(true);
    });

    it('should be enabled when a draft with files is loaded and the tree is shown', () => {
      component.manualDraft.set(draftWithFiles);
      component.showTree.set(true);

      expect(component.filesTabDisabledReason()).toBeNull();
      expect(component.filesTabDisabled()).toBe(false);
    });
  });

  describe('selectTab / activeTabId', () => {
    it('should default to the general tab', () => {
      expect(component.activeTabId()).toBe('general');
    });

    it('should switch tabs via selectTab', () => {
      component.selectTab('options');
      expect(component.activeTabId()).toBe('options');
    });

    it('should switch away from the files tab once it becomes disabled', () => {
      component.manualDraft.set(draftWithFiles);
      component.showTree.set(true);
      fixture.detectChanges();

      component.selectTab('files');
      fixture.detectChanges();
      expect(component.activeTabId()).toBe('files');

      component.switchInputMode('link');
      fixture.detectChanges();

      expect(component.activeTabId()).toBe('general');
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

  describe('ngOnInit savepath behaviour', () => {
    it('should leave savepath null when AddTorrentSettings returns no savepath', async () => {
      const addTorrentSettings = TestBed.inject(AddTorrentSettingsService) as any;
      addTorrentSettings.load.mockResolvedValue({});

      await component.ngOnInit();

      expect(component.addForm.controls.savepath.value).toBeNull();
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

  describe('handleSubmit category creation', () => {
    let mockQbService: any;
    let torrentsAddSpy: any;

    beforeEach(() => {
      mockQbService = TestBed.inject(QbService) as any;
      torrentsAddSpy = vi.spyOn(window.bitbutler.qb, 'torrentsAdd').mockClear();
      (component as any).selectedTorrentFile.set({
        name: 'test.torrent',
        path: '/tmp/test.torrent',
      });
      component.addForm.controls.rename.setValue('test-torrent');
    });

    it('should create a typed category before adding the torrent', async () => {
      component.addForm.controls.category.setValue('new-category');

      await component.handleSubmit({ preventDefault: () => {} } as unknown as SubmitEvent);

      expect(mockQbService.addCategory).toHaveBeenCalledWith('server-1', 'new-category', '');
      expect(torrentsAddSpy).toHaveBeenCalled();
    });

    it('should abort without adding the torrent when category creation fails', async () => {
      mockQbService.addCategory.mockRejectedValueOnce(new Error('failed'));
      component.addForm.controls.category.setValue('bad-category');

      await component.handleSubmit({ preventDefault: () => {} } as unknown as SubmitEvent);

      expect(mockQbService.addCategory).toHaveBeenCalledWith('server-1', 'bad-category', '');
      expect(torrentsAddSpy).not.toHaveBeenCalled();
      expect(component.isSubmitting()).toBe(false);
    });
  });

  describe('eager rename validation', () => {
    it('should mark rename as touched on init when it is invalid', () => {
      fixture.detectChanges();

      expect(component.addForm.controls.rename.touched).toBe(true);
    });
  });

  describe('formDirty', () => {
    it('should be false initially', () => {
      expect(component.formDirty()).toBe(false);
    });

    it('should become true once a control is marked dirty', () => {
      component.addForm.controls.savepath.markAsDirty();
      component.addForm.controls.savepath.setValue('/changed');

      expect(component.formDirty()).toBe(true);
    });
  });

  describe('resetToSavedSettings', () => {
    it('should reapply saved AddTorrentSettings fields, mark them pristine, and clear formDirty', async () => {
      const addTorrentSettings = TestBed.inject(AddTorrentSettingsService) as any;
      addTorrentSettings.load.mockResolvedValue({
        savepath: '/downloads',
        paused: true,
        category: 'movies',
        tags: 'a, b',
        root_folder: 'true',
        skip_checking: true,
        sequentialDownload: true,
        firstLastPiecePrio: true,
        autoTMM: true,
        transferRateLimits: { uploadLimit: 100, downloadLimit: 200 },
        shareLimits: { ratioLimit: 2, seedingTimeLimit: 60, inactiveSeedingTimeLimit: -1 },
      });

      component.addForm.controls.savepath.markAsDirty();
      component.addForm.controls.savepath.setValue('/changed');
      expect(component.formDirty()).toBe(true);

      await component.resetToSavedSettings();

      expect(component.addForm.controls.savepath.value).toBe('/downloads');
      expect(component.addForm.controls.tags.value).toEqual(['a', 'b']);
      expect(component.addForm.controls.savepath.dirty).toBe(false);
      expect(component.formDirty()).toBe(false);
    });

    it('should leave rename dirty (and the form dirty) when only rename was edited', async () => {
      const addTorrentSettings = TestBed.inject(AddTorrentSettingsService) as any;
      addTorrentSettings.load.mockResolvedValue({ savepath: '/downloads' });

      component.addForm.controls.rename.markAsDirty();
      component.addForm.controls.rename.setValue('my-name');
      expect(component.formDirty()).toBe(true);

      await component.resetToSavedSettings();

      expect(component.addForm.controls.rename.value).toBe('my-name');
      expect(component.addForm.controls.rename.dirty).toBe(true);
      expect(component.formDirty()).toBe(true);
    });
  });
});
