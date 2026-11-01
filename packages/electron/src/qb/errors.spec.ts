import { describe, expect, it } from 'vitest';
import { QbBridgeError, toQbError, toResult } from './errors.js';

const http = (status: number, body = ''): string =>
  JSON.stringify({ name: 'QbHttpError', status, statusText: 'x', body, path: '/api/v2/x' });

describe('toQbError', () => {
  it.each([
    [http(400), 'INVALID'],
    [http(415), 'INVALID'],
    [http(401), 'UNAUTHENTICATED'],
    [http(403), 'UNAUTHENTICATED'],
    [http(404), 'NOT_FOUND'],
    [http(409), 'CONFLICT'],
    [http(408), 'UNREACHABLE'],
    [http(429), 'UNREACHABLE'],
    [http(500), 'UNREACHABLE'],
    [http(503), 'UNREACHABLE'],
    [http(418), 'FAILED'],
    [new TypeError('fetch failed'), 'UNREACHABLE'],
    [new DOMException('The operation timed out.', 'TimeoutError'), 'UNREACHABLE'],
    [new Error('Not logged in (missing cookie).'), 'UNAUTHENTICATED'],
    [new Error('Server not found.'), 'INVALID'],
    [new Error('boom'), 'FAILED'],
    ['x', 'FAILED'],
    [undefined, 'FAILED'],
  ])('maps %j to %s', (thrown, code) => {
    expect(toQbError(thrown).code).toBe(code);
  });

  it('marks a missing cookie so it is not mistaken for an expired session', () => {
    const e = toQbError(new Error('Not logged in (missing cookie).'));
    expect(e.code).toBe('UNAUTHENTICATED');
    expect(e.reason).toBe('missing-cookie');
    expect(e.status).toBeUndefined();
  });

  it('leaves a real 401 unmarked', () => {
    const e = toQbError(http(401));
    expect(e.reason).toBeUndefined();
    expect(e.status).toBe(401);
  });

  it('maps 403 to FORBIDDEN for login', () => {
    expect(toQbError(http(403), { login: true }).code).toBe('FORBIDDEN');
  });

  it('keeps the status and prefers the body as message', () => {
    const e = toQbError(http(409, 'Torrent exists'));
    expect(e).toBeInstanceOf(QbBridgeError);
    expect(e.status).toBe(409);
    expect(e.message).toBe('Torrent exists');
  });

  it('falls back to the error message', () => {
    expect(toQbError(new Error('boom')).message).toBe('boom');
  });

  it('returns an existing QbBridgeError unchanged', () => {
    const e = new QbBridgeError('CONFLICT', 'c', 409);
    expect(toQbError(e)).toBe(e);
  });
});

describe('toResult', () => {
  it('wraps success', async () => {
    expect(await toResult(async () => 5)).toEqual({ ok: true, data: 5 });
  });

  it('wraps a thrown error', async () => {
    const r = await toResult(async () => {
      throw new QbBridgeError('NOT_FOUND', 'nope');
    });
    expect(r).toEqual({ ok: false, code: 'NOT_FOUND', message: 'nope' });
  });

  it('never rejects for a non-Error throw', async () => {
    const r = await toResult(async () => {
      throw 'x';
    });
    expect(r).toEqual({ ok: false, code: 'FAILED', message: 'x' });
  });
});
