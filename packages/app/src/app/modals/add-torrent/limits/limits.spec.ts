import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { ShareLimitValue } from '../../../components/share-limit/share-limit';
import { TransferLimitValue } from '../../../components/transfer-limit/transfer-limit';
import { AddTorrentFormGroup, RootFolderMode } from '../../../models/add-torrent.model';
import { AddTorrentLimits } from './limits';

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

describe('AddTorrentLimits', () => {
  let component: AddTorrentLimits;
  let fixture: ComponentFixture<AddTorrentLimits>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddTorrentLimits],
    }).compileComponents();

    fixture = TestBed.createComponent(AddTorrentLimits);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('form', createForm());
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the transfer rate limit control', () => {
    expect(fixture.nativeElement.querySelector('app-transfer-limit')).toBeTruthy();
  });

  it('should render the share limit control', () => {
    expect(fixture.nativeElement.querySelector('app-share-limit')).toBeTruthy();
  });

  it('should wrap each limit control in a bb-fieldset with the correct legend', () => {
    const fieldsets: NodeListOf<HTMLElement> =
      fixture.nativeElement.querySelectorAll('fieldset.bb-fieldset');

    expect(fieldsets.length).toBe(2);
    expect(fieldsets[0].querySelector('legend')?.textContent).toContain(
      'components.add-torrent.label.transfer-rate-limits',
    );
    expect(fieldsets[0].querySelector('app-transfer-limit')).toBeTruthy();
    expect(fieldsets[1].querySelector('legend')?.textContent).toContain(
      'components.add-torrent.label.share-limits',
    );
    expect(fieldsets[1].querySelector('app-share-limit')).toBeTruthy();
  });
});
