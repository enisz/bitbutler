import { QB_METHODS } from '@bitbutler/shared';
import { describe, expect, it } from 'vitest';

describe('QB_METHODS', () => {
  it('lists all 56 bridge methods', () => {
    expect(QB_METHODS).toHaveLength(56);
  });

  it('uses stop/start rather than pause/resume', () => {
    expect(QB_METHODS).toContain('torrents.stop');
    expect(QB_METHODS).toContain('torrents.start');
    expect(QB_METHODS).not.toContain('torrents.pause');
    expect(QB_METHODS).not.toContain('torrents.resume');
  });

  it('has no duplicates', () => {
    expect(new Set(QB_METHODS).size).toBe(QB_METHODS.length);
  });
});
