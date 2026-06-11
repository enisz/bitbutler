import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TorrentFileEntry } from '@bitbutler/shared';
import { ConfirmService } from '../../services/confirm.service';
import { BbFileTree, BbFileTreeNode, FileTreeSaveEvent } from './bb-file-tree';

const makeFile = (path: string, priority = 1, length = 1000): TorrentFileEntry => ({
  path,
  priority,
  length,
});

describe('BbFileTree', () => {
  let component: BbFileTree;
  let fixture: ComponentFixture<BbFileTree>;
  let mockConfirmService: { confirm: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockConfirmService = { confirm: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [BbFileTree],
      providers: [{ provide: ConfirmService, useValue: mockConfirmService }],
    }).compileComponents();

    fixture = TestBed.createComponent(BbFileTree);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('files', []);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('hasChild', () => {
    it('should return true for directory nodes', () => {
      const node: BbFileTreeNode = {
        name: 'dir',
        fullPath: 'dir',
        kind: 'dir',
        children: [{ name: 'file.txt', fullPath: 'dir/file.txt', kind: 'file' }],
      };
      expect(component.hasChild(0, node)).toBe(true);
    });

    it('should return false for nodes without children', () => {
      const node: BbFileTreeNode = { name: 'file.txt', fullPath: 'file.txt', kind: 'file' };
      expect(component.hasChild(0, node)).toBe(false);
    });
  });

  describe('getNodeDepth', () => {
    it('should return 0 for root-level nodes', () => {
      const node: BbFileTreeNode = { name: 'file.txt', fullPath: 'file.txt', kind: 'file' };
      expect(component.getNodeDepth(node)).toBe(0);
    });

    it('should return 1 for one level deep', () => {
      const node: BbFileTreeNode = { name: 'file.txt', fullPath: 'dir/file.txt', kind: 'file' };
      expect(component.getNodeDepth(node)).toBe(1);
    });

    it('should return 2 for two levels deep', () => {
      const node: BbFileTreeNode = { name: 'f', fullPath: 'a/b/f', kind: 'file' };
      expect(component.getNodeDepth(node)).toBe(2);
    });
  });

  describe('tree stats after files change', () => {
    it('should compute totalFiles from provided files', () => {
      fixture.componentRef.setInput('files', [makeFile('a.txt'), makeFile('b.txt')]);
      fixture.detectChanges();
      expect(component.totalFiles()).toBe(2);
    });

    it('should compute totalSize from file lengths', () => {
      fixture.componentRef.setInput('files', [
        makeFile('a.txt', 1, 500),
        makeFile('b.txt', 1, 300),
      ]);
      fixture.detectChanges();
      expect(component.totalSize()).toBe(800);
    });

    it('should count only selected files in selectedSize', () => {
      fixture.componentRef.setInput('files', [
        makeFile('a.txt', 1, 500),
        makeFile('b.txt', 0, 300),
      ]);
      fixture.detectChanges();
      expect(component.selectedSize()).toBe(500);
    });

    it('should count only downloading files', () => {
      fixture.componentRef.setInput('files', [
        makeFile('a.txt', 1),
        makeFile('b.txt', 0),
        makeFile('c.txt', 1),
      ]);
      fixture.detectChanges();
      expect(component.downloadCount()).toBe(2);
    });
  });

  describe('isFolderSelected / isFolderEmpty / isFolderIndeterminate', () => {
    let dirNode: BbFileTreeNode;

    beforeEach(() => {
      const f1 = makeFile('dir/a.txt', 1);
      const f2 = makeFile('dir/b.txt', 1);
      dirNode = {
        name: 'dir',
        fullPath: 'dir',
        kind: 'dir',
        children: [
          { name: 'a.txt', fullPath: 'dir/a.txt', kind: 'file', file: f1 },
          { name: 'b.txt', fullPath: 'dir/b.txt', kind: 'file', file: f2 },
        ],
      };
    });

    it('should mark folder as selected when all files have priority > 0', () => {
      expect(component.isFolderSelected(dirNode)).toBe(true);
    });

    it('should mark folder as empty when all files have priority 0', () => {
      dirNode.children![0].file!.priority = 0;
      dirNode.children![1].file!.priority = 0;
      expect(component.isFolderEmpty(dirNode)).toBe(true);
    });

    it('should mark folder as indeterminate when some files have priority 0', () => {
      dirNode.children![0].file!.priority = 0;
      expect(component.isFolderIndeterminate(dirNode)).toBe(true);
    });
  });

  describe('getDominantFolderPriority', () => {
    it('should return 1 when no files have priority > 0', () => {
      const node: BbFileTreeNode = {
        name: 'dir',
        fullPath: 'dir',
        kind: 'dir',
        children: [{ name: 'f', fullPath: 'dir/f', kind: 'file', file: makeFile('dir/f', 0) }],
      };
      expect(component.getDominantFolderPriority(node)).toBe(1);
    });

    it('should return the common priority when all files share it', () => {
      const node: BbFileTreeNode = {
        name: 'dir',
        fullPath: 'dir',
        kind: 'dir',
        children: [
          { name: 'a', fullPath: 'dir/a', kind: 'file', file: makeFile('dir/a', 6) },
          { name: 'b', fullPath: 'dir/b', kind: 'file', file: makeFile('dir/b', 6) },
        ],
      };
      expect(component.getDominantFolderPriority(node)).toBe(6);
    });

    it('should return 1 when files have mixed priorities', () => {
      const node: BbFileTreeNode = {
        name: 'dir',
        fullPath: 'dir',
        kind: 'dir',
        children: [
          { name: 'a', fullPath: 'dir/a', kind: 'file', file: makeFile('dir/a', 1) },
          { name: 'b', fullPath: 'dir/b', kind: 'file', file: makeFile('dir/b', 6) },
        ],
      };
      expect(component.getDominantFolderPriority(node)).toBe(1);
    });
  });

  describe('enterEditMode / cancelEdit / saveEdit', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('files', [makeFile('a.txt'), makeFile('b.txt')]);
      fixture.detectChanges();
    });

    it('should set editMode to true on enterEditMode', () => {
      component.enterEditMode();
      expect(component.editMode()).toBe(true);
    });

    it('should emit editModeChange(true) on enterEditMode', () => {
      const spy = vi.fn();
      component.editModeChange.subscribe(spy);
      component.enterEditMode();
      expect(spy).toHaveBeenCalledWith(true);
    });

    it('should set editMode to false on cancelEdit', async () => {
      component.enterEditMode();
      await component.cancelEdit();
      expect(component.editMode()).toBe(false);
    });

    it('should emit editModeChange(false) on cancelEdit', async () => {
      component.enterEditMode();
      const spy = vi.fn();
      component.editModeChange.subscribe(spy);
      await component.cancelEdit();
      expect(spy).toHaveBeenCalledWith(false);
    });

    it('should emit saved event on saveEdit', () => {
      component.enterEditMode();
      const spy = vi.fn();
      component.saved.subscribe(spy);
      component.saveEdit();
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ files: expect.any(Array) }));
    });

    it('should set editMode to false on saveEdit', () => {
      component.enterEditMode();
      component.saveEdit();
      expect(component.editMode()).toBe(false);
    });
  });

  describe('saveEdit renames', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('files', [makeFile('dir/a.txt'), makeFile('dir/b.txt')]);
      fixture.detectChanges();
    });

    it('should emit empty renames when no files were renamed', () => {
      component.enterEditMode();
      const spy = vi.fn();
      component.saved.subscribe(spy);
      component.saveEdit();
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ renames: [] }));
    });

    it('should emit genesis-to-current rename when a file is renamed', () => {
      component.enterEditMode();
      const fileNode = component.data[0].children![0];
      fileNode.name = 'z.txt';
      component.onFileNameChange(fileNode);

      const spy = vi.fn();
      component.saved.subscribe(spy);
      component.saveEdit();

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          renames: [{ oldPath: 'dir/a.txt', newPath: 'dir/z.txt' }],
        }),
      );
    });

    it('should emit correct rename after two edit sessions (multi-session bug)', () => {
      fixture.componentRef.setInput('files', [makeFile('a.txt')]);
      fixture.detectChanges();

      component.enterEditMode();
      const node = component.data[0];
      node.name = 'xxx.txt';
      component.onFileNameChange(node);
      component.saveEdit();

      component.enterEditMode();
      node.name = 'yyy.txt';
      component.onFileNameChange(node);

      const spy = vi.fn();
      component.saved.subscribe(spy);
      component.saveEdit();

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          renames: [{ oldPath: 'a.txt', newPath: 'yyy.txt' }],
        }),
      );
    });

    it('should emit one rename per file when a folder is renamed', () => {
      component.enterEditMode();
      const folderNode = component.data[0];
      folderNode.name = 'newdir';
      component.onFolderNameChange(folderNode);

      const spy = vi.fn();
      component.saved.subscribe(spy);
      component.saveEdit();

      const event = spy.mock.calls[0][0] as FileTreeSaveEvent;
      expect(event.renames).toHaveLength(2);
      expect(event.renames).toEqual(
        expect.arrayContaining([
          { oldPath: 'dir/a.txt', newPath: 'newdir/a.txt' },
          { oldPath: 'dir/b.txt', newPath: 'newdir/b.txt' },
        ]),
      );
    });
  });

  describe('sessionDirty', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('files', [makeFile('dir/a.txt'), makeFile('dir/b.txt')]);
      fixture.detectChanges();
      component.enterEditMode();
    });

    it('should be false after enterEditMode', () => {
      expect((component as any).sessionDirty).toBe(false);
    });

    it('should be true after onFileNameChange', () => {
      const fileNode = component.data[0].children![0];
      fileNode.name = 'z.txt';
      component.onFileNameChange(fileNode);
      expect((component as any).sessionDirty).toBe(true);
    });

    it('should be true after onFolderNameChange', () => {
      const folderNode = component.data[0];
      folderNode.name = 'other';
      component.onFolderNameChange(folderNode);
      expect((component as any).sessionDirty).toBe(true);
    });

    it('should be true after toggleFileSelection', () => {
      const fileNode = component.data[0].children![0];
      const event = { target: { checked: false } } as unknown as Event;
      component.toggleFileSelection(fileNode.file!, event);
      expect((component as any).sessionDirty).toBe(true);
    });

    it('should be true after toggleFolderSelection', () => {
      const folderNode = component.data[0];
      const event = { target: { checked: false } } as unknown as Event;
      component.toggleFolderSelection(folderNode, event);
      expect((component as any).sessionDirty).toBe(true);
    });

    it('should be true after setFolderPriority', () => {
      component.setFolderPriority(component.data[0], 6);
      expect((component as any).sessionDirty).toBe(true);
    });

    it('should reset to false on the next enterEditMode', () => {
      const fileNode = component.data[0].children![0];
      fileNode.name = 'z.txt';
      component.onFileNameChange(fileNode);
      expect((component as any).sessionDirty).toBe(true);

      component.saveEdit();
      component.enterEditMode();
      expect((component as any).sessionDirty).toBe(false);
    });
  });

  describe('cancelEdit confirm guard', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('files', [makeFile('a.txt')]);
      fixture.detectChanges();
      component.enterEditMode();
    });

    it('should skip confirm and cancel immediately when session is not dirty', async () => {
      await component.cancelEdit();
      expect(mockConfirmService.confirm).not.toHaveBeenCalled();
      expect(component.editMode()).toBe(false);
    });

    it('should show confirm when session is dirty', async () => {
      const node = component.data[0];
      node.name = 'z.txt';
      component.onFileNameChange(node);

      mockConfirmService.confirm.mockResolvedValue(true);
      await component.cancelEdit();

      expect(mockConfirmService.confirm).toHaveBeenCalledWith(
        'components.bb-file-tree.confirm.cancel.title',
        'components.bb-file-tree.confirm.cancel.message',
      );
      expect(component.editMode()).toBe(false);
    });

    it('should not cancel when user declines the confirm', async () => {
      const node = component.data[0];
      node.name = 'z.txt';
      component.onFileNameChange(node);

      mockConfirmService.confirm.mockResolvedValue(false);
      await component.cancelEdit();

      expect(component.editMode()).toBe(true);
    });
  });

  describe('file filtering', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('files', [
        makeFile('dir/alpha.txt'),
        makeFile('dir/beta.txt'),
        makeFile('other/gamma.txt'),
      ]);
      fixture.detectChanges();
    });

    it('should mark all nodes visible when filter is empty', () => {
      const dirNode = component.data.find((n) => n.name === 'dir')!;
      const fileNode = dirNode.children!.find((n) => n.name === 'alpha.txt')!;

      expect(component.isVisible(dirNode)).toBe(true);
      expect(component.isVisible(fileNode)).toBe(true);
    });

    it('should show matching files and their parent folders, hiding the rest', () => {
      component.onFilterInput('alpha');
      fixture.detectChanges();

      const dirNode = component.data.find((n) => n.name === 'dir')!;
      const alphaNode = dirNode.children!.find((n) => n.name === 'alpha.txt')!;
      const betaNode = dirNode.children!.find((n) => n.name === 'beta.txt')!;
      const otherNode = component.data.find((n) => n.name === 'other')!;

      expect(component.isVisible(dirNode)).toBe(true);
      expect(component.isVisible(alphaNode)).toBe(true);
      expect(component.isVisible(betaNode)).toBe(false);
      expect(component.isVisible(otherNode)).toBe(false);
    });

    it('should keep a matching folder visible without revealing non-matching children', () => {
      component.onFilterInput('dir');
      fixture.detectChanges();

      const dirNode = component.data.find((n) => n.name === 'dir')!;
      const alphaNode = dirNode.children!.find((n) => n.name === 'alpha.txt')!;
      const betaNode = dirNode.children!.find((n) => n.name === 'beta.txt')!;

      expect(component.isVisible(dirNode)).toBe(true);
      expect(component.isVisible(alphaNode)).toBe(false);
      expect(component.isVisible(betaNode)).toBe(false);
    });

    it('should match case-insensitively', () => {
      component.onFilterInput('ALPHA');
      fixture.detectChanges();

      const dirNode = component.data.find((n) => n.name === 'dir')!;
      const alphaNode = dirNode.children!.find((n) => n.name === 'alpha.txt')!;

      expect(component.isVisible(alphaNode)).toBe(true);
    });

    it('should report no matches when nothing matches the filter', () => {
      component.onFilterInput('zzz');
      fixture.detectChanges();

      expect(component.hasNoMatches()).toBe(true);
    });

    it('should not report no matches when the filter is empty', () => {
      expect(component.hasNoMatches()).toBe(false);
    });

    it('should not report no matches when there are matches', () => {
      component.onFilterInput('alpha');
      fixture.detectChanges();

      expect(component.hasNoMatches()).toBe(false);
    });

    it('should restore full visibility when the filter is cleared', () => {
      component.onFilterInput('alpha');
      fixture.detectChanges();

      component.clearFilter();
      fixture.detectChanges();

      const otherNode = component.data.find((n) => n.name === 'other')!;
      expect(component.filterText()).toBe('');
      expect(component.isVisible(otherNode)).toBe(true);
    });

    it('should not show a no-match message when there are matches', () => {
      component.onFilterInput('alpha');
      fixture.detectChanges();

      const message = fixture.nativeElement.querySelector('.bb-no-match');
      expect(message).toBeNull();
    });

    it('should show a no-match message when nothing matches the filter', () => {
      component.onFilterInput('zzz');
      fixture.detectChanges();

      const message = fixture.nativeElement.querySelector('.bb-no-match');
      expect(message).not.toBeNull();
    });

    it('should hide the no-match message once a match is found again', () => {
      component.onFilterInput('zzz');
      fixture.detectChanges();

      component.onFilterInput('alpha');
      fixture.detectChanges();

      const message = fixture.nativeElement.querySelector('.bb-no-match');
      expect(message).toBeNull();
    });
  });

  describe('expandAllNodes / collapseAllNodes', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('files', [makeFile('dir/a.txt'), makeFile('dir/b.txt')]);
      fixture.detectChanges();
    });

    it('should expand all folder nodes', () => {
      const dirNode = component.data.find((n) => n.name === 'dir')!;
      expect(component.isExpanded(dirNode)).toBe(false);

      component.expandAllNodes();

      expect(component.isExpanded(dirNode)).toBe(true);
    });

    it('should collapse all expanded folder nodes', () => {
      component.expandAllNodes();
      const dirNode = component.data.find((n) => n.name === 'dir')!;
      expect(component.isExpanded(dirNode)).toBe(true);

      component.collapseAllNodes();

      expect(component.isExpanded(dirNode)).toBe(false);
    });
  });
});
