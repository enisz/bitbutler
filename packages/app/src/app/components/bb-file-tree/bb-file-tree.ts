import { CdkTree, CdkTreeModule, NestedTreeControl } from '@angular/cdk/tree';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TorrentFileEntry } from '@bitbutler/shared';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCheck, faEdit, faX } from '@fortawesome/free-solid-svg-icons';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectComponent } from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TooltipOverflow } from '../../directives/tooltip-overflow';
import { FilesizePipe } from '../../pipes/filesize-pipe';
import { ConfirmService } from '../../services/confirm.service';
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
  renames: { oldPath: string; newPath: string }[];
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
    CommonModule,
    NgSelectComponent,
  ],
  templateUrl: './bb-file-tree.html',
  styleUrl: './bb-file-tree.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BbFileTree {
  readonly files = input.required<TorrentFileEntry[]>();
  readonly allowEdit = input(false);
  readonly startInEditMode = input(false);
  readonly expandAll = input(false);
  readonly showMeta = input(true);
  readonly hideProgress = input(false);

  readonly saved = output<FileTreeSaveEvent>();
  readonly editModeChange = output<boolean>();

  @ViewChild(CdkTree) private tree!: CdkTree<BbFileTreeNode>;

  public editMode = signal(false);
  private originalFiles: TorrentFileEntry[] = [];
  private autoEditTriggered = false;
  private sessionDirty = false;
  private folderPriorityMemory = new Map<string, number>();

  public treeControl = new NestedTreeControl<BbFileTreeNode>((n) => n.children ?? []);
  public data: BbFileTreeNode[] = [];
  private readonly translateService = inject(TranslateService);
  private readonly confirmService = inject(ConfirmService);

  public totalFiles = signal(0);
  public allFolders = signal(0);
  public totalFolders = signal(0);
  public totalSize = signal(0);
  public selectedSize = signal(0);
  public downloadCount = signal(0);

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

  constructor() {
    effect(() => {
      if (this.editMode()) return;

      const files = this.files();
      const expandedPaths = new Set<string>();
      this.treeControl.expansionModel.selected.forEach((node) => expandedPaths.add(node.fullPath));

      if (this.data.length > 0) {
        const fileMap = new Map<string, TorrentFileEntry>();
        for (const f of files) {
          fileMap.set(normalizePath(f.path), f);
        }
        const updated = this.updateNodeFiles(this.data, fileMap);
        if (updated === files.length) {
          this.data = [...this.data];
          this.totalFiles.set(files.length);
          this.calculateStats();
          this.tree?.renderNodeChanges(this.data);
          return;
        }
      }

      const result = buildTree(files);
      this.data = result.nodes;
      this.totalFiles.set(files.length);

      this.calculateStats();

      if (this.expandAll()) {
        this.expandAllNodes();
      } else {
        this.restoreExpansionState(this.data, expandedPaths);
      }

      if (this.startInEditMode() && !this.autoEditTriggered && this.data.length > 0) {
        this.autoEditTriggered = true;
        this.enterEditMode();
      }
    });
  }

  private updateNodeFiles(nodes: BbFileTreeNode[], fileMap: Map<string, TorrentFileEntry>): number {
    let count = 0;
    for (const node of nodes) {
      if (node.kind === 'file') {
        const newFile = fileMap.get(node.fullPath);
        if (!newFile) return -1;
        node.file = newFile;
        count++;
      } else {
        const childCount = this.updateNodeFiles(node.children ?? [], fileMap);
        if (childCount === -1) return -1;
        count += childCount;
      }
    }
    return count;
  }

  public enterEditMode(): void {
    this.sessionDirty = false;
    this.originalFiles = structuredClone(this.files());
    this.folderPriorityMemory.clear();
    this.editMode.set(true);
    this.editModeChange.emit(true);
  }

  public async cancelEdit(): Promise<void> {
    if (this.sessionDirty) {
      const confirmed = await this.confirmService.confirm(
        'components.bb-file-tree.confirm.cancel.title',
        'components.bb-file-tree.confirm.cancel.message',
      );
      if (!confirmed) return;
    }
    const files = this.files();
    for (let i = 0; i < this.originalFiles.length && i < files.length; i++) {
      files[i].priority = this.originalFiles[i].priority;
    }
    const expandedPaths = new Set<string>();
    this.treeControl.expansionModel.selected.forEach((n) => expandedPaths.add(n.fullPath));
    const result = buildTree(files);
    this.data = result.nodes;
    this.totalFiles.set(files.length);
    this.calculateStats();
    if (this.expandAll()) this.expandAllNodes();
    else this.restoreExpansionState(this.data, expandedPaths);
    this.originalFiles = [];
    this.folderPriorityMemory.clear();
    this.sessionDirty = false;
    this.editMode.set(false);
    this.editModeChange.emit(false);
  }

  public saveEdit(): void {
    const files = this.flatten(this.data, '');
    const renames = this.collectRenames(this.data, '');
    this.saved.emit({ files, renames });
    this.originalFiles = [];
    this.folderPriorityMemory.clear();
    this.editMode.set(false);
    this.editModeChange.emit(false);
  }

  calculateStats(): void {
    const files = this.data.flatMap((n) => this.getNestedFiles(n));
    this.totalSize.set(files.reduce((acc, f) => acc + (Number(f.length) || 0), 0));
    this.selectedSize.set(
      files.reduce((acc, f) => acc + (f.priority !== 0 ? Number(f.length) || 0 : 0), 0),
    );
    this.downloadCount.set(files.filter((f) => f.priority !== 0).length);
    this.allFolders.set(this.countFolders(this.data));
    this.totalFolders.set(this.countActiveFolders(this.data));
  }

  private countFolders(nodes: BbFileTreeNode[]): number {
    let count = 0;
    for (const node of nodes) {
      if (node.kind === 'dir') {
        count++;
        count += this.countFolders(node.children ?? []);
      }
    }
    return count;
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
    if (checked) {
      const restored = this.folderPriorityMemory.get(node.fullPath) ?? 1;
      this.updateRecursive(node, (f) => (f.priority = restored));
    } else {
      this.folderPriorityMemory.set(node.fullPath, this.getDominantFolderPriority(node));
      this.updateRecursive(node, (f) => (f.priority = 0));
    }
    this.sessionDirty = true;
    this.calculateStats();
  }

  setFolderPriority(node: BbFileTreeNode, priority: number): void {
    this.updateRecursive(node, (f) => {
      if (f.priority !== 0) f.priority = priority;
    });
    this.sessionDirty = true;
    this.calculateStats();
  }

  private updateRecursive(node: BbFileTreeNode, action: (f: TorrentFileEntry) => void): void {
    if (node.file) action(node.file);
    node.children?.forEach((child) => this.updateRecursive(child, action));
  }

  toggleFileSelection(f: TorrentFileEntry, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    f.priority = checked ? 1 : 0;
    this.sessionDirty = true;
    this.calculateStats();
  }

  onFilePriorityChange(): void {
    this.sessionDirty = true;
    this.calculateStats();
  }

  onRenameEnter(event: Event, node: BbFileTreeNode, type: 'file' | 'folder'): void {
    event.preventDefault();
    if (type === 'file') this.onFileNameChange(node);
    else this.onFolderNameChange(node);
    this.saveEdit();
  }

  async onEscapeInInput(event: Event): Promise<void> {
    event.stopPropagation();
    event.preventDefault();
    await this.cancelEdit();
  }

  onFileNameChange(node: BbFileTreeNode): void {
    const { oldPath, newPath } = this.deriveRenamePayload(node);
    if (oldPath === newPath) return;
    node.fullPath = newPath;
    this.sessionDirty = true;
  }

  onFolderNameChange(node: BbFileTreeNode): void {
    const { oldPath, newPath } = this.deriveRenamePayload(node);
    if (oldPath === newPath) return;
    node.fullPath = newPath;
    this.updateChildPaths(node.children ?? [], oldPath, newPath);
    this.sessionDirty = true;
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
  getNodeDepth = (node: BbFileTreeNode): number =>
    node.fullPath ? node.fullPath.split('/').length - 1 : 0;

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

  private collectRenames(
    nodes: BbFileTreeNode[],
    parentPath: string,
  ): { oldPath: string; newPath: string }[] {
    const result: { oldPath: string; newPath: string }[] = [];
    for (const node of nodes) {
      const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
      if (node.kind === 'file' && node.file) {
        const genesisPath = normalizePath(node.file.path);
        if (genesisPath !== currentPath) {
          result.push({ oldPath: genesisPath, newPath: currentPath });
        }
      }
      if (node.children) result.push(...this.collectRenames(node.children, currentPath));
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

  getDominantFolderPriority(node: BbFileTreeNode): number {
    const files = this.getNestedFiles(node).filter((f) => f.priority !== 0);
    if (files.length === 0) return 1;
    const first = files[0].priority ?? 1;
    return files.every((f) => f.priority === first) ? first : 1;
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

function normalizePath(path: string | undefined): string {
  return (path ?? '').replace(/\\/g, '/').replace(/\/+$/, '').replace(/^\/+/, '');
}

function buildTree(files: TorrentFileEntry[]): { nodes: BbFileTreeNode[]; folderCount: number } {
  const root: BbFileTreeNode = { name: '', fullPath: '', kind: 'dir', children: [] };
  const dirMap = new Map<string, BbFileTreeNode>();
  dirMap.set('', root);
  for (const f of files) {
    const normalized = normalizePath(f.path);
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
