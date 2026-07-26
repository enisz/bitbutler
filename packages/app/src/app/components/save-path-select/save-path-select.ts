import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  forwardRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  ControlValueAccessor,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbTypeahead, PlacementArray } from '@ng-bootstrap/ng-bootstrap';
import { DropdownPosition, NgSelectComponent } from '@ng-select/ng-select';
import { TranslatePipe } from '@ngx-translate/core';
import { DEFAULT_GENERAL_SETTINGS, SavePathInputType } from '../../models/general-settings.model';
import { GeneralSettingsService } from '../../services/general-settings.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { SavePathTypeaheadService } from './save-path-typeahead.service';

export type SavePathSelectPosition = 'top' | 'bottom';

@Component({
  selector: 'app-save-path-select',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgSelectComponent,
    NgbTypeahead,
    FontAwesomeModule,
    TranslatePipe,
  ],
  templateUrl: './save-path-select.html',
  styleUrls: ['./save-path-select.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SavePathSelect),
      multi: true,
    },
    SavePathTypeaheadService,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SavePathSelect implements ControlValueAccessor {
  readonly autofocus = input(false);
  readonly clearable = input(false);
  readonly label = input<string | null>(null);
  readonly placeholder = input<string | null>(null);
  readonly appendTo = input('');
  readonly inputType = input<SavePathInputType | null>(null);
  readonly position = input<SavePathSelectPosition | null>(null);

  private readonly ngselect = viewChild<NgSelectComponent>('ngselect');
  private readonly typeaheadInput = viewChild<ElementRef<HTMLInputElement>>('typeaheadInput');

  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly generalSettingsService = inject(GeneralSettingsService);
  public readonly typeaheadService = inject(SavePathTypeaheadService);

  public readonly icons = { faXmark };

  private readonly generalSettings = toSignal(this.generalSettingsService.asObservable(), {
    initialValue: DEFAULT_GENERAL_SETTINGS,
  });

  public readonly resolvedInputType = computed(
    () => this.inputType() ?? this.generalSettings().savePath.inputType,
  );

  public readonly resolvedDropdownPosition = computed<DropdownPosition>(
    () => this.position() ?? 'auto',
  );

  public readonly resolvedPlacement = computed<PlacementArray>(
    () => this.position() ?? ['bottom-start', 'bottom-end', 'top-start', 'top-end'],
  );

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

  public selectControl = new FormControl<string | null>(null);

  public readonly controlValue = toSignal(this.selectControl.valueChanges, {
    initialValue: this.selectControl.value,
  });

  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    this.selectControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.onChange(value);
      this.onTouched();
    });

    afterNextRender(() => {
      if (this.autofocus()) {
        this.ngselect()?.focus();
        this.typeaheadInput()?.nativeElement.focus();
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

  public clearValue(): void {
    this.selectControl.setValue(null);
  }

  keyDownFn(event: KeyboardEvent): boolean {
    if (event.key === 'Escape') {
      return false;
    }
    return true;
  }
}
