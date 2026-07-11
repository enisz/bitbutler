let nextInstanceId = 0;

export function createFilterInstanceId(prefix: string): string {
  return `${prefix}-${nextInstanceId++}`;
}
