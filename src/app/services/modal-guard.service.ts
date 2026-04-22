import { Injectable, signal } from '@angular/core';

// Not provided in root — must be scoped via providers[] in each modal component
// to ensure each modal instance gets its own isolated dirty flag.
@Injectable()
export class ModalGuardService {
  isDirty = signal(false);
}
