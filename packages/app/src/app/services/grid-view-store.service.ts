import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class GridViewStoreService {
  readonly filteredCount = signal<number>(0);
}
