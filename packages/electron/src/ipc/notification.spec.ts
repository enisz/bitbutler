import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ipcHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const mockNotify = vi.hoisted(() => vi.fn(() => ({ show: vi.fn() })));

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, handler);
    }),
  },
}));

vi.mock('../notification.js', () => ({
  notify: mockNotify,
}));

describe('notification:show IPC handler', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function getHandler() {
    const { registerNotificationIpcHandlers } = await import('./notification.js');
    registerNotificationIpcHandlers();
    return ipcHandlers.get('notification:show')!;
  }

  it('returns { ok: false, error: "Missing title" } when payload is empty', async () => {
    const handler = await getHandler();
    expect(await handler(null, {})).toEqual({ ok: false, error: 'Missing title' });
  });

  it('returns { ok: false } when title is not a string', async () => {
    const handler = await getHandler();
    expect(await handler(null, { title: 42 })).toEqual({ ok: false, error: 'Missing title' });
  });

  it('returns { ok: false } when title is empty whitespace', async () => {
    const handler = await getHandler();
    expect(await handler(null, { title: '   ' })).toEqual({ ok: false, error: 'Missing title' });
  });

  it('returns { ok: false } when payload is not an object', async () => {
    const handler = await getHandler();
    expect(await handler(null, 'string-payload')).toEqual({ ok: false, error: 'Missing title' });
  });

  it('returns { ok: false } when payload is an array', async () => {
    const handler = await getHandler();
    expect(await handler(null, ['title'])).toEqual({ ok: false, error: 'Missing title' });
  });

  it('returns { ok: false } when payload is null', async () => {
    const handler = await getHandler();
    expect(await handler(null, null)).toEqual({ ok: false, error: 'Missing title' });
  });

  it('calls notify with the title and empty body when body is absent', async () => {
    const handler = await getHandler();
    await handler(null, { title: 'Alert' });
    expect(mockNotify).toHaveBeenCalledWith('Alert', '', null);
  });

  it('calls notify with title and body when both are provided', async () => {
    const handler = await getHandler();
    await handler(null, { title: 'Alert', body: 'Something happened' });
    expect(mockNotify).toHaveBeenCalledWith('Alert', 'Something happened', null);
  });

  it('returns { ok: true, shown: true } when notify returns a notification object', async () => {
    mockNotify.mockReturnValue({ show: vi.fn() });
    const handler = await getHandler();
    expect(await handler(null, { title: 'Alert' })).toEqual({ ok: true, shown: true });
  });

  it('returns { ok: true, shown: false } when notify returns null', async () => {
    mockNotify.mockReturnValue(null);
    const handler = await getHandler();
    expect(await handler(null, { title: 'Alert' })).toEqual({ ok: true, shown: false });
  });

  it('truncates title longer than 120 characters', async () => {
    const longTitle = 'x'.repeat(150);
    const handler = await getHandler();
    await handler(null, { title: longTitle });
    const calledTitle = vi.mocked(mockNotify).mock.calls[0][0] as string;
    expect(calledTitle.length).toBe(120);
  });

  it('truncates body longer than 600 characters', async () => {
    const longBody = 'y'.repeat(700);
    const handler = await getHandler();
    await handler(null, { title: 'Alert', body: longBody });
    const calledBody = vi.mocked(mockNotify).mock.calls[0][1] as string;
    expect(calledBody.length).toBe(600);
  });

  it('passes options.silent to notify', async () => {
    const handler = await getHandler();
    await handler(null, { title: 'Alert', options: { silent: true } });
    expect(mockNotify).toHaveBeenCalledWith('Alert', '', { silent: true });
  });

  it('ignores options when it is not a plain object', async () => {
    const handler = await getHandler();
    await handler(null, { title: 'Alert', options: 'not-an-object' });
    expect(mockNotify).toHaveBeenCalledWith('Alert', '', null);
  });

  it('ignores body when it is not a string', async () => {
    const handler = await getHandler();
    await handler(null, { title: 'Alert', body: 123 });
    expect(mockNotify).toHaveBeenCalledWith('Alert', '', null);
  });
});
