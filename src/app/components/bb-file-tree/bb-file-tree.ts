import { CdkTreeModule, NestedTreeControl } from '@angular/cdk/tree';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCheck, faEdit, faX } from '@fortawesome/free-solid-svg-icons';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TooltipOverflow } from '../../directives/tooltip-overflow';
import { TorrentFileEntry } from '../../models/torrent-draft.model';
import { FilesizePipe } from '../../pipes/filesize-pipe';
import { BbProgress } from '../bb-progress/bb-progress';

export type BbFileTreeNode = {
  name: string;
  fullPath: string;
  kind: 'dir' | 'file';
  children?: BbFileTreeNode[];
  file?: TorrentFileEntry;
};

export type FileTreeSaveEvent = {
  files: TorrentFileEntry[];
  renames: { type: 'file' | 'folder'; oldPath: string; newPath: string }[];
};

@Component({
  selector: 'app-bb-file-tree',
  standalone: true,
  imports: [
    CdkTreeModule,
    FormsModule,
    FilesizePipe,
    BbProgress,
    NgbTooltipModule,
    TooltipOverflow,
    FontAwesomeModule,
    TranslatePipe,
  ],
  templateUrl: './bb-file-tree.html',
  styleUrl: './bb-file-tree.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BbFileTree implements OnChanges {
  @Input({ required: true }) files: TorrentFileEntry[] = [];
  @Input() allowEdit = false;
  @Input() startInEditMode = false;
  @Input() expandAll = false;
  @Input() showMeta = true;
  @Input() hideProgress = false;

  @Output() saved = new EventEmitter<FileTreeSaveEvent>();

  public editMode = signal(false);
  private originalFiles: TorrentFileEntry[] = [];
  private renameQueue: { type: 'file' | 'folder'; oldPath: string; newPath: string }[] = [];
  private autoEditTriggered = false;

  public treeControl = new NestedTreeControl<BbFileTreeNode>((n) => n.children ?? []);
  public data: BbFileTreeNode[] = [];
  private readonly translateService = inject(TranslateService);

  public totalFiles = 0;
  public totalFolders = 0;
  public totalSize = 0;
  public selectedSize = 0;
  public downloadCount = 0;

  readonly priorityOptions = [
    {
      value: 1,
      label: this.translateService.instant('components.bb-file-tree.priority-option.normal'),
    },
    {
      value: 6,
      label: this.translateService.instant('components.bb-file-tree.priority-option.high'),
    },
    {
      value: 7,
      label: this.translateService.instant('components.bb-file-tree.priority-option.max'),
    },
  ];

  public icon = { faEdit, faCheck, faX };

  trackByPath = (_index: number, node: BbFileTreeNode): string => node.fullPath;

  ngOnChanges(): void {
    if (this.editMode()) return;

    const expandedPaths = new Set<string>();
    this.treeControl.expansionModel.selected.forEach((node) => expandedPaths.add(node.fullPath));

    const result = buildTree(this.files);
    this.data = result.nodes;
    this.totalFiles = this.files.length;

    this.calculateStats();

    if (this.expandAll) {
      this.expandAllNodes();
    } else {
      this.restoreExpansionState(this.data, expandedPaths);
    }

    if (this.startInEditMode && !this.autoEditTriggered && this.data.length > 0) {
      this.autoEditTriggered = true;
      this.enterEditMode();
    }
  }

  public enterEditMode(): void {
    this.originalFiles = structuredClone(this.files);
    this.renameQueue = [];
    this.editMode.set(true);
  }

  public cancelEdit(): void {
    for (let i = 0; i < this.originalFiles.length && i < this.files.length; i++) {
      this.files[i].priority = this.originalFiles[i].priority;
    }
    const expandedPaths = new Set<string>();
    this.treeControl.expansionModel.selected.forEach((n) => expandedPaths.add(n.fullPath));
    const result = buildTree(this.files);
    this.data = result.nodes;
    this.totalFiles = this.files.length;
    this.calculateStats();
    if (this.expandAll) this.expandAllNodes();
    else this.restoreExpansionState(this.data, expandedPaths);
    this.renameQueue = [];
    this.originalFiles = [];
    this.editMode.set(false);
  }

  public saveEdit(): void {
    const files = this.flatten(this.data, '');
    this.saved.emit({ files, renames: [...this.renameQueue] });
    this.renameQueue = [];
    this.originalFiles = [];
    this.editMode.set(false);
  }

  calculateStats(): void {
    this.totalSize = this.files.reduce((acc, f) => acc + (Number(f.length) || 0), 0);
    this.selectedSize = this.files.reduce(
      (acc, f) => acc + (f.priority !== 0 ? Number(f.length) || 0 : 0),
      0,
    );
    this.downloadCount = this.files.filter((f) => f.priority !== 0).length;
    this.totalFolders = this.countActiveFolders(this.data);
  }

  private countActiveFolders(nodes: BbFileTreeNode[]): number {
    let count = 0;
    for (const node of nodes) {
      if (node.kind === 'dir') {
        if (this.getNestedFiles(node).some((f) => f.priority !== 0)) count++;
        count += this.countActiveFolders(node.children ?? []);
      }
    }
    return count;
  }

  toggleFolderSelection(node: BbFileTreeNode, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.updateRecursive(node, (f) => (f.priority = checked ? 1 : 0));
    this.calculateStats();
  }

  setFolderPriority(node: BbFileTreeNode, priority: number): void {
    this.updateRecursive(node, (f) => {
      if (f.priority !== 0) f.priority = priority;
    });
    this.calculateStats();
  }

  private updateRecursive(node: BbFileTreeNode, action: (f: TorrentFileEntry) => void): void {
    if (node.file) action(node.file);
    node.children?.forEach((child) => this.updateRecursive(child, action));
  }

  toggleFileSelection(f: TorrentFileEntry, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    f.priority = checked ? 1 : 0;
    this.calculateStats();
  }

  onFileNameChange(node: BbFileTreeNode): void {
    const { oldPath, newPath } = this.deriveRenamePayload(node);
    if (oldPath === newPath) return;
    this.renameQueue.push({ type: 'file', oldPath, newPath });
    node.fullPath = newPath;
  }

  onFolderNameChange(node: BbFileTreeNode): void {
    const { oldPath, newPath } = this.deriveRenamePayload(node);
    if (oldPath === newPath) return;
    this.renameQueue.push({ type: 'folder', oldPath, newPath });
    node.fullPath = newPath;
    this.updateChildPaths(node.children ?? [], oldPath, newPath);
  }

  private deriveRenamePayload(node: BbFileTreeNode): { oldPath: string; newPath: string } {
    const oldPath = node.fullPath;
    const slashIdx = oldPath.lastIndexOf('/');
    const parentPath = slashIdx >= 0 ? oldPath.slice(0, slashIdx) : '';
    const newPath = parentPath ? `${parentPath}/${node.name}` : node.name;
    return { oldPath, newPath };
  }

  private updateChildPaths(nodes: BbFileTreeNode[], oldPrefix: string, newPrefix: string): void {
    for (const child of nodes) {
      child.fullPath = newPrefix + child.fullPath.slice(oldPrefix.length);
      if (child.children) this.updateChildPaths(child.children, oldPrefix, newPrefix);
    }
  }

  hasChild = (_: number, node: BbFileTreeNode) => !!node.children?.length;
  toggle = (node: BbFileTreeNode) => this.treeControl.toggle(node);
  isExpanded = (node: BbFileTreeNode) => this.treeControl.isExpanded(node);

  private flatten(nodes: BbFileTreeNode[], parentPath: string): TorrentFileEntry[] {
    let result: TorrentFileEntry[] = [];
    for (const node of nodes) {
      const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
      if (node.kind === 'file' && node.file) {
        result.push({ ...node.file, path: currentPath });
      }
      if (node.children) result = result.concat(this.flatten(node.children, currentPath));
    }
    return result;
  }

  isFolderSelected(node: BbFileTreeNode): boolean {
    const files = this.getNestedFiles(node);
    return files.length > 0 && files.every((f) => f.priority !== 0);
  }

  isFolderEmpty(node: BbFileTreeNode): boolean {
    const files = this.getNestedFiles(node);
    return files.length > 0 && files.every((f) => f.priority === 0);
  }

  isFolderIndeterminate(node: BbFileTreeNode): boolean {
    const files = this.getNestedFiles(node);
    return files.some((f) => f.priority !== 0) && files.some((f) => f.priority === 0);
  }

  private getNestedFiles(node: BbFileTreeNode): TorrentFileEntry[] {
    let res: TorrentFileEntry[] = [];
    if (node.file) res.push(node.file);
    node.children?.forEach((c) => (res = res.concat(this.getNestedFiles(c))));
    return res;
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
    if (f.priority === undefined || f.priority === null) f.priority = 1;
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
