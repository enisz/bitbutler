import { ThemeFamily, ThemeMode } from '../services/theme.service';

export type ToastPosition = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';

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
};
