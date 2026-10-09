import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockInitLogger = vi.hoisted(() => vi.fn());
vi.mock('./logger.js', () => ({ initLogger: mockInitLogger }));

describe('logger-bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    mockInitLogger.mockClear();
  });

  it('initializes the logger when imported', async () => {
    await import('./logger-bootstrap.js');
    expect(mockInitLogger).toHaveBeenCalledTimes(1);
  });
});
