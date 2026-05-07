import { TestBed } from '@angular/core/testing';
import { GridViewStoreService } from './grid-view-store.service';

describe('GridViewStoreService', () => {
  let service: GridViewStoreService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [GridViewStoreService] });
    service = TestBed.inject(GridViewStoreService);
  });

  it('should initialise filteredCount to 0', () => {
    expect(service.filteredCount()).toBe(0);
  });

  it('should update filteredCount when set', () => {
    service.filteredCount.set(42);
    expect(service.filteredCount()).toBe(42);
  });

  it('should update filteredCount back to 0', () => {
    service.filteredCount.set(10);
    service.filteredCount.set(0);
    expect(service.filteredCount()).toBe(0);
  });
});
