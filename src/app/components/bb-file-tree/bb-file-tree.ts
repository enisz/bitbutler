import { CdkTreeModule, NestedTreeControl } from '@angular/cdk/tree';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { TorrentFileEntry } from '../../models/torrent-draft.model';

type BbFileTreeNode = {
  name: string;
  fullPath: string;
  kind: 'dir' | 'file';
  children?: BbFileTreeNode[];
  file?: TorrentFileEntry;
};

@Component({
  selector: 'app-bb-file-tree',
  standalone: true,
  imports: [CommonModule, CdkTreeModule],
  templateUrl: './bb-file-tree.html',
  styleUrl: './bb-file-tree.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BbFileTree implements OnChanges {
  @Input({ required: true }) files: TorrentFileEntry[] = [];

  @Input() expandAll = false;

  @Input() showMeta = true;

  treeControl = new NestedTreeControl<BbFileTreeNode>((n) => n.children ?? []);
  data: BbFileTreeNode[] = [];

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

  formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 0) return '';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let v = bytes;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i++;
    }
    const digits = i === 0 ? 0 : i === 1 ? 1 : 2;
    return `${v.toFixed(digits)} ${units[i]}`;
  }

  formatProgress(p?: number): string {
    if (p == null || !Number.isFinite(p)) return '';
    const clamped = Math.max(0, Math.min(1, p));
    return `${Math.round(clamped * 100)}%`;
  }

  priorityLabel(prio?: number): string {
    if (prio == null) return '';

    switch (prio) {
      case 0:
        return 'Skip';
      case 1:
        return 'Normal';
      case 6:
        return 'High';
      case 7:
        return 'Max';
      default:
        return `Prio ${prio}`;
    }
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

function buildTree(files: TorrentFileEntry[]): BbFileTreeNode[] {
  const root: BbFileTreeNode = { name: '', fullPath: '', kind: 'dir', children: [] };

  const dirMap = new Map<string, BbFileTreeNode>();
  dirMap.set('', root);

  for (const f of files ?? []) {
    const normalized = normalizePath(f.path);
    if (!normalized) continue;

    const parts = normalized.split('/').filter(Boolean);
    let currentPath = '';
    let parent = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      const nextPath = currentPath ? `${currentPath}/${part}` : part;

      if (isLast) {
        parent.children ??= [];
        parent.children.push({
          name: part,
          fullPath: nextPath,
          kind: 'file',
          file: f,
        });
      } else {
        let dir = dirMap.get(nextPath);
        if (!dir) {
          dir = { name: part, fullPath: nextPath, kind: 'dir', children: [] };
          dirMap.set(nextPath, dir);
          parent.children ??= [];
          parent.children.push(dir);
        }
        parent = dir;
        currentPath = nextPath;
      }
    }
  }

  sortTree(root);
  return root.children ?? [];
}

function normalizePath(p: string): string {
  return (p ?? '')
    .replaceAll('\\', '/')
    .replaceAll('//', '/')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

function sortTree(node: BbFileTreeNode): void {
  if (!node.children?.length) return;

  node.children.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  for (const child of node.children) sortTree(child);
}
