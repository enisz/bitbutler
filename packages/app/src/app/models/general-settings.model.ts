import { ThemeFamily, ThemeMode } from '../services/theme.service';

export type ToastPosition = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';
export type SavePathInputType = 'select' | 'typeahead';

export interface GeneralSettings {
  behavior: {
    deleteTorrentFile: boolean;
    automaticUpdate: boolean;
    toastPosition: ToastPosition;
  };
  language: {
    language: string;
  };
  appearance: {
    family: ThemeFamily;
    mode: ThemeMode;
  };
  startup: {
    openAtLogin: boolean;
    startMinimized: boolean;
  };
  savePath: {
    inputType: SavePathInputType;
  };
}

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  behavior: {
    deleteTorrentFile: true,
    automaticUpdate: true,
    toastPosition: 'bottom-right',
  },
  language: {
    language: 'us',
  },
  appearance: {
    family: 'bitbutler',
    mode: 'system',
  },
  startup: {
    openAtLogin: false,
    startMinimized: false,
  },
  savePath: {
    inputType: 'select',
  },
};
