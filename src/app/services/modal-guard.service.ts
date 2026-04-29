import { Injectable, signal } from '@angular/core';

@Injectable()
export class ModalGuardService {
  isDirty = signal(false);
}
