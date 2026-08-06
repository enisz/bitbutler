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

describe('logger integration', () => {
  let originalConsoleInfo: (...args: unknown[]) => void;

  beforeEach(() => {
    vi.resetModules();
    originalConsoleInfo = console.info;
  });

  afterEach(() => {
    console.info = originalConsoleInfo;
  });

  it('writes a real row into the logs table via the real db module', async () => {
    const { default: db } = await import('./db.js');
    const { initLogger } = await import('./logger.js');
    initLogger();

    console.info('integration test message');

    const rows = db.prepare('SELECT * FROM logs').all() as {
      process: string;
      level: string;
      message: string;
    }[];

    expect(rows).toHaveLength(1);
    expect(rows[0].process).toBe('main');
    expect(rows[0].level).toBe('info');
    expect(rows[0].message).toContain('integration test message');
  });
});
