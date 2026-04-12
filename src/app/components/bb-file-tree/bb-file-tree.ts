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
import { FormsModule } from '@angular/forms'; // Required for Edit Mode
import { TorrentFileEntry } from '../../models/torrent-draft.model';

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
  imports: [CommonModule, CdkTreeModule, FormsModule],
  templateUrl: './bb-file-tree.html',
  styleUrl: './bb-file-tree.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BbFileTree implements OnChanges {
  @Input({ required: true }) files: TorrentFileEntry[] = [];
  @Input() mode: TreeMode = 'view';
  @Input() expandAll = false;
  @Input() showMeta = true;

  // Emits the full flattened list of files whenever an edit is made
  @Output() filesChanged = new EventEmitter<TorrentFileEntry[]>();

  treeControl = new NestedTreeControl<BbFileTreeNode>((n) => n.children ?? []);
  data: BbFileTreeNode[] = [];

  readonly priorityOptions = [
    { value: 0, label: 'Skip' },
    { value: 1, label: 'Normal' },
    { value: 6, label: 'High' },
    { value: 7, label: 'Max' },
  ];

  ngOnChanges(): void {
    this.data = buildTree(this.files);
    if (this.expandAll) {
      this.expandAllNodes();
    }
  }

  hasChild = (_: number, node: BbFileTreeNode) => !!node.children?.length;

  toggle(node: BbFileTreeNode): void {
    this.treeControl.toggle(node);
  }

  isExpanded(node: BbFileTreeNode): boolean {
    return this.treeControl.isExpanded(node);
  }

  /**
   * Called on input/select changes in Edit mode.
   * Flattens the tree back into the TorrentFileEntry format and emits it.
   */
  emitChanges(): void {
    const flattened = this.flatten(this.data);
    this.filesChanged.emit(flattened);
  }

  private flatten(nodes: BbFileTreeNode[]): TorrentFileEntry[] {
    let result: TorrentFileEntry[] = [];
    for (const node of nodes) {
      if (node.kind === 'file' && node.file) {
        // We update the path in case the user renamed the file
        result.push({
          ...node.file,
          path: node.fullPath,
        });
      }
      if (node.children) {
        result = result.concat(this.flatten(node.children));
      }
    }
    return result;
  }

  // --- Helpers ---

  formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let v = bytes;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i++;
    }
    return `${v.toFixed(i < 2 ? 1 : 2)} ${units[i]}`;
  }

  formatProgress(p?: number): string {
    if (p == null) return '0%';
    return `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;
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

  trackByPath = (_: number, node: BbFileTreeNode) => node.fullPath;
}

// --- Internal Tree Builder Logic ---

function buildTree(files: TorrentFileEntry[]): BbFileTreeNode[] {
  const root: BbFileTreeNode = { name: '', fullPath: '', kind: 'dir', children: [] };
  const dirMap = new Map<string, BbFileTreeNode>();
  dirMap.set('', root);

  for (const f of files ?? []) {
    const normalized = (f.path ?? '').replace(/\\/g, '/').replace(/\/+$/, '').replace(/^\/+/, '');
    if (!normalized) continue;

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
  return root.children ?? [];
}

function sortTree(node: BbFileTreeNode): void {
  if (!node.children) return;
  node.children.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
  node.children.forEach(sortTree);
}
