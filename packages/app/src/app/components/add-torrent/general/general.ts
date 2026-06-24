import { ChangeDetectionStrategy, Component, input, output, viewChild } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { faFile, faFolderOpen, faLink } from '@fortawesome/free-solid-svg-icons';
import { TranslatePipe } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';
import { AddTorrentFormGroup } from '../../../models/add-torrent.model';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { BbPopover } from '../../bb-popover/bb-popover';
import { CategorySelect } from '../../category-select/category-select';
import { SavePathSelect } from '../../save-path-select/save-path-select';
import { TagSelect } from '../../tag-select/tag-select';

@Component({
  selector: 'app-add-torrent-general',
  imports: [
    ReactiveFormsModule,
    AutofocusDirective,
    BbPopover,
    TranslatePipe,
    CategorySelect,
    SavePathSelect,
    TagSelect,
    BbBtnContent,
  ],
  templateUrl: './general.html',
  styleUrl: './general.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTorrentGeneral {
  public readonly icons = { faFile, faLink, faFolderOpen };

  public form = input.required<AddTorrentFormGroup>();
  public inputMode = input.required<'file' | 'link'>();
  public inputModeChange = output<'file' | 'link'>();
  public fileSelected = output<Event>();

  private readonly categorySelect = viewChild(CategorySelect);

  public ensureCategoryExists(): Promise<boolean> | undefined {
    return this.categorySelect()?.ensureCategoryExists();
  }
}
