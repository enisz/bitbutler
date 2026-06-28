import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { TorrentDraft } from '@bitbutler/shared';
import { BbFileTree, FileTreeSaveEvent } from '../../../components/bb-file-tree/bb-file-tree';
import { ConfirmService } from '../../../services/confirm.service';
import { AddTorrentFiles } from './files';

const draft: TorrentDraft = {
  source: 'manual',
  receivedAt: Date.now(),
  torrent: {
    name: 'test-torrent',
    totalSize: 100,
    files: [{ path: 'file1.txt', length: 100 }],
  },
};

describe('AddTorrentFiles', () => {
  let component: AddTorrentFiles;
  let fixture: ComponentFixture<AddTorrentFiles>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddTorrentFiles],
      providers: [
        { provide: ConfirmService, useValue: { confirm: vi.fn().mockResolvedValue(true) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddTorrentFiles);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should not render the file tree when draft is null', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-bb-file-tree')).toBeFalsy();
  });

  it('should render the file tree with the draft files', () => {
    fixture.componentRef.setInput('draft', draft);
    fixture.detectChanges();

    const fileTree = fixture.debugElement.query(By.directive(BbFileTree))
      .componentInstance as BbFileTree;
    expect(fileTree.files()).toEqual(draft.torrent!.files);
  });

  it('should re-emit saved from the nested file tree', () => {
    fixture.componentRef.setInput('draft', draft);
    fixture.detectChanges();

    const saveEvent: FileTreeSaveEvent = { files: draft.torrent!.files, renames: [] };
    let emitted: FileTreeSaveEvent | undefined;
    component.saved.subscribe((event) => (emitted = event));

    const fileTree = fixture.debugElement.query(By.directive(BbFileTree))
      .componentInstance as BbFileTree;
    fileTree.saved.emit(saveEvent);

    expect(emitted).toEqual(saveEvent);
  });

  it('should re-emit editModeChange from the nested file tree', () => {
    fixture.componentRef.setInput('draft', draft);
    fixture.detectChanges();

    let emitted: boolean | undefined;
    component.editModeChange.subscribe((value) => (emitted = value));

    const fileTree = fixture.debugElement.query(By.directive(BbFileTree))
      .componentInstance as BbFileTree;
    fileTree.editModeChange.emit(true);

    expect(emitted).toBe(true);
  });
});
