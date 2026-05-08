import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  Input,
  OnInit,
  ViewChild,
  computed,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
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
})
export class SavePathSelect implements OnInit, ControlValueAccessor, AfterViewInit {
  @Input() autofocus = false;
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

  public ngOnInit(): void {
    this.selectControl.valueChanges.subscribe((value) => {
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
  }

  public ngAfterViewInit(): void {
    if (this.autofocus) {
      this.ngselect.focus();
    }
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

  keyDownFn(event: KeyboardEvent): boolean {
    if (event.key === 'Escape') {
      return false;
    }
    return true;
  }
}
