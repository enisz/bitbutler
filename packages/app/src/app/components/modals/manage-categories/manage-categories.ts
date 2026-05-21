import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';

interface CategoryItem {
  name: string;
  savePath: string;
  editing: boolean;
}

@Component({
  selector: 'app-manage-categories',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './manage-categories.html',
  styleUrl: './manage-categories.scss',
})
export class ManageCategories implements OnInit {
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  public readonly activeModal = inject(NgbActiveModal);

  public categories = signal<CategoryItem[]>([]);
  public addForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    savePath: new FormControl(''),
  });
  public editSavePathControl = new FormControl('');
  public adding = signal(false);

  public async ngOnInit(): Promise<void> {
    try {
      const raw = await this.qbService.getAllCategories(
        this.serverStoreService.currentServerId() as string,
      );
      this.categories.set(
        Object.entries(raw).map(([name, cat]) => ({
          name,
          savePath: cat.savePath ?? '',
          editing: false,
        })),
      );
    } catch (err) {
      console.error(ManageCategories.name, 'ngOnInit', 'Failed to load categories', err);
    }
  }

  public async add(): Promise<void> {
    const name = (this.addForm.get('name')?.value ?? '').trim();
    const savePath = (this.addForm.get('savePath')?.value ?? '').trim();
    if (!name) return;
    const serverId = this.serverStoreService.currentServerId() as string;
    try {
      this.adding.set(true);
      await this.qbService.addCategory(serverId, name, savePath);
      this.categories.set([...this.categories(), { name, savePath, editing: false }]);
      this.addForm.reset();
    } catch (err) {
      console.error(ManageCategories.name, 'add', 'Failed to add category', err);
    } finally {
      this.adding.set(false);
    }
  }

  public startEdit(item: CategoryItem): void {
    this.categories.set(this.categories().map((c) => ({ ...c, editing: c.name === item.name })));
    this.editSavePathControl.setValue(item.savePath);
  }

  public cancelEdit(): void {
    this.categories.set(this.categories().map((c) => ({ ...c, editing: false })));
  }

  public async saveEdit(item: CategoryItem): Promise<void> {
    const newPath = (this.editSavePathControl.value ?? '').trim();
    const serverId = this.serverStoreService.currentServerId() as string;
    try {
      await this.qbService.editCategory(serverId, item.name, newPath);
      this.categories.set(
        this.categories().map((c) =>
          c.name === item.name ? { ...c, savePath: newPath, editing: false } : c,
        ),
      );
    } catch (err) {
      console.error(ManageCategories.name, 'saveEdit', 'Failed to edit category', err);
    }
  }

  public async delete(item: CategoryItem): Promise<void> {
    const serverId = this.serverStoreService.currentServerId() as string;
    try {
      await this.qbService.removeCategories(serverId, [item.name]);
      this.categories.set(this.categories().filter((c) => c.name !== item.name));
    } catch (err) {
      console.error(ManageCategories.name, 'delete', 'Failed to delete category', err);
    }
  }
}
