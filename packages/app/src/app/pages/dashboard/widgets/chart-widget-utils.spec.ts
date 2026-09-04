import { memoizeBySignature } from './chart-widget-utils';

describe('memoizeBySignature', () => {
  it('should return undefined for a signature never set', () => {
    const cache = memoizeBySignature<number>();
    expect(cache.get('a')).toBeUndefined();
  });

  it('should return the stored value for a matching signature', () => {
    const cache = memoizeBySignature<{ n: number }>();
    const value = { n: 1 };
    cache.set('a', value);
    expect(cache.get('a')).toBe(value);
  });

  it('should return undefined once a different signature is set (single-slot cache)', () => {
    const cache = memoizeBySignature<number>();
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
  });
});
