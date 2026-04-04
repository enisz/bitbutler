export interface ServerSettings {
  pathMappings: { remote: string; local: string }[];
  polling: {
    foreground: number;
    background: number;
  };
}

export const DEFAULT_SERVER_SETTINGS: ServerSettings = {
  pathMappings: [],
  polling: {
    foreground: 2000,
    background: 5000,
  },
};
