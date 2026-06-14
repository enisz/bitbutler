import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { AddTorrentFormGroup, RootFolderMode } from '../../../models/add-torrent.model';
import { ShareLimitValue } from '../../share-limit/share-limit';
import { TransferLimitValue } from '../../transfer-limit/transfer-limit';
import { AddTorrentLimits } from './limits';

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
});
