import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TorrentFileEntry } from '../../models/torrent-draft.model';
import { BbFileTree, BbFileTreeNode } from './bb-file-tree';

const makeFile = (path: string, priority = 1, length = 1000): TorrentFileEntry => ({
  path,
  priority,
  length,
});

describe('BbFileTree', () => {
  let component: BbFileTree;
  let fixture: ComponentFixture<BbFileTree>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BbFileTree],
    }).compileComponents();

    fixture = TestBed.createComponent(BbFileTree);
    component = fixture.componentInstance;
    component.files = [];
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

  describe('tree stats after ngOnChanges', () => {
    it('should compute totalFiles from provided files', () => {
      component.files = [makeFile('a.txt'), makeFile('b.txt')];
      component.ngOnChanges();
      expect(component.totalFiles()).toBe(2);
    });

    it('should compute totalSize from file lengths', () => {
      component.files = [makeFile('a.txt', 1, 500), makeFile('b.txt', 1, 300)];
      component.ngOnChanges();
      expect(component.totalSize()).toBe(800);
    });

    it('should count only selected files in selectedSize', () => {
      component.files = [makeFile('a.txt', 1, 500), makeFile('b.txt', 0, 300)];
      component.ngOnChanges();
      expect(component.selectedSize()).toBe(500);
    });

    it('should count only downloading files', () => {
      component.files = [makeFile('a.txt', 1), makeFile('b.txt', 0), makeFile('c.txt', 1)];
      component.ngOnChanges();
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
      component.files = [makeFile('a.txt'), makeFile('b.txt')];
      component.ngOnChanges();
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

    it('should set editMode to false on cancelEdit', () => {
      component.enterEditMode();
      component.cancelEdit();
      expect(component.editMode()).toBe(false);
    });

    it('should emit editModeChange(false) on cancelEdit', () => {
      component.enterEditMode();
      const spy = vi.fn();
      component.editModeChange.subscribe(spy);
      component.cancelEdit();
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
});
