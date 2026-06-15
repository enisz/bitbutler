import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { AddTorrentFormGroup, RootFolderMode } from '../../../models/add-torrent.model';
import { ShareLimitValue } from '../../share-limit/share-limit';
import { TransferLimitValue } from '../../transfer-limit/transfer-limit';
import { AddTorrentOptions } from './options';

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

describe('AddTorrentOptions', () => {
  let component: AddTorrentOptions;
  let fixture: ComponentFixture<AddTorrentOptions>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddTorrentOptions],
    }).compileComponents();

    fixture = TestBed.createComponent(AddTorrentOptions);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('form', createForm());
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not wrap the switches in a fieldset', () => {
    expect(fixture.nativeElement.querySelector('fieldset')).toBeNull();
  });

  it('should show a popover for each option switch plus the root folder field', () => {
    expect(fixture.nativeElement.querySelectorAll('bb-popover').length).toBe(6);
  });

  describe('root folder field', () => {
    it('should render the ng-select with a floating label and a popover beside it', () => {
      const select: HTMLElement = fixture.nativeElement.querySelector('#root_folder');
      const floatingGroup = select.closest('.form-floating');

      expect(floatingGroup?.querySelector('label[for="root_folder"]')).toBeTruthy();
      expect(floatingGroup?.closest('.col-11')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.col-1 bb-popover')).toBeTruthy();
    });

    it('should expose three root folder options', () => {
      expect(component.rootFolderOptions.map((option) => option.value)).toEqual([
        'unset',
        'true',
        'false',
      ]);
    });
  });

  it('should toggle skip_checking via the form', () => {
    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector('#skip_checking');
    checkbox.click();
    fixture.detectChanges();

    expect(component.form().controls.skip_checking.value).toBe(true);
  });

  it('should toggle paused via the form', () => {
    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector('#paused');
    checkbox.click();
    fixture.detectChanges();

    expect(component.form().controls.paused.value).toBe(true);
  });

  it('should toggle autoTMM via the form', () => {
    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector('#autoTMM');
    checkbox.click();
    fixture.detectChanges();

    expect(component.form().controls.autoTMM.value).toBe(true);
  });

  it('should toggle sequentialDownload via the form', () => {
    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector('#sequentialDownload');
    checkbox.click();
    fixture.detectChanges();

    expect(component.form().controls.sequentialDownload.value).toBe(true);
  });

  it('should toggle firstLastPiecePrio via the form', () => {
    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector('#firstLastPiecePrio');
    checkbox.click();
    fixture.detectChanges();

    expect(component.form().controls.firstLastPiecePrio.value).toBe(true);
  });
});
