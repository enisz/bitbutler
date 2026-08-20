export interface UpdateSettings {
  skippedVersion: string | null;
}

export const DEFAULT_UPDATE_SETTINGS: UpdateSettings = {
  skippedVersion: null,
};

export function normalizeVersionTag(tag: string): string {
  return tag.replace(/^v/, '');
}
