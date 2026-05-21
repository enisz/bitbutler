import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  Input,
  OnInit,
  ViewChild,
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
import { NgFooterTemplateDirective, NgSelectComponent } from '@ng-select/ng-select';
import { TranslatePipe } from '@ngx-translate/core';
import { CommandBusService } from '../../services/command-bus.service';
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
    NgFooterTemplateDirective,
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
})
export class CategorySelect implements OnInit, ControlValueAccessor, AfterViewInit {
  @ViewChild('ngselect') ngselect!: NgSelectComponent;
  @Input() autofocus = false;

  private readonly serverStoreService = inject(ServerStoreService);
  private readonly qbService = inject(QbService);
  private readonly commandBusService = inject(CommandBusService);

  public categories = signal<string[]>([]);
  public selectControl = new FormControl('');

  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnInit(): void {
    this.qbService
      .getAllCategories(this.serverStoreService.currentServerId() as string)
      .then((categories) => {
        this.categories.set(Object.keys(categories));
      })
      .catch((err) => console.error('Failed to get torrent categories!', err));

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

  keyDownFn(event: KeyboardEvent): boolean {
    if (event.key === 'Escape') {
      return false;
    }

    return true;
  }

  public openManageCategories(event: Event): void {
    event.preventDefault();
    this.ngselect.close();
    this.commandBusService.emit({ type: 'UI_MANAGE_CATEGORIES' });
  }
}
