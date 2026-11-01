import type { QbErrorCode } from '@bitbutler/shared';

/** A failed qBittorrent bridge call, carrying the bridge's error code and message. */
export class QbError extends Error {
  constructor(
    readonly code: QbErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'QbError';
  }
}
