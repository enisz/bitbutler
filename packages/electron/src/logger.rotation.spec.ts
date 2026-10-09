import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron-log/main', () => ({
  default: {
    transports: { file: {}, console: {}, ipc: {} },
    create: () => ({ transports: { file: {}, console: {}, ipc: {} } }),
  },
}));
vi.mock('./source-map-resolver.js', () => ({ resolveOriginalLocation: vi.fn() }));

describe('rotateLogFile', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-log-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const write = (name: string, content: string) => fs.writeFileSync(path.join(dir, name), content);
  const read = (name: string) => fs.readFileSync(path.join(dir, name), 'utf8');
  const files = () => fs.readdirSync(dir).sort();

  it('moves the active file to .1 when nothing has been rolled yet', async () => {
    const { rotateLogFile } = await import('./logger.js');
    write('main.log', 'active');

    rotateLogFile(path.join(dir, 'main.log'));

    expect(files()).toEqual(['main.1.log']);
    expect(read('main.1.log')).toBe('active');
  });

  it('shifts every rolled file up by one and drops the oldest', async () => {
    const { rotateLogFile } = await import('./logger.js');
    write('main.log', 'active');
    write('main.1.log', 'one');
    write('main.2.log', 'two');
    write('main.3.log', 'three');
    write('main.4.log', 'four');

    rotateLogFile(path.join(dir, 'main.log'));

    expect(files()).toEqual(['main.1.log', 'main.2.log', 'main.3.log', 'main.4.log']);
    expect(read('main.1.log')).toBe('active');
    expect(read('main.2.log')).toBe('one');
    expect(read('main.3.log')).toBe('two');
    expect(read('main.4.log')).toBe('three');
  });

  it('copes with gaps in the rolled sequence', async () => {
    const { rotateLogFile } = await import('./logger.js');
    write('main.log', 'active');
    write('main.2.log', 'two');

    rotateLogFile(path.join(dir, 'main.log'));

    expect(files()).toEqual(['main.1.log', 'main.3.log']);
    expect(read('main.3.log')).toBe('two');
  });

  it('leaves the other process files alone', async () => {
    const { rotateLogFile } = await import('./logger.js');
    write('main.log', 'm');
    write('renderer.log', 'r');
    write('renderer.1.log', 'r1');

    rotateLogFile(path.join(dir, 'main.log'));

    expect(files()).toEqual(['main.1.log', 'renderer.1.log', 'renderer.log']);
  });
});
