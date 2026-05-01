import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { AppCommand } from '../models/command.model';

@Injectable({ providedIn: 'root' })
export class CommandBusService {
  private readonly _commands = new Subject<AppCommand>();
  readonly commands$ = this._commands.asObservable();

  emit(cmd: AppCommand) {
    this._commands.next(cmd);
  }
}
