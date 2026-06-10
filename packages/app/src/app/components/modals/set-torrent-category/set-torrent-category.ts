import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { CategorySelect } from '../../category-select/category-select';

@Component({
  selector: 'app-set-torrent-category',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule,
    CategorySelect,
    NgbTooltip,
    TranslatePipe,
    TooltipOverflow,
  ],
  templateUrl: './set-torrent-category.html',
  styleUrl: './set-torrent-category.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetTorrentCategory implements OnInit {
  readonly torrent = input.required<Torrent>();
  readonly hashes = input<string[]>([]);

  private readonly serverStoreService = inject(ServerStoreService);
  public readonly activeModal = inject(NgbActiveModal);
  public readonly qbService = inject(QbService);

  private readonly categorySelect = viewChild(CategorySelect);

  public readonly selected = computed(() => this.hashes().length);
  public saving = false;
  public setTorrentCategoryForm = new FormGroup({
    category: new FormControl(''),
  });

  public ngOnInit(): void {
    this.setTorrentCategoryForm.get('category')?.patchValue(this.torrent().category);
  }

  public async handleSubmit(): Promise<void> {
    this.saving = true;

    if (!(await this.categorySelect()?.ensureCategoryExists())) {
      this.saving = false;
      return;
    }

    const category = this.setTorrentCategoryForm.get('category')?.value || '';
    const serverId = this.serverStoreService.currentServerId() ?? '';

    try {
      await this.qbService.setTorrentCategory(serverId, this.hashes(), category);
      this.activeModal.close();
    } catch (error) {
      console.error(
        SetTorrentCategory.name,
        'handleSubmit',
        'Failed to set torrent category!',
        error,
      );
    } finally {
      this.saving = false;
    }
  }

  public canSave(): boolean {
    return this.setTorrentCategoryForm.valid && this.setTorrentCategoryForm.dirty && !this.saving;
  }
}
