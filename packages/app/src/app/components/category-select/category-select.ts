import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  afterNextRender,
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
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { NgSelectComponent } from '@ng-select/ng-select';
import { TranslatePipe } from '@ngx-translate/core';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { BbPopover } from '../bb-popover/bb-popover';

@Component({
  selector: 'app-category-select',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgSelectComponent,
    FaIconComponent,
    TranslatePipe,
    BbPopover,
  ],
  templateUrl: './category-select.html',
  styleUrls: ['./category-select.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CategorySelect),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategorySelect implements ControlValueAccessor {
  @ViewChild('ngselect') ngselect!: NgSelectComponent;
  readonly autofocus = input(false);

  private readonly serverStoreService = inject(ServerStoreService);
  private readonly qbService = inject(QbService);

  public readonly icons = { faTriangleExclamation };

  public categories = signal<string[]>([]);
  public selectControl = new FormControl('');

  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    this.loadCategories();

    this.selectControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.onChange(value);
      this.onTouched();
    });

    afterNextRender(() => {
      if (this.autofocus()) {
        this.ngselect.focus();
      }
    });
  }

  private loadCategories(): void {
    this.qbService.torrents
      .categories(this.serverStoreService.currentServerId() as string)
      .then((categories) => {
        this.categories.set(Object.keys(categories));
      })
      .catch((err) => console.error('Failed to get torrent categories!', err));
  }

  writeValue(value: any): void {
    this.selectControl.setValue(value, { emitEvent: false });
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    if (isDisabled) {
      this.selectControl.disable();
    } else {
      this.selectControl.enable();
    }
  }

  addTag = (term: string): string => term.trim();

  keyDownFn(event: KeyboardEvent): boolean {
    if (event.key === 'Escape') {
      return false;
    }

    return true;
  }

  public async ensureCategoryExists(): Promise<boolean> {
    const value = (this.selectControl.value ?? '').trim();
    if (!value || this.categories().includes(value)) {
      return true;
    }

    try {
      await this.qbService.torrents.createCategory(
        this.serverStoreService.currentServerId() as string,
        value,
        '',
      );
      this.categories.update((cats) => [...cats, value]);
      return true;
    } catch {
      return false;
    }
  }
}
