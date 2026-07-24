import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import type { TorrentDraft } from '@bitbutler/shared';
import { AddTorrentFormGroup } from '../../../../models/add-torrent.model';
import { TorrentStoreService } from '../../../../services/torrent-store.service';
import { AddTorrentFolderPicker } from './folder-picker';

function createForm(folder = '', recursive = false): AddTorrentFormGroup {
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
      folder: new FormControl<string>(folder, { nonNullable: true }),
      recursive: new FormControl<boolean>(recursive, { nonNullable: true }),
    }),
    savepath: new FormControl<string | null>(null),
    paused: new FormControl<boolean>(false, { nonNullable: true }),
    category: new FormControl<string | null>(null),
    root_folder: new FormControl<'unset' | 'true' | 'false'>('unset', { nonNullable: true }),
    tags: new FormControl<string[] | null>(null),
    skip_checking: new FormControl<boolean>(false, { nonNullable: true }),
    sequentialDownload: new FormControl<boolean>(false, { nonNullable: true }),
    firstLastPiecePrio: new FormControl<boolean>(false, { nonNullable: true }),
    transferRateLimits: new FormControl(null),
    shareLimits: new FormControl(null),
    autoTMM: new FormControl<boolean>(false, { nonNullable: true }),
  }) as unknown as AddTorrentFormGroup;
}

function draft(overrides: Partial<NonNullable<TorrentDraft['torrent']>> = {}): TorrentDraft {
  return {
    source: 'manual',
    receivedAt: Date.now(),
    torrent: {
      name: 'Movie',
      totalSize: 100,
      files: [{ path: 'movie.mkv', length: 100 }],
      infoHashV1: 'abc123',
      ...overrides,
    },
  };
}

describe('AddTorrentFolderPicker', () => {
  let component: AddTorrentFolderPicker;
  let fixture: ComponentFixture<AddTorrentFolderPicker>;
  let torrentsMap: ReturnType<typeof signal<Map<string, unknown>>>;

  beforeEach(async () => {
    torrentsMap = signal(new Map());

    await TestBed.configureTestingModule({
      imports: [AddTorrentFolderPicker],
      providers: [{ provide: TorrentStoreService, useValue: { torrentsMap } }],
    }).compileComponents();

    fixture = TestBed.createComponent(AddTorrentFolderPicker);
    component = fixture.componentInstance;
  });

  function init(folder = '/downloads', recursive = false) {
    fixture.componentRef.setInput('form', createForm(folder, recursive));
    fixture.detectChanges();
  }

  it('should default the folder control to the Downloads path when empty on init', async () => {
    vi.spyOn(window.bitbutler.electron, 'getDownloadsPath').mockResolvedValue(
      '/home/user/Downloads',
    );
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([]);

    init('');
    await fixture.whenStable();

    expect(component.form().controls.folderGroup.controls.folder.value).toBe(
      '/home/user/Downloads',
    );
  });

  it('should not overwrite a persisted folder value on init', async () => {
    const scanSpy = vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([]);
    const downloadsSpy = vi.spyOn(window.bitbutler.electron, 'getDownloadsPath');

    init('/saved/folder');
    await fixture.whenStable();

    expect(downloadsSpy).not.toHaveBeenCalled();
    expect(scanSpy).toHaveBeenCalledWith({ path: '/saved/folder', recursive: false });
  });

  it('should populate rows from scanFolder + parse, marking a known hash as exists', async () => {
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
      { path: '/downloads/a.torrent', relativePath: 'a.torrent' },
      { path: '/downloads/b.torrent', relativePath: 'b.torrent' },
    ]);
    vi.spyOn(window.bitbutler.torrent, 'parse')
      .mockResolvedValueOnce(draft({ infoHashV1: 'known-hash' }))
      .mockResolvedValueOnce(draft({ infoHashV1: 'new-hash' }));
    torrentsMap.set(new Map([['known-hash', {}]]));

    init('/downloads');
    await fixture.whenStable();

    expect(component.rows()).toEqual([
      expect.objectContaining({
        path: '/downloads/a.torrent',
        state: 'exists',
        hash: 'known-hash',
      }),
      expect.objectContaining({ path: '/downloads/b.torrent', state: 'new', hash: 'new-hash' }),
    ]);
  });

  it('should mark a parse failure as state error with the error message', async () => {
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
      { path: '/downloads/bad.torrent', relativePath: 'bad.torrent' },
    ]);
    vi.spyOn(window.bitbutler.torrent, 'parse').mockResolvedValue({
      source: 'manual',
      receivedAt: Date.now(),
      error: { message: 'Invalid torrent file', code: 'PARSE_FAILED' },
    });

    init('/downloads');
    await fixture.whenStable();

    expect(component.rows()).toEqual([
      expect.objectContaining({
        path: '/downloads/bad.torrent',
        state: 'error',
        errorMessage: 'Invalid torrent file',
        hash: null,
      }),
    ]);
  });

  it('should reuse a cached entry on a second scan without re-parsing the same path', async () => {
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
      { path: '/downloads/a.torrent', relativePath: 'a.torrent' },
    ]);
    const parseSpy = vi.spyOn(window.bitbutler.torrent, 'parse').mockResolvedValue(draft());

    init('/downloads');
    await fixture.whenStable();
    expect(parseSpy).toHaveBeenCalledTimes(1);

    await component.refresh();
    expect(parseSpy).toHaveBeenCalledTimes(1);
  });

  it('should pre-select only new-state rows after a scan', async () => {
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
      { path: '/downloads/a.torrent', relativePath: 'a.torrent' },
      { path: '/downloads/b.torrent', relativePath: 'b.torrent' },
    ]);
    vi.spyOn(window.bitbutler.torrent, 'parse')
      .mockResolvedValueOnce(draft({ infoHashV1: 'known-hash' }))
      .mockResolvedValueOnce(draft({ infoHashV1: 'new-hash' }));
    torrentsMap.set(new Map([['known-hash', {}]]));

    init('/downloads');
    await fixture.whenStable();

    expect(component.selectedPaths()).toEqual(new Set(['/downloads/b.torrent']));
    expect(component.selectedEntries()).toEqual([
      expect.objectContaining({ path: '/downloads/b.torrent' }),
    ]);
  });

  it('should rescan when the recursive control changes after the first scan, not before', async () => {
    const scanSpy = vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([]);

    init('/downloads');
    await fixture.whenStable();
    expect(scanSpy).toHaveBeenCalledTimes(1);

    component.form().controls.folderGroup.controls.recursive.setValue(true);
    await fixture.whenStable();

    expect(scanSpy).toHaveBeenCalledTimes(2);
    expect(scanSpy).toHaveBeenLastCalledWith({ path: '/downloads', recursive: true });
  });

  it('browse() should open the dialog with the current folder as defaultPath and rescan on selection', async () => {
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([]);
    const dialogSpy = vi
      .spyOn(window.bitbutler.electron, 'showOpenDialog')
      .mockResolvedValue('/new/folder');

    init('/downloads');
    await fixture.whenStable();

    await component.browse();

    expect(dialogSpy).toHaveBeenCalledWith('/downloads');
    expect(component.form().controls.folderGroup.controls.folder.value).toBe('/new/folder');
  });

  it('browse() should do nothing when the dialog is dismissed', async () => {
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([]);
    vi.spyOn(window.bitbutler.electron, 'showOpenDialog').mockResolvedValue(undefined as any);

    init('/downloads');
    await fixture.whenStable();

    await component.browse();

    expect(component.form().controls.folderGroup.controls.folder.value).toBe('/downloads');
  });

  it('renameEntry should update the row and keep the change on a cached refresh', async () => {
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
      { path: '/downloads/a.torrent', relativePath: 'a.torrent' },
    ]);
    vi.spyOn(window.bitbutler.torrent, 'parse').mockResolvedValue(draft());

    init('/downloads');
    await fixture.whenStable();

    component.renameEntry('/downloads/a.torrent', 'Custom Name');
    expect(component.rows()[0].name).toBe('Custom Name');

    await component.refresh();
    expect(component.rows()[0].name).toBe('Custom Name');
  });

  it('should set scanError and clear rows when scanFolder rejects', async () => {
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockRejectedValue(new Error('ENOENT'));

    init('/missing');
    await fixture.whenStable();

    expect(component.scanError()).toContain('ENOENT');
    expect(component.rows()).toEqual([]);
  });
});
