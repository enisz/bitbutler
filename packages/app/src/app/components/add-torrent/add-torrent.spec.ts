import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { TorrentDraft } from '@bitbutler/shared';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { DEFAULT_GENERAL_SETTINGS } from '../../models/general-settings.model';
import { AddTorrentSettingsService } from '../../services/add-torrent-settings.service';
import { ConfirmService } from '../../services/confirm.service';
import { GeneralSettingsService } from '../../services/general-settings.service';
import { OpenFilesService } from '../../services/open-files.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { FileTreeSaveEvent } from '../bb-file-tree/bb-file-tree';
import { TorrentExists } from '../modals/torrent-exists/torrent-exists';
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
        { provide: ConfirmService, useValue: { confirm: vi.fn().mockResolvedValue(true) } },
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
            app: {
              preferences: vi.fn().mockResolvedValue({ save_path: '/downloads' }),
            },
            torrents: {
              files: vi.fn().mockResolvedValue([]),
              renameFile: vi.fn(),
              renameFolder: vi.fn(),
              filePrio: vi.fn(),
              setShareLimits: vi.fn().mockResolvedValue(undefined),
              categories: vi.fn().mockResolvedValue({}),
              createCategory: vi.fn().mockResolvedValue(undefined),
              tags: vi.fn().mockResolvedValue([]),
              createTags: vi.fn().mockResolvedValue(undefined),
            },
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
      component.addForm.controls.linkGroup.controls.magnetLinks.setValue(
        'magnet:?xt=urn:btih:abcdef',
      );

      expect(component.canSubmit()).toBe(true);
    });

    it('should return true in file mode when a torrent file is selected and fileGroup is valid', () => {
      (component as any).selectedTorrentFile.set({
        name: 'test.torrent',
        path: '/tmp/test.torrent',
      });

      expect(component.canSubmit()).toBe(true);
    });

    it('should return false when the file tree is in edit mode even if the form is otherwise valid', () => {
      component.switchInputMode('link');
      component.addForm.controls.linkGroup.controls.magnetLinks.setValue(
        'magnet:?xt=urn:btih:abcdef',
      );
      component.treeInEditMode.set(true);

      expect(component.canSubmit()).toBe(false);
    });
  });

  describe('rename validator (via form)', () => {
    it('should be invalid when rename contains a forward slash', () => {
      component.addForm.controls.fileGroup.controls.rename.setValue('folder/name');
      expect(component.addForm.controls.fileGroup.controls.rename.errors).toHaveProperty('pattern');
    });

    it('should be invalid when rename contains a backslash', () => {
      component.addForm.controls.fileGroup.controls.rename.setValue('folder\\name');
      expect(component.addForm.controls.fileGroup.controls.rename.errors).toHaveProperty('pattern');
    });

    it('should be invalid when rename contains other reserved characters', () => {
      component.addForm.controls.fileGroup.controls.rename.setValue('bad<name>');
      expect(component.addForm.controls.fileGroup.controls.rename.errors).toHaveProperty('pattern');
    });

    it('should be valid when rename contains no invalid characters', () => {
      component.addForm.controls.fileGroup.controls.rename.setValue('valid-name');
      expect(component.addForm.controls.fileGroup.controls.rename.errors).toBeNull();
    });

    it('should be valid when fileGroup rename is left empty', () => {
      expect(component.addForm.controls.fileGroup.controls.rename.value).toBeNull();
      expect(component.addForm.controls.fileGroup.controls.rename.errors).toBeNull();
    });

    it('should be valid when linkGroup rename is left empty', () => {
      expect(component.addForm.controls.linkGroup.controls.rename.value).toBeNull();
      expect(component.addForm.controls.linkGroup.controls.rename.errors).toBeNull();
    });
  });

  describe('tabIssues / hasActiveWarnings', () => {
    it('should report no general tab issue by default', () => {
      expect(component.tabIssues().general).toBeUndefined();
      expect(component.hasActiveWarnings()).toBe(false);
    });

    it('should clear the general tab issue once rename is set to a valid value', () => {
      component.addForm.controls.fileGroup.controls.rename.setValue('valid-name');

      expect(component.tabIssues().general).toBeUndefined();
      expect(component.hasActiveWarnings()).toBe(false);
    });

    it('should report an invalid-fields issue on the general tab for invalid characters', () => {
      component.addForm.controls.fileGroup.controls.rename.setValue('bad<name>');

      expect(component.tabIssues().general).toBe(
        'components.add-torrent.tab.general.issue.invalid-fields',
      );
    });

    it('should report an invalid-fields issue on the general tab for invalid characters in link mode', () => {
      component.switchInputMode('link');
      component.addForm.controls.linkGroup.controls.rename.setValue('bad<name>');

      expect(component.tabIssues().general).toBe(
        'components.add-torrent.tab.general.issue.invalid-fields',
      );
    });

    it('should report a noServerSelected issue on the general tab', () => {
      component.addForm.controls.fileGroup.controls.rename.setValue('valid-name');
      component.addForm.setErrors({ noServerSelected: true });

      expect(component.tabIssues().general).toBe(
        'components.add-torrent.feedback.no-server-selected',
      );
    });

    it('should report an addFailed issue on the general tab', () => {
      component.addForm.controls.fileGroup.controls.rename.setValue('valid-name');
      component.addForm.setErrors({ addFailed: true });

      expect(component.tabIssues().general).toBe('components.add-torrent.feedback.add-failed');
    });

    it('should report a files tab issue while the file tree is in edit mode', () => {
      component.treeInEditMode.set(true);

      expect(component.tabIssues().files).toBe(
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
      component.selectTab('limits');
      expect(component.activeTabId()).toBe('limits');
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

  describe('onTreeSaved', () => {
    it('should store the saved file tree state', () => {
      const event: FileTreeSaveEvent = {
        files: [{ path: 'file1.txt', length: 100, priority: 0 }],
        renames: [{ oldPath: 'old.txt', newPath: 'new.txt' }],
      };

      component.onTreeSaved(event);

      expect((component as any).savedFileState).toEqual(event);
    });
  });

  describe('ngOnInit savepath behaviour', () => {
    it('should leave savepath null when AddTorrentSettings returns no savepath', async () => {
      const addTorrentSettings = TestBed.inject(AddTorrentSettingsService) as any;
      addTorrentSettings.load.mockResolvedValue({});

      await component.ngOnInit();

      expect(component.addForm.controls.savepath.value).toBeNull();
    });

    it('should patch form controls from saved AddTorrentSettings', async () => {
      const addTorrentSettings = TestBed.inject(AddTorrentSettingsService) as any;
      addTorrentSettings.load.mockResolvedValue({
        savepath: '/downloads/movies',
        paused: true,
        category: 'movies',
        root_folder: 'true',
        skip_checking: true,
      });

      await component.ngOnInit();

      expect(component.addForm.controls.savepath.value).toBe('/downloads/movies');
      expect(component.addForm.controls.paused.value).toBe(true);
      expect(component.addForm.controls.category.value).toBe('movies');
      expect(component.addForm.controls.root_folder.value).toBe('true');
      expect(component.addForm.controls.skip_checking.value).toBe(true);
    });

    it('should convert a comma-separated tags string into an array', async () => {
      const addTorrentSettings = TestBed.inject(AddTorrentSettingsService) as any;
      addTorrentSettings.load.mockResolvedValue({ tags: 'movies, 4k, favorites' });

      await component.ngOnInit();

      expect(component.addForm.controls.tags.value).toEqual(['movies', '4k', 'favorites']);
    });

    it('should not overwrite a dirty control with a saved setting', async () => {
      const addTorrentSettings = TestBed.inject(AddTorrentSettingsService) as any;
      addTorrentSettings.load.mockResolvedValue({ savepath: '/downloads/movies' });

      component.addForm.controls.savepath.setValue('/custom/path');
      component.addForm.controls.savepath.markAsDirty();

      await component.ngOnInit();

      expect(component.addForm.controls.savepath.value).toBe('/custom/path');
    });
  });

  describe('tryRenameContentAfterAdd', () => {
    let mockQbService: any;
    const hash = 'abcdef1234567890';
    const draft: Partial<TorrentDraft> = { torrent: { infoHashV1: hash } as any };

    beforeEach(() => {
      mockQbService = TestBed.inject(QbService) as any;
      component.manualDraft.set(draft as TorrentDraft);
      mockQbService.torrents.files.mockResolvedValue([{ name: 'file.mkv', index: 0 }]);
    });

    it('should call setShareLimits when inactiveSeedingTimeLimit is no-limit (-1)', async () => {
      await (component as any).tryRenameContentAfterAdd('server-1', {
        ratioLimit: -2,
        seedingTimeLimit: -2,
        inactiveSeedingTimeLimit: -1,
      });
      expect(mockQbService.torrents.setShareLimits).toHaveBeenCalledWith(
        'server-1',
        [hash],
        -2,
        -2,
        -1,
      );
    });

    it('should call setShareLimits when inactiveSeedingTimeLimit is a custom value', async () => {
      await (component as any).tryRenameContentAfterAdd('server-1', {
        ratioLimit: 2,
        seedingTimeLimit: 120,
        inactiveSeedingTimeLimit: 60,
      });
      expect(mockQbService.torrents.setShareLimits).toHaveBeenCalledWith(
        'server-1',
        [hash],
        2,
        120,
        60,
      );
    });

    it('should not call setShareLimits when inactiveSeedingTimeLimit is global (-2)', async () => {
      await (component as any).tryRenameContentAfterAdd('server-1', {
        ratioLimit: -2,
        seedingTimeLimit: -2,
        inactiveSeedingTimeLimit: -2,
      });
      expect(mockQbService.torrents.setShareLimits).not.toHaveBeenCalled();
    });

    it('should not call setShareLimits when shareLimits is null', async () => {
      await (component as any).tryRenameContentAfterAdd('server-1', null);
      expect(mockQbService.torrents.setShareLimits).not.toHaveBeenCalled();
    });

    it('should do nothing when the effective draft has no infoHashV1', async () => {
      component.manualDraft.set({
        source: 'manual',
        receivedAt: Date.now(),
        torrent: { name: 'x', totalSize: 1, files: [] },
      });

      await (component as any).tryRenameContentAfterAdd('server-1', null);

      expect(mockQbService.torrents.files).not.toHaveBeenCalled();
    });

    it('should apply saved file renames via renameTorrentFile', async () => {
      (component as any).savedFileState = {
        files: [],
        renames: [{ oldPath: 'old.txt', newPath: 'new.txt' }],
      };

      await (component as any).tryRenameContentAfterAdd('server-1', null);

      expect(mockQbService.torrents.renameFile).toHaveBeenCalledWith(
        'server-1',
        hash,
        'old.txt',
        'new.txt',
      );
    });

    it('should apply non-default file priorities using the path-to-index map from torrentContents', async () => {
      (component as any).savedFileState = {
        files: [
          { path: 'file.mkv', length: 100, priority: 7 },
          { path: 'subtitle.srt', length: 10, priority: 0 },
          { path: 'readme.txt', length: 5, priority: 1 },
        ],
        renames: [],
      };

      mockQbService.torrents.files
        .mockResolvedValueOnce([{ name: 'file.mkv', index: 0 }])
        .mockResolvedValueOnce([
          { name: 'file.mkv', index: 0 },
          { name: 'subtitle.srt', index: 1 },
        ]);

      await (component as any).tryRenameContentAfterAdd('server-1', null);

      expect(mockQbService.torrents.filePrio).toHaveBeenCalledWith('server-1', hash, [0], 7);
      expect(mockQbService.torrents.filePrio).toHaveBeenCalledWith('server-1', hash, [1], 0);
      expect(mockQbService.torrents.filePrio).toHaveBeenCalledTimes(2);
    });

    it('should skip files that are not found in the torrent contents response', async () => {
      (component as any).savedFileState = {
        files: [{ path: 'missing.mkv', length: 100, priority: 7 }],
        renames: [],
      };

      mockQbService.torrents.files
        .mockResolvedValueOnce([{ name: 'file.mkv', index: 0 }])
        .mockResolvedValueOnce([{ name: 'file.mkv', index: 0 }]);

      await (component as any).tryRenameContentAfterAdd('server-1', null);

      expect(mockQbService.torrents.filePrio).not.toHaveBeenCalled();
    });

    it('should log and swallow errors instead of throwing', async () => {
      (component as any).savedFileState = {
        files: [],
        renames: [{ oldPath: 'old.txt', newPath: 'new.txt' }],
      };
      mockQbService.torrents.renameFile.mockRejectedValueOnce(new Error('rename failed'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await (component as any).tryRenameContentAfterAdd('server-1', null);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        AddTorrent.name,
        'tryRenameContentAfterAdd',
        expect.any(Error),
      );
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
      component.addForm.controls.fileGroup.controls.rename.setValue('test-torrent');
    });

    it('should create a typed category before adding the torrent', async () => {
      component.addForm.controls.category.setValue('new-category');

      await component.handleSubmit({ preventDefault: () => {} } as unknown as SubmitEvent);

      expect(mockQbService.torrents.createCategory).toHaveBeenCalledWith(
        'server-1',
        'new-category',
        '',
      );
      expect(torrentsAddSpy).toHaveBeenCalled();
    });

    it('should abort without adding the torrent when category creation fails', async () => {
      mockQbService.torrents.createCategory.mockRejectedValueOnce(new Error('failed'));
      component.addForm.controls.category.setValue('bad-category');

      await component.handleSubmit({ preventDefault: () => {} } as unknown as SubmitEvent);

      expect(mockQbService.torrents.createCategory).toHaveBeenCalledWith(
        'server-1',
        'bad-category',
        '',
      );
      expect(torrentsAddSpy).not.toHaveBeenCalled();
      expect(component.isSubmitting()).toBe(false);
    });
  });

  describe('handleSubmit', () => {
    it('should set noServerSelected and not submit when no server is selected', async () => {
      const serverStoreService = TestBed.inject(ServerStoreService) as any;
      serverStoreService.currentServerId.set(null);

      const torrentsAddSpy = vi.spyOn(window.bitbutler.qb, 'torrentsAdd').mockClear();

      component.switchInputMode('link');
      component.addForm.controls.linkGroup.controls.magnetLinks.setValue('magnet:?xt=urn:btih:abc');
      fixture.detectChanges();

      await component.handleSubmit({ preventDefault: () => {} } as unknown as SubmitEvent);

      expect(component.addForm.errors).toEqual({ noServerSelected: true });
      expect(torrentsAddSpy).not.toHaveBeenCalled();
    });

    it('should add via link mode, save settings, and close the modal on success', async () => {
      const torrentsAddSpy = vi.spyOn(window.bitbutler.qb, 'torrentsAdd').mockClear();
      const addTorrentSettingsService = TestBed.inject(AddTorrentSettingsService) as any;

      component.switchInputMode('link');
      component.addForm.controls.linkGroup.controls.magnetLinks.setValue('magnet:?xt=urn:btih:abc');
      fixture.detectChanges();

      await component.handleSubmit({ preventDefault: () => {} } as unknown as SubmitEvent);

      expect(torrentsAddSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'server-1',
          urls: ['magnet:?xt=urn:btih:abc'],
          torrents: [],
        }),
      );
      expect(addTorrentSettingsService.save).toHaveBeenCalled();
      expect(mockActiveModal.close).toHaveBeenCalledWith(true);
    });

    it('should delete the source file and consume the draft when deleteTorrentFile is enabled', async () => {
      const torrentsAddSpy = vi.spyOn(window.bitbutler.qb, 'torrentsAdd').mockClear();
      const deleteFileSpy = vi.spyOn(window.bitbutler.torrent, 'deleteFile').mockClear();
      const generalSettingsService = TestBed.inject(GeneralSettingsService) as any;
      generalSettingsService.load.mockResolvedValue({ behavior: { deleteTorrentFile: true } });

      (component as any).selectedTorrentFile.set({
        name: 'test.torrent',
        path: '/tmp/test.torrent',
      });
      component.manualDraft.set({
        source: 'manual',
        receivedAt: Date.now(),
        originalPath: '/tmp/test.torrent',
        torrent: { name: 'test-torrent', totalSize: 100, files: [] },
      });
      component.addForm.controls.fileGroup.controls.rename.setValue('test-torrent');
      fixture.detectChanges();

      await component.handleSubmit({ preventDefault: () => {} } as unknown as SubmitEvent);

      expect(torrentsAddSpy).toHaveBeenCalled();
      expect(deleteFileSpy).toHaveBeenCalledWith({ path: '/tmp/test.torrent' });
      expect(mockOpenFilesService.consumeCurrentDraft).toHaveBeenCalled();
    });

    it('should not delete the source file when deleteTorrentFile is disabled', async () => {
      vi.spyOn(window.bitbutler.qb, 'torrentsAdd').mockClear();
      const deleteFileSpy = vi.spyOn(window.bitbutler.torrent, 'deleteFile').mockClear();

      (component as any).selectedTorrentFile.set({
        name: 'test.torrent',
        path: '/tmp/test.torrent',
      });
      component.manualDraft.set({
        source: 'manual',
        receivedAt: Date.now(),
        originalPath: '/tmp/test.torrent',
        torrent: { name: 'test-torrent', totalSize: 100, files: [] },
      });
      component.addForm.controls.fileGroup.controls.rename.setValue('test-torrent');
      fixture.detectChanges();

      await component.handleSubmit({ preventDefault: () => {} } as unknown as SubmitEvent);

      expect(deleteFileSpy).not.toHaveBeenCalled();
      expect(mockOpenFilesService.consumeCurrentDraft).toHaveBeenCalled();
    });

    it('should open the TorrentExists modal and consume the draft on a 409 conflict', async () => {
      vi.spyOn(window.bitbutler.qb, 'torrentsAdd')
        .mockClear()
        .mockRejectedValue(new Error('Request failed: 409 {"name":"QbHttpError","status":409}'));
      const modalService = TestBed.inject(NgbModal) as any;
      modalService.open.mockReturnValue({ _contentRef: { componentRef: { setInput: vi.fn() } } });

      (component as any).selectedTorrentFile.set({
        name: 'test.torrent',
        path: '/tmp/test.torrent',
      });
      component.manualDraft.set({
        source: 'manual',
        receivedAt: Date.now(),
        torrent: { name: 'test-torrent', totalSize: 100, infoHashV1: 'ABC123', files: [] },
      });
      component.addForm.controls.fileGroup.controls.rename.setValue('test-torrent');
      fixture.detectChanges();

      await component.handleSubmit({ preventDefault: () => {} } as unknown as SubmitEvent);

      expect(modalService.open).toHaveBeenCalledWith(TorrentExists, { centered: true });
      expect(mockOpenFilesService.consumeCurrentDraft).toHaveBeenCalled();
      expect(component.addForm.errors).toBeNull();
    });

    it('should set addFailed when torrentsAdd throws a non-conflict error', async () => {
      vi.spyOn(window.bitbutler.qb, 'torrentsAdd')
        .mockClear()
        .mockRejectedValue(new Error('network error'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      (component as any).selectedTorrentFile.set({
        name: 'test.torrent',
        path: '/tmp/test.torrent',
      });
      component.addForm.controls.fileGroup.controls.rename.setValue('test-torrent');
      fixture.detectChanges();

      await component.handleSubmit({ preventDefault: () => {} } as unknown as SubmitEvent);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(component.addForm.errors).toEqual({ addFailed: true });
      expect(mockOpenFilesService.consumeCurrentDraft).not.toHaveBeenCalled();
    });
  });

  describe('eager rename validation', () => {
    it('should not mark fileGroup rename as touched on init when it is empty (valid)', () => {
      fixture.detectChanges();

      expect(component.addForm.controls.fileGroup.controls.rename.touched).toBe(false);
    });

    it('should mark fileGroup rename as touched once it becomes pattern-invalid', () => {
      component.addForm.controls.fileGroup.controls.rename.setValue('bad<name>');
      fixture.detectChanges();

      expect(component.addForm.controls.fileGroup.controls.rename.touched).toBe(true);
    });

    it('should mark linkGroup rename as touched once it becomes pattern-invalid in link mode', () => {
      component.switchInputMode('link');
      component.addForm.controls.linkGroup.controls.rename.setValue('bad<name>');
      fixture.detectChanges();

      expect(component.addForm.controls.linkGroup.controls.rename.touched).toBe(true);
    });
  });

  describe('handleInputModeChange', () => {
    it('should do nothing when the mode is unchanged', () => {
      component.handleInputModeChange('file');

      expect(component.inputMode()).toBe('file');
    });

    it('should preserve fileGroup state across a file -> link -> file round trip', () => {
      component.addForm.controls.fileGroup.controls.file.setValue('movie.torrent', {
        emitEvent: false,
      });
      component.addForm.controls.fileGroup.controls.rename.setValue('renamed-movie');
      (component as any).selectedTorrentFile.set({
        name: 'movie.torrent',
        path: '/tmp/movie.torrent',
      });
      (component as any).savedFileState = { renames: [], files: [] };
      component.showTree.set(true);

      component.handleInputModeChange('link');
      component.handleInputModeChange('file');

      expect(component.addForm.controls.fileGroup.controls.file.value).toBe('movie.torrent');
      expect(component.addForm.controls.fileGroup.controls.rename.value).toBe('renamed-movie');
      expect((component as any).selectedTorrentFile()).toEqual({
        name: 'movie.torrent',
        path: '/tmp/movie.torrent',
      });
      expect((component as any).savedFileState).toEqual({ renames: [], files: [] });
      expect(component.showTree()).toBe(true);
    });

    it('should preserve linkGroup state across a link -> file -> link round trip', () => {
      component.switchInputMode('link');
      component.addForm.controls.linkGroup.controls.magnetLinks.setValue(
        'magnet:?xt=urn:btih:abcdef',
      );
      component.addForm.controls.linkGroup.controls.rename.setValue('renamed-magnet');

      component.handleInputModeChange('file');
      component.handleInputModeChange('link');

      expect(component.addForm.controls.linkGroup.controls.magnetLinks.value).toBe(
        'magnet:?xt=urn:btih:abcdef',
      );
      expect(component.addForm.controls.linkGroup.controls.rename.value).toBe('renamed-magnet');
    });

    it('should reset treeInEditMode and clear the files tab issue when switching modes', () => {
      component.treeInEditMode.set(true);
      expect(component.tabIssues().files).toBe(
        'components.add-torrent.tab.files.issue.edit-in-progress',
      );

      component.handleInputModeChange('link');

      expect(component.treeInEditMode()).toBe(false);
      expect(component.tabIssues().files).toBeUndefined();
    });
  });

  describe('loading pending drafts', () => {
    it('should populate fileGroup.file, suggest a rename, and show the tree for a pending draft with files', () => {
      const draft: TorrentDraft = {
        source: 'manual',
        receivedAt: Date.now(),
        originalPath: '/tmp/movie.torrent',
        torrent: {
          name: 'Movie Name',
          totalSize: 100,
          infoHashV1: 'abc123',
          files: [{ path: 'file1.txt', length: 100 }],
        },
      };

      mockOpenFilesService.pendingDrafts.set([
        { draft, selected: { name: 'movie.torrent', path: '/tmp/movie.torrent' } },
      ]);
      fixture.detectChanges();

      expect(component.addForm.controls.fileGroup.controls.file.value).toBe('movie.torrent');
      expect(component.addForm.controls.fileGroup.controls.rename.value).toBe('Movie Name');
      expect(component.showTree()).toBe(true);
      expect(component.initialQueueCount()).toBe(1);
    });

    it('should suggest a rename from originalName stripped of .torrent when there is no torrent metadata', () => {
      const draft: TorrentDraft = {
        source: 'manual',
        receivedAt: Date.now(),
        originalPath: '/tmp/movie.torrent',
        originalName: 'My Movie.torrent',
      };

      mockOpenFilesService.pendingDrafts.set([
        { draft, selected: { name: 'movie.torrent', path: '/tmp/movie.torrent' } },
      ]);
      fixture.detectChanges();

      expect(component.addForm.controls.fileGroup.controls.rename.value).toBe('My Movie');
      expect(component.showTree()).toBe(false);
    });

    it('should open the TorrentExists modal and consume the draft when the torrent is already in the list', () => {
      const torrentStoreService = TestBed.inject(TorrentStoreService) as any;
      torrentStoreService.torrentsArray.set([{ hash: 'ABC123' }]);

      const modalService = TestBed.inject(NgbModal) as any;
      modalService.open.mockReturnValue({ _contentRef: { componentRef: { setInput: vi.fn() } } });

      const draft: TorrentDraft = {
        source: 'manual',
        receivedAt: Date.now(),
        originalPath: '/tmp/movie.torrent',
        torrent: { name: 'Movie', totalSize: 100, infoHashV1: 'abc123', files: [] },
      };

      mockOpenFilesService.pendingDrafts.set([
        { draft, selected: { name: 'movie.torrent', path: '/tmp/movie.torrent' } },
      ]);
      fixture.detectChanges();

      expect(modalService.open).toHaveBeenCalledWith(TorrentExists, { centered: true });
      expect(mockOpenFilesService.consumeCurrentDraft).toHaveBeenCalled();
    });

    it('should track the queue size and close the modal once all pending drafts are consumed', () => {
      const draft1: TorrentDraft = {
        source: 'manual',
        receivedAt: Date.now(),
        originalPath: '/tmp/a.torrent',
        torrent: { name: 'A', totalSize: 100, files: [] },
      };
      const draft2: TorrentDraft = {
        source: 'manual',
        receivedAt: Date.now(),
        originalPath: '/tmp/b.torrent',
        torrent: { name: 'B', totalSize: 100, files: [] },
      };

      mockOpenFilesService.pendingDrafts.set([
        { draft: draft1, selected: { name: 'a.torrent', path: '/tmp/a.torrent' } },
        { draft: draft2, selected: { name: 'b.torrent', path: '/tmp/b.torrent' } },
      ]);
      fixture.detectChanges();

      expect(component.initialQueueCount()).toBe(2);

      mockOpenFilesService.pendingDrafts.set([]);
      fixture.detectChanges();

      expect(mockActiveModal.close).toHaveBeenCalledWith(true);
    });

    it('should not reset a dirty rename when the same pending draft is re-evaluated', () => {
      const draft: TorrentDraft = {
        source: 'manual',
        receivedAt: Date.now(),
        originalPath: '/tmp/movie.torrent',
        torrent: { name: 'Movie Name', totalSize: 100, infoHashV1: 'abc123', files: [] },
      };

      mockOpenFilesService.pendingDrafts.set([
        { draft, selected: { name: 'movie.torrent', path: '/tmp/movie.torrent' } },
      ]);
      fixture.detectChanges();

      component.addForm.controls.fileGroup.controls.rename.setValue('custom-name');

      mockOpenFilesService.pendingDrafts.set([
        { draft, selected: { name: 'movie.torrent', path: '/tmp/movie.torrent' } },
      ]);
      fixture.detectChanges();

      expect(component.addForm.controls.fileGroup.controls.rename.value).toBe('custom-name');
    });
  });

  describe('handleFileSelected', () => {
    it('should do nothing when no file is selected', async () => {
      const parseSpy = vi.spyOn(window.bitbutler.torrent, 'parse').mockClear();

      const event = { target: { files: [], value: '' } } as unknown as Event;
      await component.handleFileSelected(event);

      expect(parseSpy).not.toHaveBeenCalled();
    });

    it('should parse a selected file by path and set it as the pending draft', async () => {
      const file = new File(['dummy'], 'movie.torrent');
      (file as any).path = '/tmp/movie.torrent';

      const draft: TorrentDraft = {
        source: 'manual',
        receivedAt: Date.now(),
        torrent: { name: 'movie', totalSize: 100, files: [] },
      };
      const parseSpy = vi
        .spyOn(window.bitbutler.torrent, 'parse')
        .mockClear()
        .mockResolvedValue(draft);

      const event = { target: { files: [file], value: 'movie.torrent' } } as unknown as Event;
      await component.handleFileSelected(event);

      expect(parseSpy).toHaveBeenCalledWith({ source: 'manual', path: '/tmp/movie.torrent' });
      expect(mockOpenFilesService.pendingDrafts()).toEqual([
        { draft, selected: { name: 'movie.torrent', path: '/tmp/movie.torrent' } },
      ]);
      expect((event.target as HTMLInputElement).value).toBe('');
    });

    it('should parse a selected file by bytes when the File has no path property', async () => {
      const file = new File([new Uint8Array([1, 2, 3])], 'movie.torrent');

      const draft: TorrentDraft = {
        source: 'manual',
        receivedAt: Date.now(),
        torrent: { name: 'movie', totalSize: 100, files: [] },
      };
      const parseSpy = vi
        .spyOn(window.bitbutler.torrent, 'parse')
        .mockClear()
        .mockResolvedValue(draft);

      const event = { target: { files: [file], value: 'movie.torrent' } } as unknown as Event;
      await component.handleFileSelected(event);

      expect(parseSpy).toHaveBeenCalledWith({
        source: 'manual',
        originalName: 'movie.torrent',
        bytes: [1, 2, 3],
      });
      expect(mockOpenFilesService.pendingDrafts()).toEqual([
        { draft, selected: { name: 'movie.torrent', bytes: [1, 2, 3] } },
      ]);
    });

    it('should log an error and reset the input when parsing fails', async () => {
      const file = new File(['dummy'], 'movie.torrent');
      (file as any).path = '/tmp/movie.torrent';

      vi.spyOn(window.bitbutler.torrent, 'parse')
        .mockClear()
        .mockRejectedValue(new Error('parse failed'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const event = { target: { files: [file], value: 'movie.torrent' } } as unknown as Event;
      await component.handleFileSelected(event);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(mockOpenFilesService.pendingDrafts()).toEqual([]);
      expect((event.target as HTMLInputElement).value).toBe('');
    });
  });
});
