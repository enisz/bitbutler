import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockShow = vi.hoisted(() => vi.fn());
const mockIsSupported = vi.hoisted(() => vi.fn(() => true));
const MockNotification = vi.hoisted(() => {
  // Vitest 4 invokes a mock's implementation through `Reflect.construct` when the mock is called
  // with `new`, so the implementation has to be a `function` (arrow functions are not constructable).
  const Ctor = vi.fn().mockImplementation(function () {
    return { show: mockShow };
  });
  (Ctor as unknown as { isSupported: ReturnType<typeof vi.fn> }).isSupported = mockIsSupported;
  return Ctor;
});

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => '/fake/app',
  },
  Notification: MockNotification,
}));

describe('notify', () => {
  beforeEach(() => {
    vi.resetModules();
    mockIsSupported.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when Notification.isSupported() is false', async () => {
    mockIsSupported.mockReturnValue(false);
    const { notify } = await import('./notification.js');
    expect(notify('Test', 'body')).toBeNull();
  });

  it('creates Notification with correct title', async () => {
    const { notify } = await import('./notification.js');
    notify('Hello', 'World');
    expect(MockNotification).toHaveBeenCalledWith(expect.objectContaining({ title: 'Hello' }));
  });

  it('creates Notification with correct body', async () => {
    const { notify } = await import('./notification.js');
    notify('Hello', 'World');
    expect(MockNotification).toHaveBeenCalledWith(expect.objectContaining({ body: 'World' }));
  });

  it('defaults body to empty string when not provided', async () => {
    const { notify } = await import('./notification.js');
    notify('Hello');
    expect(MockNotification).toHaveBeenCalledWith(expect.objectContaining({ body: '' }));
  });

  it('passes silent: true when option is set', async () => {
    const { notify } = await import('./notification.js');
    notify('Hello', 'body', { silent: true });
    expect(MockNotification).toHaveBeenCalledWith(expect.objectContaining({ silent: true }));
  });

  it('passes silent: false by default', async () => {
    const { notify } = await import('./notification.js');
    notify('Hello');
    expect(MockNotification).toHaveBeenCalledWith(expect.objectContaining({ silent: false }));
  });

  it('calls show() on the created notification', async () => {
    const { notify } = await import('./notification.js');
    notify('Hello');
    expect(mockShow).toHaveBeenCalled();
  });

  it('returns the Notification instance on success', async () => {
    const { notify } = await import('./notification.js');
    const result = notify('Hello');
    expect(result).toBeTruthy();
    expect(result).toHaveProperty('show');
  });

  it('returns null when the Notification constructor throws', async () => {
    MockNotification.mockImplementationOnce(function () {
      throw new Error('constructor failed');
    });
    const { notify } = await import('./notification.js');
    expect(notify('Hello')).toBeNull();
  });
});
