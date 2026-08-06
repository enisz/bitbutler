import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: () => '/fake' },
}));

vi.mock('better-sqlite3', async () => {
  const actual = await vi.importActual<typeof import('better-sqlite3')>('better-sqlite3');
  const RealDatabase = actual.default;
  return {
    default: class extends RealDatabase {
      constructor() {
        super(':memory:');
      }
    },
  };
});

describe('logs table', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('accepts a row with a valid process and level', async () => {
    const { default: db } = await import('./db.js');
    expect(() =>
      db
        .prepare('INSERT INTO logs (timestamp, process, level, message) VALUES (?, ?, ?, ?)')
        .run(Date.now(), 'main', 'info', 'hello'),
    ).not.toThrow();
  });

  it('rejects an invalid process value', async () => {
    const { default: db } = await import('./db.js');
    expect(() =>
      db
        .prepare('INSERT INTO logs (timestamp, process, level, message) VALUES (?, ?, ?, ?)')
        .run(Date.now(), 'worker', 'info', 'hello'),
    ).toThrow();
  });

  it('rejects an invalid level value', async () => {
    const { default: db } = await import('./db.js');
    expect(() =>
      db
        .prepare('INSERT INTO logs (timestamp, process, level, message) VALUES (?, ?, ?, ?)')
        .run(Date.now(), 'main', 'verbose', 'hello'),
    ).toThrow();
  });
});

describe('logs retention trigger', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('deletes rows older than 30 days when a new row is inserted', async () => {
    const { default: db } = await import('./db.js');
    const insert = db.prepare(
      'INSERT INTO logs (timestamp, process, level, message) VALUES (?, ?, ?, ?)',
    );
    const THIRTY_ONE_DAYS_MS = 31 * 24 * 60 * 60 * 1000;
    insert.run(Date.now() - THIRTY_ONE_DAYS_MS, 'main', 'info', 'old entry');

    insert.run(Date.now(), 'main', 'info', 'new entry');

    const rows = db.prepare('SELECT message FROM logs').all() as { message: string }[];
    expect(rows).toEqual([{ message: 'new entry' }]);
  });

  it('keeps rows within the retention window', async () => {
    const { default: db } = await import('./db.js');
    const insert = db.prepare(
      'INSERT INTO logs (timestamp, process, level, message) VALUES (?, ?, ?, ?)',
    );
    const TWENTY_NINE_DAYS_MS = 29 * 24 * 60 * 60 * 1000;
    insert.run(Date.now() - TWENTY_NINE_DAYS_MS, 'main', 'info', 'recent entry');

    insert.run(Date.now(), 'main', 'info', 'new entry');

    const rows = db.prepare('SELECT message FROM logs').all() as { message: string }[];
    expect(rows).toHaveLength(2);
  });

  it('caps the logs table at 100000 rows', async () => {
    const { default: db } = await import('./db.js');
    const insert = db.prepare(
      'INSERT INTO logs (timestamp, process, level, message) VALUES (?, ?, ?, ?)',
    );
    const insertMany = db.transaction((count: number) => {
      for (let i = 0; i < count; i++) {
        insert.run(Date.now(), 'main', 'info', 'row');
      }
    });

    insertMany(100005);

    const { count } = db.prepare('SELECT COUNT(*) AS count FROM logs').get() as {
      count: number;
    };
    expect(count).toBeLessThanOrEqual(100000);
  });
});
