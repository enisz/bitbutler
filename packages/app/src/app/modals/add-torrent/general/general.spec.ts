import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { of } from 'rxjs';
import { ShareLimitValue } from '../../../components/share-limit/share-limit';
import { TransferLimitValue } from '../../../components/transfer-limit/transfer-limit';
import { AddTorrentFormGroup, RootFolderMode } from '../../../models/add-torrent.model';
import { DEFAULT_GENERAL_SETTINGS } from '../../../models/general-settings.model';
import { GeneralSettingsService } from '../../../services/general-settings.service';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { AddTorrentGeneral } from './general';

function createForm(): AddTorrentFormGroup {
  return new FormGroup({
    fileGroup: new FormGroup({
      file: new FormControl<string>('', { nonNullable: true }),
      rename: new FormControl<string | null>(null),
    }),
    linkGroup: new FormGroup({
      magnetLinks: new FormControl<string>('', { nonNullable: true }),
      rename: new FormControl<string | null>(null),
    }),
    folderGroup: new FormGroup({
      folder: new FormControl<string>('', { nonNullable: true }),
      recursive: new FormControl<boolean>(false, { nonNullable: true }),
    }),
    savepath: new FormControl<string | null>(null),
    paused: new FormControl<boolean>(false, { nonNullable: true }),
    category: new FormControl<string | null>(null),
    root_folder: new FormControl<RootFolderMode>('unset', { nonNullable: true }),
    tags: new FormControl<string[] | null>(null),
    skip_checking: new FormControl<boolean>(false, { nonNullable: true }),
    sequentialDownload: new FormControl<boolean>(false, { nonNullable: true }),
    firstLastPiecePrio: new FormControl<boolean>(false, { nonNullable: true }),
    transferRateLimits: new FormControl<TransferLimitValue | null>(null),
    shareLimits: new FormControl<ShareLimitValue | null>(null),
    autoTMM: new FormControl<boolean>(false, { nonNullable: true }),
  });
}

describe('AddTorrentGeneral', () => {
  let component: AddTorrentGeneral;
  let fixture: ComponentFixture<AddTorrentGeneral>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddTorrentGeneral],
      providers: [
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: TorrentStoreService, useValue: { torrentsArray: signal([]) } },
        {
          provide: GeneralSettingsService,
          useValue: {
            load: vi.fn().mockResolvedValue({}),
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
              categories: vi.fn().mockResolvedValue({}),
              createCategory: vi.fn().mockResolvedValue(undefined),
              tags: vi.fn().mockResolvedValue([]),
              createTags: vi.fn().mockResolvedValue(undefined),
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddTorrentGeneral);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('form', createForm());
    fixture.componentRef.setInput('inputMode', 'file');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show the file picker in file mode', () => {
    expect(fixture.nativeElement.querySelector('#file_browser')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#magnet_links')).toBeFalsy();
  });

  it('should show the magnet links textarea in link mode', () => {
    fixture.componentRef.setInput('inputMode', 'link');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#magnet_links')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#file_browser')).toBeFalsy();
  });

  it('should emit inputModeChange when the link toggle is selected', () => {
    const emitSpy = vi.spyOn(component.inputModeChange, 'emit');

    const linkRadio: HTMLInputElement = fixture.nativeElement.querySelector('#inputMode_link');
    linkRadio.dispatchEvent(new Event('change'));

    expect(emitSpy).toHaveBeenCalledWith('link');
  });

  it('should emit fileSelected when the file input changes', () => {
    const emitSpy = vi.spyOn(component.fileSelected, 'emit');

    const fileInput: HTMLInputElement = fixture.nativeElement.querySelector('input[type="file"]');
    const event = new Event('change');
    fileInput.dispatchEvent(event);

    expect(emitSpy).toHaveBeenCalledWith(event);
  });

  it('should bind the rename field to the form', () => {
    const renameInput: HTMLInputElement = fixture.nativeElement.querySelector('#rename');
    renameInput.value = 'my-torrent';
    renameInput.dispatchEvent(new Event('input'));

    expect(component.form().controls.fileGroup.controls.rename.value).toBe('my-torrent');
  });

  describe('ensureCategoryExists', () => {
    it('should delegate to the nested CategorySelect and return true for an empty category', async () => {
      expect(await component.ensureCategoryExists()).toBe(true);
    });
  });

  describe('defaultSavePath', () => {
    it('should resolve to the preferences save_path after construction', async () => {
      await fixture.whenStable();
      expect(component.defaultSavePath()).toBe('/downloads');
    });
  });

  describe('size field', () => {
    it('should show the selected file size in file mode', () => {
      fixture.componentRef.setInput('fileStats', { totalSize: 1000, selectedSize: 500 });
      fixture.detectChanges();

      const sizeInput: HTMLInputElement = fixture.nativeElement.querySelector('#torrent_size');
      expect(sizeInput.value).toBe('500 B');
    });

    it('should show a dash in file mode before any file is loaded', () => {
      const sizeInput: HTMLInputElement = fixture.nativeElement.querySelector('#torrent_size');
      expect(sizeInput.value).toBe('-');
    });

    it('should show a dash in link mode', () => {
      fixture.componentRef.setInput('inputMode', 'link');
      fixture.detectChanges();

      const sizeInput: HTMLInputElement = fixture.nativeElement.querySelector('#torrent_size');
      expect(sizeInput.value).toBe('-');
    });

    it('should show the folder picker selected total size in folder mode', () => {
      fixture.componentRef.setInput('inputMode', 'folder');
      fixture.detectChanges();

      const picker = component['folderPicker']() as any;
      picker.rows.set([
        {
          path: '/downloads/a.torrent',
          relativePath: 'a.torrent',
          name: 'A',
          size: 500,
          fileCount: 1,
          folderCount: 0,
          state: 'new',
          hash: 'a-hash',
        },
        {
          path: '/downloads/b.torrent',
          relativePath: 'b.torrent',
          name: 'B',
          size: 250,
          fileCount: 1,
          folderCount: 0,
          state: 'new',
          hash: 'b-hash',
        },
      ]);
      picker.selectedPaths.set(new Set(['/downloads/a.torrent', '/downloads/b.torrent']));
      fixture.detectChanges();

      const sizeInput: HTMLInputElement = fixture.nativeElement.querySelector('#torrent_size');
      expect(sizeInput.value).toBe('750 B');
    });

    it('should always show the free-space field regardless of input mode', () => {
      fixture.componentRef.setInput('freeSpace', 2000);
      fixture.componentRef.setInput('inputMode', 'link');
      fixture.detectChanges();

      const freeSpaceInput: HTMLInputElement = fixture.nativeElement.querySelector('#free_space');
      expect(freeSpaceInput.value).toBe('1.95 KB');
    });
  });

  describe('fieldset layout', () => {
    it('should render the Input and Torrent fieldsets with their legends', () => {
      const legends: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll(
        'fieldset.bb-fieldset > legend',
      );

      expect(legends.length).toBe(2);
      expect(legends[0].textContent).toContain('components.add-torrent.label.input');
      expect(legends[1].textContent).toContain('components.add-torrent.label.torrent');
    });

    it('should make the input-mode toggle full width and show a popover beside it', () => {
      const toggle: HTMLElement = fixture.nativeElement.querySelector('.btn-group');

      expect(toggle.classList.contains('w-100')).toBe(true);

      // 6 popovers defined directly in general.html (input-mode, file/links, name, size,
      // free-space, save-path) plus 1 each from the nested category/tag select components.
      expect(fixture.nativeElement.querySelectorAll('bb-popover').length).toBe(8);
    });

    it('should render the input-mode toggle as plain text with no icons', () => {
      const toggle: HTMLElement = fixture.nativeElement.querySelector('.btn-group');
      const labels: HTMLLabelElement[] = Array.from(toggle.querySelectorAll('label.btn'));

      expect(labels.length).toBe(3);
      expect(toggle.querySelectorAll('bb-btn-content, fa-icon').length).toBe(0);
      expect(labels.map((label) => label.textContent?.trim())).toEqual([
        'components.add-torrent.input-mode.file',
        'components.add-torrent.input-mode.link',
        'components.add-torrent.input-mode.folder',
      ]);
    });

    it('should give the folder picker the full row width with no adjacent popover', () => {
      fixture.componentRef.setInput('inputMode', 'folder');
      fixture.detectChanges();

      const picker: HTMLElement = fixture.nativeElement.querySelector(
        'app-add-torrent-folder-picker',
      );
      expect(picker.parentElement?.classList.contains('col-12')).toBe(true);

      // In folder mode the "Torrent" fieldset's rename/name-popover never renders (guarded by
      // `inputMode() !== 'folder'`), but the size/free-space popovers now render unconditionally,
      // so 4 direct popovers remain (input-mode, size, free-space, save-path) - the removed
      // folder popover is not one of them - plus 1 each from the nested category/tag select
      // components. The folder picker's own "recursive" toggle no longer uses a popover (it has
      // an inline sub-label instead), so no extra popover comes from it.
      expect(fixture.nativeElement.querySelectorAll('bb-popover').length).toBe(6);
    });
  });

  describe('rename validation feedback', () => {
    it('should show the pattern message when the fileGroup rename control has a pattern error', () => {
      component.form().controls.fileGroup.controls.rename.setErrors({ pattern: true });
      component.form().controls.fileGroup.controls.rename.markAsDirty();
      fixture.detectChanges();

      const messages: NodeListOf<HTMLElement> =
        fixture.nativeElement.querySelectorAll('.invalid-feedback');

      expect(messages.length).toBe(1);
      expect(messages[0].textContent).toContain('general.form.feedback.pattern');
    });

    it('should not show any validation message when the fileGroup rename control is valid', () => {
      expect(fixture.nativeElement.querySelectorAll('.invalid-feedback').length).toBe(0);
    });

    it('should show the pattern message when the linkGroup rename control has a pattern error', () => {
      fixture.componentRef.setInput('inputMode', 'link');
      fixture.detectChanges();

      component.form().controls.linkGroup.controls.rename.setErrors({ pattern: true });
      component.form().controls.linkGroup.controls.rename.markAsDirty();
      fixture.detectChanges();

      const messages: NodeListOf<HTMLElement> =
        fixture.nativeElement.querySelectorAll('.invalid-feedback');

      expect(messages.length).toBe(1);
      expect(messages[0].textContent).toContain('general.form.feedback.pattern');
    });

    it('should show the pattern message when the rename control is touched but not dirty', () => {
      component.form().controls.fileGroup.controls.rename.setErrors({ pattern: true });
      component.form().controls.fileGroup.controls.rename.markAsTouched();
      fixture.detectChanges();

      const messages: NodeListOf<HTMLElement> =
        fixture.nativeElement.querySelectorAll('.invalid-feedback');

      expect(messages.length).toBe(1);
      expect(messages[0].textContent).toContain('general.form.feedback.pattern');
    });
  });

  describe('link counter', () => {
    it('should show "no links" before the textarea is touched', () => {
      fixture.componentRef.setInput('inputMode', 'link');
      fixture.detectChanges();

      const counter: HTMLElement = fixture.nativeElement.querySelector('.link-count-summary');
      expect(counter.textContent).toContain('components.add-torrent.add-form.no-links');
    });

    it('should count non-empty lines as links when the textarea changes', () => {
      fixture.componentRef.setInput('inputMode', 'link');
      fixture.detectChanges();

      const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('#magnet_links');
      textarea.value = 'magnet:?xt=urn:btih:aaa\nmagnet:?xt=urn:btih:bbb\n';
      textarea.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const counter: HTMLElement = fixture.nativeElement.querySelector('.link-count-summary');
      expect(counter.textContent).toContain('components.add-torrent.add-form.link-count');
      expect(component.linkCount()).toBe(2);
    });

    it('should ignore blank lines when counting links', () => {
      fixture.componentRef.setInput('inputMode', 'link');
      fixture.detectChanges();

      const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('#magnet_links');
      textarea.value = 'magnet:?xt=urn:btih:aaa\n\n   \nmagnet:?xt=urn:btih:bbb';
      textarea.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(component.linkCount()).toBe(2);
    });

    it('should go back to "no links" when the textarea is cleared', () => {
      fixture.componentRef.setInput('inputMode', 'link');
      fixture.detectChanges();

      const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('#magnet_links');
      textarea.value = 'magnet:?xt=urn:btih:aaa';
      textarea.dispatchEvent(new Event('input'));
      textarea.value = '';
      textarea.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const counter: HTMLElement = fixture.nativeElement.querySelector('.link-count-summary');
      expect(counter.textContent).toContain('components.add-torrent.add-form.no-links');
    });
  });

  it('should show the folder picker in folder mode', () => {
    fixture.componentRef.setInput('inputMode', 'folder');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-add-torrent-folder-picker')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#file_browser')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('#magnet_links')).toBeFalsy();
  });

  it('should hide the rename input in folder mode', () => {
    fixture.componentRef.setInput('inputMode', 'folder');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#rename')).toBeFalsy();
  });

  it('should emit inputModeChange(folder) when the folder toggle is selected', () => {
    const emitSpy = vi.spyOn(component.inputModeChange, 'emit');

    const folderRadio: HTMLInputElement = fixture.nativeElement.querySelector('#inputMode_folder');
    folderRadio.dispatchEvent(new Event('change'));

    expect(emitSpy).toHaveBeenCalledWith('folder');
  });

  describe('getSelectedFolderEntries', () => {
    it('should return an empty array when the folder picker has not rendered yet', () => {
      expect(component.getSelectedFolderEntries()).toEqual([]);
    });

    it('should delegate to the folder picker once in folder mode', () => {
      fixture.componentRef.setInput('inputMode', 'folder');
      fixture.detectChanges();

      const entry = {
        path: '/downloads/a.torrent',
        relativePath: 'a.torrent',
        name: 'A',
        size: 1,
        fileCount: 1,
        folderCount: 0,
        state: 'new' as const,
        hash: 'abc',
      };
      (component['folderPicker']() as any).selectedEntries = () => [entry];

      expect(component.getSelectedFolderEntries()).toEqual([entry]);
    });
  });

  describe('markFolderEntryAdded / markFolderEntryFailed', () => {
    it('should do nothing when the folder picker has not rendered yet', () => {
      expect(() => component.markFolderEntryAdded('/downloads/a.torrent')).not.toThrow();
      expect(() => component.markFolderEntryFailed('/downloads/a.torrent', 'oops')).not.toThrow();
    });

    it('should delegate to the folder picker once in folder mode', () => {
      fixture.componentRef.setInput('inputMode', 'folder');
      fixture.detectChanges();

      const markAdded = vi.fn();
      const markFailed = vi.fn();
      (component['folderPicker']() as any).markAdded = markAdded;
      (component['folderPicker']() as any).markFailed = markFailed;

      component.markFolderEntryAdded('/downloads/a.torrent');
      component.markFolderEntryFailed('/downloads/b.torrent', 'network error');

      expect(markAdded).toHaveBeenCalledWith('/downloads/a.torrent');
      expect(markFailed).toHaveBeenCalledWith('/downloads/b.torrent', 'network error');
    });
  });
});
