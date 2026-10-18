import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PaneStateService } from './pane-state.service';

type TestFormId = 'a' | 'b';

@Injectable()
class TestStateService extends PaneStateService<TestFormId> {
  constructor() {
    super(['a', 'b']);
  }
}

describe('PaneStateService', () => {
  let service: TestStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [TestStateService] });
    service = TestBed.inject(TestStateService);
  });

  it('starts clean', () => {
    expect(service.isDirty()).toBe(false);
    expect(service.isDirtyMap()).toEqual({ a: false, b: false });
  });

  it('is dirty after a form is marked dirty and clean once it is unmarked', () => {
    service.markDirty('a', true);
    expect(service.isDirty()).toBe(true);
    expect(service.isDirtyMap()).toEqual({ a: true, b: false });

    service.markDirty('a', false);
    expect(service.isDirty()).toBe(false);
  });

  it('resetDirty clears every flag', () => {
    service.markDirty('a', true);
    service.markDirty('b', true);

    service.resetDirty();

    expect(service.isDirtyMap()).toEqual({ a: false, b: false });
  });

  it('saveAll runs only the dirty forms save functions and clears their flags', async () => {
    const saveA = vi.fn().mockResolvedValue(undefined);
    const saveB = vi.fn().mockResolvedValue(undefined);
    service.registerSave('a', saveA);
    service.registerSave('b', saveB);
    service.markDirty('a', true);

    await service.saveAll();

    expect(saveA).toHaveBeenCalledOnce();
    expect(saveB).not.toHaveBeenCalled();
    expect(service.isDirty()).toBe(false);
  });

  it('keeps a failed form dirty, clears the one that saved, and rethrows the failure', async () => {
    const failure = new Error('boom');
    service.registerSave('a', vi.fn().mockResolvedValue(undefined));
    service.registerSave('b', vi.fn().mockRejectedValue(failure));
    service.markDirty('a', true);
    service.markDirty('b', true);

    await expect(service.saveAll()).rejects.toBe(failure);

    expect(service.isDirtyMap()).toEqual({ a: false, b: true });
  });

  it('treats a dirty form without a registered save function as saved', async () => {
    service.markDirty('a', true);

    await service.saveAll();

    expect(service.isDirty()).toBe(false);
  });
});
