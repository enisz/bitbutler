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
import { NgSelectComponent } from '@ng-select/ng-select';
import { TranslatePipe } from '@ngx-translate/core';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { BbPopover } from '../bb-popover/bb-popover';

@Component({
  selector: 'app-tag-select',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgSelectComponent, TranslatePipe, BbPopover],
  templateUrl: './tag-select.html',
  styleUrls: ['./tag-select.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TagSelect),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagSelect implements ControlValueAccessor {
  readonly autofocus = input(false);
  @ViewChild('ngselect') ngselect!: NgSelectComponent;

  private readonly serverStoreService = inject(ServerStoreService);
  private readonly qbService = inject(QbService);

  public tags = signal<string[]>([]);
  public selectControl = new FormControl<string[]>([]);

  private onChange: (value: string[] | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    void this.loadAllTags();

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

  writeValue(value: string[]): void {
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

  private async loadAllTags(): Promise<void> {
    try {
      const tags = await this.qbService.getAllTags(
        this.serverStoreService.currentServerId() as string,
      );
      this.tags.set(tags);
    } catch (err) {
      console.error(TagSelect.name, 'loadAllTags', 'Failed to get torrent tags!', err);
    }
  }
}
