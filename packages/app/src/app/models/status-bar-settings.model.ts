export interface StatusBarSettings {
  available: string[];
  left: string[];
  right: string[];
}

export const DEFAULT_STATUS_BAR_SETTINGS: StatusBarSettings = {
  available: ['selection'],
  left: ['connection-status', 'nodes', 'ratio', 'global-down', 'global-up'],
  right: ['download-speed', 'upload-speed', 'free-space', 'polling-indicator'],
};
