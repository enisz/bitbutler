import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  computed,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faArrowDown,
  faArrowUp,
  faArrowsDownToLine,
  faArrowsUpToLine,
  faChevronDown,
  faFile,
  faFileCirclePlus,
  faGear,
  faGears,
  faLink,
  faPause,
  faPlay,
  faPlayCircle,
  faSearch,
  faStopCircle,
  faTrashCan,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import {
  NgbActiveModal,
  NgbDropdownModule,
  NgbModal,
  NgbTooltipModule,
} from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { CommandBusService } from '../../../services/command-bus.service';
import { FilterService } from '../../../services/filter.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { ToolbarEntry } from './button-bar.menu';

@Component({
  selector: 'app-button-bar',
  standalone: true,
  imports: [
    CommonModule,
    FontAwesomeModule,
    ReactiveFormsModule,
    NgbDropdownModule,
    NgbTooltipModule,
    TranslatePipe,
  ],
  templateUrl: './button-bar.html',
  styleUrl: './button-bar.scss',
})
export class ButtonBar implements OnInit {
  private readonly selectionStore = inject(SelectionStoreService);
  private readonly filterService = inject(FilterService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly modalService = inject(NgbModal);

  private shiftKey = false;

  @ViewChild('searchInput', { read: ElementRef })
  private searchInputRef?: ElementRef<HTMLInputElement>;

  public compact = false;
  public icons = { faChevronDown, faSearch, faXmark };
  public readonly selected = this.selectionStore.selected;
  public readonly hasSelection = computed(() => this.selected().length > 0);
  public searchForm: FormGroup = new FormGroup({
    search: new FormControl(''),
  });

  readonly entries = computed<ToolbarEntry[]>(() => {
    return [
      {
        kind: 'group',
        id: 'new',
        label: 'pages.main.button-bar.button.add',
        icon: faFileCirclePlus,
        variant: 'primary',
        items: [
          {
            kind: 'action',
            id: 'new.addTorrentFile',
            label: 'pages.main.button-bar.button.add-file',
            icon: faFile,
            variant: 'primary',
          },
          {
            kind: 'action',
            id: 'new.addTorrentLink',
            label: 'pages.main.button-bar.button.add-link',
            icon: faLink,
            variant: 'primary',
          },
        ],
      },
      { kind: 'divider' },
      {
        kind: 'action',
        id: 'delete.deleteTorrent',
        label: 'pages.main.button-bar.button.delete',
        icon: faTrashCan,
        variant: 'danger',
        disabled: !this.hasSelection(),
      },
      { kind: 'divider' },
      {
        kind: 'action',
        id: 'control.resume',
        label: 'pages.main.button-bar.button.start',
        icon: faPlay,
        variant: 'success',
        disabled: !this.hasSelection(),
      },
      {
        kind: 'action',
        id: 'control.pause',
        label: 'pages.main.button-bar.button.stop',
        icon: faPause,
        variant: 'warning',
        disabled: !this.hasSelection(),
      },
      {
        kind: 'action',
        id: 'control.resumeAll',
        label: 'pages.main.button-bar.button.start-all',
        icon: faPlayCircle,
        variant: 'success',
        disabled: this.torrentStoreService.totalCount() === 0,
      },
      {
        kind: 'action',
        id: 'control.pauseAll',
        label: 'pages.main.button-bar.button.stop-all',
        icon: faStopCircle,
        variant: 'warning',
        disabled: this.torrentStoreService.totalCount() === 0,
      },
      { kind: 'divider' },
      {
        kind: 'action',
        id: 'queue.moveTop',
        label: 'pages.main.button-bar.button.top',
        icon: faArrowsUpToLine,
        variant: 'info',
        disabled: !this.hasSelection(),
      },
      {
        kind: 'action',
        id: 'queue.moveUp',
        label: 'pages.main.button-bar.button.up',
        icon: faArrowUp,
        variant: 'info',
        disabled: !this.hasSelection(),
      },
      {
        kind: 'action',
        id: 'queue.moveDown',
        label: 'pages.main.button-bar.button.down',
        icon: faArrowDown,
        variant: 'info',
        disabled: !this.hasSelection(),
      },
      {
        kind: 'action',
        id: 'queue.moveBottom',
        label: 'pages.main.button-bar.button.bottom',
        icon: faArrowsDownToLine,
        variant: 'info',
        disabled: !this.hasSelection(),
      },
      { kind: 'divider' },
      {
        kind: 'group',
        id: 'settings',
        label: 'pages.main.button-bar.button.settings',
        icon: faGear,
        variant: 'default',
        items: [
          {
            kind: 'action',
            id: 'settings.open',
            label: 'pages.main.button-bar.button.settings',
            icon: faGear,
            variant: 'default',
          },
          {
            kind: 'action',
            id: 'qb-settings.open',
            label: 'pages.main.button-bar.button.qb-settings',
            icon: faGears,
            variant: 'default',
          },
        ],
      },
    ];
  });

  @HostListener('window:keyup', ['$event'])
  public onWindowKeyUp(event: KeyboardEvent): void {
    this.shiftKey = event.shiftKey;
  }

  @HostListener('window:keydown', ['$event'])
  public onWindowKeyDown(event: KeyboardEvent): void {
    if (this.modalService.hasOpenModals()) return;

    const { ctrlKey, key, shiftKey } = event;
    this.shiftKey = shiftKey;

    if (ctrlKey && (key === 'k' || key === 'K')) {
      event.preventDefault();
      event.stopPropagation();
      this.focusSearch();
      return;
    }

    if (key === 'Escape') {
      if (this.isSearchFocused()) {
        event.preventDefault();
        event.stopPropagation();
        this.clearSearchField();
        this.focusSearch();
      }
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateCompact();
  }

  public ngOnInit(): void {
    this.updateCompact();

    this.searchForm
      .get('search')
      ?.valueChanges.pipe(
        debounceTime(500),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((search: string) => this.filterService.setSearch(search ?? ''));
  }

  public onClick(id: string) {
    switch (id) {
      case 'delete.deleteTorrent':
        this.commandBusService.emit({
          type: 'UI_TORRENT_DELETE_REQUEST',
          defaultRemoveFiles: this.shiftKey,
        });
        break;
      case 'control.resume':
        this.commandBusService.emit({ type: 'TORRENT_RESUME' });
        break;
      case 'control.pause':
        this.commandBusService.emit({ type: 'TORRENT_PAUSE' });
        break;
      case 'control.resumeAll':
        this.commandBusService.emit({ type: 'TORRENT_RESUME_ALL' });
        break;
      case 'control.pauseAll':
        this.commandBusService.emit({ type: 'TORRENT_PAUSE_ALL' });
        break;
      case 'qb-settings.open':
        this.commandBusService.emit({ type: 'UI_OPEN_QB_SETTINGS' });
        break;
      case 'settings.open':
        this.commandBusService.emit({ type: 'UI_OPEN_SETTINGS' });
        break;
      case 'new.addTorrentFile':
        this.commandBusService.emit({ type: 'UI_ADD_TORRENT' });
        break;
      case 'new.addTorrentLink':
        this.commandBusService.emit({ type: 'UI_ADD_TORRENT', mode: 'link' });
        break;
      case 'queue.moveTop':
        this.commandBusService.emit({ type: 'QUEUE_MOVE_TOP' });
        break;
      case 'queue.moveUp':
        this.commandBusService.emit({ type: 'QUEUE_MOVE_UP' });
        break;
      case 'queue.moveDown':
        this.commandBusService.emit({ type: 'QUEUE_MOVE_DOWN' });
        break;
      case 'queue.moveBottom':
        this.commandBusService.emit({ type: 'QUEUE_MOVE_BOTTOM' });
        break;
      default:
        throw new Error(`OnClick action '${id}' not defined`);
    }
  }

  public trackBy(_i: number, e: ToolbarEntry): string {
    if (e.kind === 'action') return `a:${e.id}`;
    if (e.kind === 'group') return `g:${e.id}`;
    return `d:${_i}`;
  }

  public clearSearchField(): void {
    this.searchForm.get('search')?.patchValue('', { emitEvent: true });
    this.filterService.clearSearch();
  }

  private updateCompact(): void {
    this.compact = window.matchMedia('(max-width: 1920px)').matches;
  }

  private focusSearch(): void {
    const el = this.searchInputRef?.nativeElement;
    if (!el) return;
    el.focus();
    el.select();
  }

  private isSearchFocused(): boolean {
    const el = this.searchInputRef?.nativeElement;
    return !!el && document.activeElement === el;
  }
}
