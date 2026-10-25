export function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Field '${field}' is required.`);
  }
  return value.trim();
}

export function requireNonEmptyHost(value: unknown, field: string): string {
  const host = requireString(value, field);
  if (host.includes('://') || host.includes('/') || host.includes(' ')) {
    throw new Error(`Field '${field}' must be a host only (no protocol/path).`);
  }
  return host;
}

export function requirePort(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(`Field '${field}' must be an integer between 1 and 65535.`);
  }
  return n;
}
