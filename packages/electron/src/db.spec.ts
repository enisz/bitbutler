import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: () => '/fake' },
}));

const legacySetup = vi.hoisted(() => ({
  run: null as null | ((db: { exec: (sql: string) => void }) => void),
}));

vi.mock('better-sqlite3', async () => {
  const actual = await vi.importActual<typeof import('better-sqlite3')>('better-sqlite3');
  const RealDatabase = actual.default;
  return {
    default: class extends RealDatabase {
      constructor() {
        super(':memory:');
        legacySetup.run?.(this);
      }
    },
  };
});

interface QueryableDb {
  prepare: (sql: string) => { all: (...params: unknown[]) => unknown[] };
}

const namesOf = (db: QueryableDb, type: string): string[] =>
  (db.prepare('SELECT name FROM sqlite_master WHERE type = ?').all(type) as { name: string }[]).map(
    (r) => r.name,
  );

describe('legacy logs table', () => {
  beforeEach(() => {
    vi.resetModules();
    legacySetup.run = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not create a logs table on a fresh database', async () => {
    const { default: db } = await import('./db.js');
    expect(namesOf(db, 'table')).not.toContain('logs');
    expect(namesOf(db, 'trigger')).not.toContain('trg_logs_retention');
  });

  it('drops the logs table, index and retention trigger left by older versions', async () => {
    legacySetup.run = (legacy) =>
      legacy.exec(`
        CREATE TABLE logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp INTEGER NOT NULL,
          process TEXT NOT NULL,
          level TEXT NOT NULL,
          message TEXT NOT NULL,
          context TEXT, filename TEXT, line INTEGER
        );
        CREATE INDEX idx_logs_timestamp ON logs(timestamp);
        CREATE TRIGGER trg_logs_retention AFTER INSERT ON logs BEGIN SELECT 1; END;
        INSERT INTO logs (timestamp, process, level, message) VALUES (1, 'main', 'info', 'old');
      `);

    const { default: db } = await import('./db.js');

    expect(namesOf(db, 'table')).not.toContain('logs');
    expect(namesOf(db, 'index')).not.toContain('idx_logs_timestamp');
    expect(namesOf(db, 'trigger')).not.toContain('trg_logs_retention');
    expect(namesOf(db, 'table')).toContain('servers');
  });
});
