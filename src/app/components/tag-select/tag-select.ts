import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  forwardRef,
  inject,
  Input,
  OnInit,
  signal,
  ViewChild,
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

@Component({
  selector: 'app-tag-select',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgSelectComponent, TranslatePipe],
  templateUrl: './tag-select.html',
  styleUrls: ['./tag-select.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TagSelect),
      multi: true,
    },
  ],
})
export class TagSelect implements OnInit, ControlValueAccessor, AfterViewInit {
  @Input() autofocus = false;
  @ViewChild('ngselect') ngselect!: NgSelectComponent;

  private readonly serverStoreService = inject(ServerStoreService);
  private readonly qbService = inject(QbService);

  public tags = signal<string[]>([]);
  public selectControl = new FormControl<string[]>([]);

  private onChange: (value: string[] | null) => void = () => {};
  private onTouched: () => void = () => {};

  async ngOnInit(): Promise<void> {
    await this.loadAllTags();

    this.selectControl.valueChanges.subscribe((value) => {
      this.onChange(value);
      this.onTouched();
    });
  }

  public ngAfterViewInit(): void {
    if (this.autofocus) {
      this.ngselect.focus();
    }
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

  addTag = (term: string) => {
    return this.qbService
      .createTags(this.serverStoreService.currentServerId() as string, [term])
      .then(() => {
        this.tags.set([...this.tags(), term]);
        return term;
      })
      .catch((err) => {
        console.error(TagSelect.name, 'addTag', 'Failed to create tag!', err);
        return null;
      });
  };

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
