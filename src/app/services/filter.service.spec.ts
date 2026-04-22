import { TestBed } from '@angular/core/testing';
import { FilterService } from './filter.service';

describe('FilterService', () => {
  let service: FilterService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [FilterService] });
    service = TestBed.inject(FilterService);
  });

  it('should initialise with empty external filter', () => {
    expect(service.external().search).toBe('');
    expect(service.external().states.size).toBe(0);
  });

  it('should update search', () => {
    service.setSearch('test');
    expect(service.external().search).toBe('test');
  });

  it('should update states', () => {
    service.setStates(['downloading', 'paused'] as any);
    expect(service.external().states.has('downloading' as any)).toBeTrue();
  });

  it('should clear states', () => {
    service.setStates(['downloading'] as any);
    service.clearStates();
    expect(service.external().states.size).toBe(0);
  });

  it('should update column model', () => {
    service.setColumnModel({ name: { filterType: 'text' } });
    expect(service.columns()['name']).toBeDefined();
  });

  it('should reset all filters', () => {
    service.setSearch('test');
    service.setColumnModel({ name: { filterType: 'text' } });
    service.resetAll();
    expect(service.external().search).toBe('');
    expect(Object.keys(service.columns()).length).toBe(0);
  });

  it('should expose snapshot matching signal values', () => {
    service.setSearch('hello');
    expect(service.snapshot.external.search).toBe('hello');
  });
});
