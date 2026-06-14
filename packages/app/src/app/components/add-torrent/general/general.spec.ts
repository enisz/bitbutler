import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { of } from 'rxjs';
import { AddTorrentFormGroup, RootFolderMode } from '../../../models/add-torrent.model';
import { DEFAULT_GENERAL_SETTINGS } from '../../../models/general-settings.model';
import { GeneralSettingsService } from '../../../services/general-settings.service';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { ShareLimitValue } from '../../share-limit/share-limit';
import { TransferLimitValue } from '../../transfer-limit/transfer-limit';
import { AddTorrentGeneral } from './general';

function createForm(): AddTorrentFormGroup {
  return new FormGroup({
    file: new FormControl<string>('', { nonNullable: true }),
    magnetLinks: new FormControl<string>('', { nonNullable: true }),
    savepath: new FormControl<string | null>(null),
    rename: new FormControl<string | null>(null),
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
            getAppPreferences: vi.fn().mockResolvedValue({ save_path: '/downloads' }),
            getAllCategories: vi.fn().mockResolvedValue({}),
            addCategory: vi.fn().mockResolvedValue(undefined),
            getAllTags: vi.fn().mockResolvedValue([]),
            createTags: vi.fn().mockResolvedValue(undefined),
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

    expect(component.form().controls.rename.value).toBe('my-torrent');
  });

  describe('ensureCategoryExists', () => {
    it('should delegate to the nested CategorySelect and return true for an empty category', async () => {
      expect(await component.ensureCategoryExists()).toBe(true);
    });
  });

  describe('fieldset layout', () => {
    it('should render the Input and Storage fieldsets with their legends', () => {
      const legends: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll(
        'fieldset.bb-fieldset > legend',
      );

      expect(legends.length).toBe(2);
      expect(legends[0].textContent).toContain('components.add-torrent.label.input');
      expect(legends[1].textContent).toContain('components.add-torrent.label.storage');
    });

    it('should make the input-mode toggle full width and show a popover beside it', () => {
      const toggle: HTMLElement = fixture.nativeElement.querySelector('.btn-group');

      expect(toggle.classList.contains('w-100')).toBe(true);

      // 3 popovers defined directly in general.html (input-mode, file/links, name)
      // plus 1 each from the nested save-path/category/tag select components.
      expect(fixture.nativeElement.querySelectorAll('bb-popover').length).toBe(6);
    });
  });

  describe('rename validation feedback', () => {
    it('should show the required message when the rename control has a required error', () => {
      component.form().controls.rename.setErrors({ required: true });
      component.form().controls.rename.markAsDirty();
      fixture.detectChanges();

      const messages: NodeListOf<HTMLElement> =
        fixture.nativeElement.querySelectorAll('.invalid-feedback');

      expect(messages.length).toBe(1);
      expect(messages[0].textContent).toContain('general.form.feedback.required');
      expect(messages[0].textContent).not.toContain('general.form.feedback.pattern');
    });

    it('should show the pattern message when the rename control has a pattern error', () => {
      component.form().controls.rename.setErrors({ pattern: true });
      component.form().controls.rename.markAsDirty();
      fixture.detectChanges();

      const messages: NodeListOf<HTMLElement> =
        fixture.nativeElement.querySelectorAll('.invalid-feedback');

      expect(messages.length).toBe(1);
      expect(messages[0].textContent).toContain('general.form.feedback.pattern');
      expect(messages[0].textContent).not.toContain('general.form.feedback.required');
    });

    it('should not show any validation message when the rename control is valid', () => {
      expect(fixture.nativeElement.querySelectorAll('.invalid-feedback').length).toBe(0);
    });

    it('should show the required message when the rename control is touched but not dirty', () => {
      component.form().controls.rename.setErrors({ required: true });
      component.form().controls.rename.markAsTouched();
      fixture.detectChanges();

      const messages: NodeListOf<HTMLElement> =
        fixture.nativeElement.querySelectorAll('.invalid-feedback');

      expect(messages.length).toBe(1);
      expect(messages[0].textContent).toContain('general.form.feedback.required');
    });
  });
});
