import { BREAKDOWN_FIELD_CATALOG, BREAKDOWN_FIELD_META_BY_FIELD } from './breakdown-field-catalog';

describe('BREAKDOWN_FIELD_CATALOG', () => {
  it('should have exactly these 9 fields', () => {
    expect(BREAKDOWN_FIELD_CATALOG.map((m) => m.field).sort()).toEqual(
      [
        'category',
        'eta',
        'progress',
        'ratio',
        'save_path',
        'size',
        'state',
        'tags',
        'tracker',
      ].sort(),
    );
  });

  it('should mark state/category/tracker/save_path/tags as categorical', () => {
    for (const field of ['state', 'category', 'tracker', 'save_path', 'tags'] as const) {
      expect(BREAKDOWN_FIELD_META_BY_FIELD[field].kind).toBe('categorical');
    }
  });

  it('should mark only tags as multi-valued', () => {
    expect(BREAKDOWN_FIELD_META_BY_FIELD['tags'].multiValued).toBe(true);
    expect(BREAKDOWN_FIELD_META_BY_FIELD['category'].multiValued).toBeFalsy();
  });

  it('should mark ratio/progress/size/eta as numeric with buckets', () => {
    for (const field of ['ratio', 'progress', 'size', 'eta'] as const) {
      const meta = BREAKDOWN_FIELD_META_BY_FIELD[field];
      expect(meta.kind).toBe('numeric');
      expect(meta.buckets!.length).toBeGreaterThan(0);
    }
  });

  it('should reuse the main grid column labels for every field label', () => {
    expect(BREAKDOWN_FIELD_META_BY_FIELD['category'].labelKey).toBe(
      'pages.main.grid.grid-lib.col-def.category',
    );
    expect(BREAKDOWN_FIELD_META_BY_FIELD['ratio'].labelKey).toBe(
      'pages.main.grid.grid-lib.col-def.ratio',
    );
  });

  function bucketKeyFor(field: 'ratio' | 'progress' | 'size' | 'eta', value: number): string {
    const meta = BREAKDOWN_FIELD_META_BY_FIELD[field];
    return meta.buckets!.find((b) => b.test(value))!.key;
  }

  it('should bucket ratio at each boundary', () => {
    expect(bucketKeyFor('ratio', 0)).toBe('lt-0-1');
    expect(bucketKeyFor('ratio', 0.099)).toBe('lt-0-1');
    expect(bucketKeyFor('ratio', 0.1)).toBe('0-1-to-0-5');
    expect(bucketKeyFor('ratio', 0.499)).toBe('0-1-to-0-5');
    expect(bucketKeyFor('ratio', 0.5)).toBe('0-5-to-1');
    expect(bucketKeyFor('ratio', 0.999)).toBe('0-5-to-1');
    expect(bucketKeyFor('ratio', 1)).toBe('1-to-2');
    expect(bucketKeyFor('ratio', 1.999)).toBe('1-to-2');
    expect(bucketKeyFor('ratio', 2)).toBe('gte-2');
    expect(bucketKeyFor('ratio', 50)).toBe('gte-2');
  });

  it('should bucket progress (raw 0-1 decimal) at each boundary', () => {
    expect(bucketKeyFor('progress', 0)).toBe('0-25');
    expect(bucketKeyFor('progress', 0.249)).toBe('0-25');
    expect(bucketKeyFor('progress', 0.25)).toBe('25-50');
    expect(bucketKeyFor('progress', 0.5)).toBe('50-75');
    expect(bucketKeyFor('progress', 0.75)).toBe('75-99');
    expect(bucketKeyFor('progress', 0.999)).toBe('75-99');
    expect(bucketKeyFor('progress', 1)).toBe('100');
  });

  it('should bucket size (bytes, GiB) at each boundary', () => {
    const GIB = 1024 ** 3;
    expect(bucketKeyFor('size', GIB - 1)).toBe('lt-1gib');
    expect(bucketKeyFor('size', GIB)).toBe('1-5gib');
    expect(bucketKeyFor('size', 5 * GIB)).toBe('5-20gib');
    expect(bucketKeyFor('size', 20 * GIB)).toBe('20-100gib');
    expect(bucketKeyFor('size', 100 * GIB)).toBe('gte-100gib');
  });

  it('should bucket eta, treating the qBittorrent 8640000 sentinel as unknown before any range check', () => {
    expect(bucketKeyFor('eta', 8_640_000)).toBe('unknown');
    expect(bucketKeyFor('eta', 99_999_999)).toBe('unknown');
    expect(bucketKeyFor('eta', 0)).toBe('lt-1h');
    expect(bucketKeyFor('eta', 3599)).toBe('lt-1h');
    expect(bucketKeyFor('eta', 3600)).toBe('1h-6h');
    expect(bucketKeyFor('eta', 21_600)).toBe('6h-24h');
    expect(bucketKeyFor('eta', 86_400)).toBe('1d-7d');
    expect(bucketKeyFor('eta', 604_800)).toBe('gte-7d');
    expect(bucketKeyFor('eta', 8_639_999)).toBe('gte-7d');
  });

  it('should never use a "." inside a bucket key (it would break ngx-translate dot-path lookup)', () => {
    for (const meta of BREAKDOWN_FIELD_CATALOG) {
      for (const bucket of meta.buckets ?? []) {
        expect(bucket.key).not.toContain('.');
      }
    }
  });
});
