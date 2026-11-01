import type { IpcResult, QbErrorCode } from '@bitbutler/shared';

/**
 * Why a failure happened when the code alone is ambiguous. `missing-cookie` marks an UNAUTHENTICATED
 * error raised locally because no session exists (for example after a logout), as opposed to a real
 * 401/403 from qBittorrent - only the latter may be recovered by logging in again.
 */
export type QbErrorReason = 'missing-cookie';

export class QbBridgeError extends Error {
  constructor(
    public readonly code: QbErrorCode,
    message: string,
    public readonly status?: number,
    public readonly reason?: QbErrorReason,
  ) {
    super(message);
    this.name = 'QbBridgeError';
  }
}

interface HttpErrorShape {
  status: number;
  body?: string;
  statusText?: string;
}

function parseHttpError(err: unknown): HttpErrorShape | undefined {
  if (typeof err !== 'string') return undefined;
  try {
    const parsed = JSON.parse(err) as Partial<HttpErrorShape> & { name?: string };
    if (parsed?.name === 'QbHttpError' && typeof parsed.status === 'number') {
      return parsed as HttpErrorShape;
    }
  } catch {
    // not JSON
  }
  return undefined;
}

function codeForStatus(status: number, login: boolean): QbErrorCode {
  if (status === 400 || status === 415) return 'INVALID';
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return login ? 'FORBIDDEN' : 'UNAUTHENTICATED';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 408 || status === 429 || status >= 500) return 'UNREACHABLE';
  return 'FAILED';
}

export function toQbError(err: unknown, opts: { login?: boolean } = {}): QbBridgeError {
  if (err instanceof QbBridgeError) return err;

  const http = parseHttpError(err);
  if (http) {
    const message = http.body || http.statusText || `HTTP ${http.status}`;
    return new QbBridgeError(codeForStatus(http.status, opts.login ?? false), message, http.status);
  }

  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof TypeError) return new QbBridgeError('UNREACHABLE', message);
  // AbortSignal.timeout() rejects with a TimeoutError DOMException when the server never answers.
  if ((err as { name?: string } | null)?.name === 'TimeoutError') {
    return new QbBridgeError('UNREACHABLE', message);
  }
  if (message.startsWith('Not logged in')) {
    return new QbBridgeError('UNAUTHENTICATED', message, undefined, 'missing-cookie');
  }
  // INVALID, not NOT_FOUND: that code means an HTTP 404 (a missing torrent or endpoint).
  if (message.startsWith('Server not found')) return new QbBridgeError('INVALID', message);
  return new QbBridgeError('FAILED', message);
}

export async function toResult<T>(fn: () => Promise<T>): Promise<IpcResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    const e = toQbError(err);
    return { ok: false, code: e.code, message: e.message };
  }
}
