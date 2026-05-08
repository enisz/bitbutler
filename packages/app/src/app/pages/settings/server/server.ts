import { CommonModule } from '@angular/common';
import { Component, DestroyRef, NgZone, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  IconDefinition,
  faFolderOpen,
  faMinus,
  faPlus,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectComponent } from '@ng-select/ng-select';
import { TranslatePipe } from '@ngx-translate/core';
import { from, switchMap, tap } from 'rxjs';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { ServerSettings } from '../../../models/server-settings.model';
import { ElectronService } from '../../../services/electron.service';
import { ServerSettingsService } from '../../../services/server-settings.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { SettingsStateService } from '../settings-state.service';
import { SettingsTabComponent } from '../settings.interface';

@Component({
  selector: 'app-server',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgSelectComponent,
    FontAwesomeModule,
    NgbTooltip,
    BbSpinner,
    BbPopover,
    TranslatePipe,
  ],
  templateUrl: './server.html',
  styleUrl: './server.scss',
})
export class Server implements SettingsTabComponent, OnInit {
  private readonly electronService = inject(ElectronService);
  private readonly zone = inject(NgZone);
  private readonly serverSettingsService = inject(ServerSettingsService);
  private readonly destoryRef = inject(DestroyRef);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly stateService = inject(SettingsStateService);
  private readonly torrentStoreService = inject(TorrentStoreService);

  public icons: Record<string, IconDefinition> = {
    faPlus,
    faMinus,
    faTriangleExclamation,
    faFolderOpen,
  };

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

  addTag = (term: string): string => term;

  keyDownFn(event: KeyboardEvent): boolean {
    if (event.key === 'Escape') {
      return false;
    }
    return true;
  }

  public settings$ = toObservable(this.serverStoreService.currentServerId).pipe(
    switchMap(() => from(this.serverSettingsService.reload() as Promise<ServerSettings>)),

    tap((settings: ServerSettings) => {
      const { pathMappings, ...rest } = settings;

      this.serverSettingsForm.patchValue(rest, { emitEvent: false });

      this.pathMappings.clear({ emitEvent: false });

      const mappings = pathMappings?.length ? pathMappings : [{ remote: '', local: '' }];

      mappings.forEach((m) => {
        this.pathMappings.push(
          new FormGroup({
            remote: new FormControl(m.remote, { nonNullable: true }),
            local: new FormControl(m.local, { nonNullable: true }),
          }),
          { emitEvent: false },
        );
      });
    }),
  );

  public serverSettingsForm = new FormGroup({
    polling: new FormGroup({
      foreground: new FormControl(2000, { nonNullable: true }),
      background: new FormControl(5000, { nonNullable: true }),
    }),
    pathMappings: new FormArray([
      new FormGroup({
        remote: new FormControl('', { nonNullable: true }),
        local: new FormControl('', { nonNullable: true }),
      }),
    ]),
  });

  public ngOnInit(): void {
    this.stateService.registerSave('server', () => this.save());

    this.serverSettingsForm.valueChanges
      .pipe(takeUntilDestroyed(this.destoryRef))
      .subscribe(() => this.stateService.markDirty('server', true));
  }

  private async save(): Promise<void> {
    const settings: ServerSettings = this.serverSettingsForm.getRawValue();
    await this.serverSettingsService.save(settings);
  }

  get pathMappings(): FormArray {
    return this.serverSettingsForm.controls.pathMappings;
  }

  public addPathMapping(): void {
    this.pathMappings.push(
      new FormGroup({
        remote: new FormControl('', { nonNullable: true }),
        local: new FormControl('', { nonNullable: true }),
      }),
      { emitEvent: false },
    );
  }

  public testMapping(path: string): void {
    this.electronService.openPath(path);
  }

  public removePathMapping(index: number): void {
    if (this.pathMappings.length === 1) {
      this.pathMappings.at(index).reset({ remote: '', local: '' });
    } else {
      this.pathMappings.removeAt(index);
    }
  }

  public async onBrowse(index: number): Promise<void> {
    const path = await this.electronService.showOpenDialog();
    if (path) {
      this.zone.run(() => {
        const localControl = this.pathMappings.at(index).get('local');
        if (localControl) {
          localControl.setValue(path);
          localControl.markAsDirty();
        }
      });
    }
  }
}
