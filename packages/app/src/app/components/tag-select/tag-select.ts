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
  selector: 'app-tag-select',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgSelectComponent,
    NgFooterTemplateDirective,
    TranslatePipe,
    BbPopover,
  ],
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
  private readonly commandBusService = inject(CommandBusService);

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

  keyDownFn(event: KeyboardEvent): boolean {
    if (event.key === 'Escape') {
      return false;
    }

    return true;
  }

  public openManageTags(): void {
    this.ngselect.close();
    this.commandBusService.emit({ type: 'UI_MANAGE_TAGS' });
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
