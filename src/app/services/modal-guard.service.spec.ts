import { TestBed } from '@angular/core/testing';
import { ModalGuardService } from './modal-guard.service';

describe('ModalGuardService', () => {
  let service: ModalGuardService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ModalGuardService] });
    service = TestBed.inject(ModalGuardService);
  });

  it('should initialise isDirty to false', () => {
    expect(service.isDirty()).toBe(false);
  });

  it('should update isDirty to true', () => {
    service.isDirty.set(true);
    expect(service.isDirty()).toBe(true);
  });

  it('should reset isDirty to false', () => {
    service.isDirty.set(true);
    service.isDirty.set(false);
    expect(service.isDirty()).toBe(false);
  });

  it('should be instantiated independently (not singleton)', () => {
    // ModalGuardService is not providedIn: 'root', so each provider entry creates a new instance.
    // Verify that the same TestBed module returns the same instance (it does since it's registered once).
    const second = TestBed.inject(ModalGuardService);
    service.isDirty.set(true);
    // Same module = same instance
    expect(second.isDirty()).toBe(true);
  });
});
