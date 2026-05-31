import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  afterNextRender,
  computed,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ControlValueAccessor,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import { NgSelectComponent } from '@ng-select/ng-select';
import { TranslatePipe } from '@ngx-translate/core';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { BbPopover } from '../bb-popover/bb-popover';

@Component({
  selector: 'app-save-path-select',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgSelectComponent, TranslatePipe, BbPopover],
  templateUrl: './save-path-select.html',
  styleUrls: ['./save-path-select.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SavePathSelect),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SavePathSelect implements ControlValueAccessor {
  readonly autofocus = input(false);
  readonly clearable = input(false);
  readonly showPopover = input(true);
  readonly label = input<string | null>(null);
  readonly placeholder = input<string | null>(null);
  readonly appendTo = input('');
  @ViewChild('ngselect') ngselect!: NgSelectComponent;

  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);

  public paths = computed(
    () => {
      const uniquePaths = new Set<string>();
      for (const t of this.torrentStoreService.torrentsArray()) {
        const path = t.save_path?.trim();
        if (path) uniquePaths.add(path);
      }
      return Array.from(uniquePaths).sort();
    },
    { equal: (a, b) => a.length === b.length && a.every((v, i) => v === b[i]) },
  );

  public defaultPath = signal<string>('');
  public selectControl = new FormControl<string | null>(null);

  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    this.selectControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.onChange(value);
      this.onTouched();
    });

    const serverId = this.serverStoreService.currentServerId();
    if (serverId) {
      this.qbService
        .getAppPreferences(serverId)
        .then((prefs) => {
          if (prefs.save_path) {
            this.defaultPath.set(prefs.save_path);
          }
        })
        .catch(() => {});
    }

    afterNextRender(() => {
      if (this.autofocus()) {
        this.ngselect.focus();
      }
    });
  }

  writeValue(value: string | null): void {
    this.selectControl.setValue(value, { emitEvent: false });
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.selectControl.disable();
    } else {
      this.selectControl.enable();
    }
  }

  addTag = (term: string): string => term;

  public resetHighlight(): void {
    this.ngselect.itemsList.unmarkItem();
  }

  keyDownFn(event: KeyboardEvent): boolean {
    if (event.key === 'Escape') {
      return false;
    }
    return true;
  }
}
