import { filesize } from 'filesize';

type BytesLike = number | bigint | string | null | undefined;

function toBigIntBytes(v: BytesLike): bigint {
  if (v == null) return 0n;
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') return BigInt(Math.trunc(v));
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return 0n;
    try {
      return BigInt(s);
    } catch {
      return 0n;
    }
  }
  return 0n;
}

function toSafeNumber(b: bigint): number {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (b <= 0n) return 0;
  if (b > max) return Number.MAX_SAFE_INTEGER;
  return Number(b);
}

export function formatBytes(v: BytesLike, opts?: Parameters<typeof filesize>[1]): string {
  const b = toBigIntBytes(v);
  return filesize(toSafeNumber(b), { standard: 'jedec', ...opts });
}

export function formatBytesPerSec(v: BytesLike, opts?: Parameters<typeof filesize>[1]): string {
  return `${formatBytes(v, opts)}/s`;
}
