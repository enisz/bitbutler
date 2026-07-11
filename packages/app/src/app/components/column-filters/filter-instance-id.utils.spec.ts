import { createFilterInstanceId } from './filter-instance-id.utils';

describe('createFilterInstanceId', () => {
  it('prefixes the returned id with the given prefix', () => {
    expect(createFilterInstanceId('text-filter')).toMatch(/^text-filter-\d+$/);
  });

  it('returns a different id on every call, even with the same prefix', () => {
    const first = createFilterInstanceId('set-filter');
    const second = createFilterInstanceId('set-filter');
    expect(first).not.toBe(second);
  });

  it('shares one counter across different prefixes so ids never collide', () => {
    const a = createFilterInstanceId('text-filter');
    const b = createFilterInstanceId('number-filter');
    expect(a).not.toBe(b);
  });
});
