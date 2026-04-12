import { CdkTreeModule, NestedTreeControl } from '@angular/cdk/tree';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { TorrentFileEntry } from '../../models/torrent-draft.model';
import { FilesizePipe } from '../../pipes/filesize-pipe';
import { BbProgress } from '../bb-progress/bb-progress';

export type TreeMode = 'view' | 'edit';

export type BbFileTreeNode = {
  name: string;
  fullPath: string;
  kind: 'dir' | 'file';
  children?: BbFileTreeNode[];
  file?: TorrentFileEntry;
};

@Component({
  selector: 'app-bb-file-tree',
  standalone: true,
  imports: [CommonModule, CdkTreeModule, FormsModule, FilesizePipe, BbProgress, NgbTooltipModule],
  templateUrl: './bb-file-tree.html',
  styleUrl: './bb-file-tree.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BbFileTree implements OnChanges {
  @Input({ required: true }) files: TorrentFileEntry[] = [];
  @Input() mode: TreeMode = 'view';
  @Input() expandAll = false;
  @Input() showMeta = true;

  @Output() filesChanged = new EventEmitter<TorrentFileEntry[]>();

  public treeControl = new NestedTreeControl<BbFileTreeNode>((n) => n.children ?? []);
  public data: BbFileTreeNode[] = [];

  public totalFiles = 0;
  public totalFolders = 0;
  public totalSize = 0;

  readonly priorityOptions = [
    { value: 0, label: 'Skip' },
    { value: 1, label: 'Normal' },
    { value: 6, label: 'High' },
    { value: 7, label: 'Max' },
  ];

  /**
   * Track nodes by their full path to prevent flickering during refreshes.
   */
  trackByPath = (_index: number, node: BbFileTreeNode): string => node.fullPath;

  ngOnChanges(): void {
    // 1. Capture expanded state
    const expandedPaths = new Set<string>();
    this.treeControl.expansionModel.selected.forEach((node) => {
      expandedPaths.add(node.fullPath);
    });

    // 2. Rebuild tree
    const result = buildTree(this.files);
    this.data = result.nodes;
    this.totalFolders = result.folderCount;
    this.totalFiles = this.files.length;
    this.totalSize = this.files.reduce((acc, f) => acc + (Number(f.length) || 0), 0);

    // 3. Restore state
    if (this.expandAll) {
      this.expandAllNodes();
    } else {
      this.restoreExpansionState(this.data, expandedPaths);
    }
  }

  hasChild = (_: number, node: BbFileTreeNode) => !!node.children?.length;

  toggle(node: BbFileTreeNode): void {
    this.treeControl.toggle(node);
  }

  isExpanded(node: BbFileTreeNode): boolean {
    return this.treeControl.isExpanded(node);
  }

  emitChanges(): void {
    const flattened = this.flatten(this.data);
    this.filesChanged.emit(flattened);
  }

  private flatten(nodes: BbFileTreeNode[]): TorrentFileEntry[] {
    let result: TorrentFileEntry[] = [];
    for (const node of nodes) {
      if (node.kind === 'file' && node.file) {
        result.push({ ...node.file, path: node.fullPath });
      }
      if (node.children) {
        result = result.concat(this.flatten(node.children));
      }
    }
    return result;
  }

  priorityLabel(prio?: number): string {
    return this.priorityOptions.find((o) => o.value === prio)?.label ?? `Prio ${prio}`;
  }

  private expandAllNodes(): void {
    const stack = [...this.data];
    while (stack.length) {
      const n = stack.pop()!;
      if (n.children?.length) {
        this.treeControl.expand(n);
        stack.push(...n.children);
      }
    }
  }

  private restoreExpansionState(nodes: BbFileTreeNode[], expandedPaths: Set<string>): void {
    if (!nodes || expandedPaths.size === 0) return;
    for (const node of nodes) {
      if (node.children?.length && expandedPaths.has(node.fullPath)) {
        this.treeControl.expand(node);
        this.restoreExpansionState(node.children, expandedPaths);
      }
    }
  }
}

function buildTree(files: TorrentFileEntry[]): { nodes: BbFileTreeNode[]; folderCount: number } {
  const root: BbFileTreeNode = { name: '', fullPath: '', kind: 'dir', children: [] };
  const dirMap = new Map<string, BbFileTreeNode>();
  dirMap.set('', root);

  for (const f of files ?? []) {
    const normalized = (f.path ?? '').replace(/\\/g, '/').replace(/\/+$/, '').replace(/^\/+/, '');
    if (!normalized) continue;

    if (f.priority === undefined || f.priority === null) {
      f.priority = 1;
    }

    const parts = normalized.split('/');
    let currentPath = '';
    let parent = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (isLast) {
        parent.children ??= [];
        parent.children.push({ name: part, fullPath: currentPath, kind: 'file', file: f });
      } else {
        let dir = dirMap.get(currentPath);
        if (!dir) {
          dir = { name: part, fullPath: currentPath, kind: 'dir', children: [] };
          dirMap.set(currentPath, dir);
          parent.children ??= [];
          parent.children.push(dir);
        }
        parent = dir;
      }
    }
  }
  sortTree(root);
  return { nodes: root.children ?? [], folderCount: dirMap.size - 1 };
}

function sortTree(node: BbFileTreeNode): void {
  if (!node.children) return;
  node.children.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
  node.children.forEach(sortTree);
}
