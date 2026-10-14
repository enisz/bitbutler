/** True when any of the named top-level sections differs between two form snapshots. */
export function hasChangedSections<T extends object>(
  current: T,
  baseline: T,
  sections: readonly (keyof T)[],
): boolean {
  return sections.some(
    (section) => JSON.stringify(current[section]) !== JSON.stringify(baseline[section]),
  );
}
