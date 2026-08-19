import { Injectable, DestroyRef } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntilDestroyed } from 'rxjs-interop';
import { AppCommand } from '../models/command.model';

@Injectable({ providedIn: 'root' })
export class CommandBusService {
  private readonly _commands = new Subject<AppCommand>();
  readonly commands$ = this._commands.asObservable().pipe(
    takeUntilDestroyed()
  );

  constructor(private readonly destroyRef: DestroyRef) {}

  emit(cmd: AppCommand) {
    this._commands.next(cmd);
  }
}
