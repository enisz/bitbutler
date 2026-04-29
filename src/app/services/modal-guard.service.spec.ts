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
    const second = TestBed.inject(ModalGuardService);
    service.isDirty.set(true);
    expect(second.isDirty()).toBe(true);
  });
});
