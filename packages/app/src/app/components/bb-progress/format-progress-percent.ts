export function formatProgressPercent(percent: number): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const rounded = Math.round((clamped + Number.EPSILON) * 10) / 10;

  if (rounded === 0 || rounded === 100) return `${rounded}%`;
  return `${rounded.toFixed(1)}%`;
}
