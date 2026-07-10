import { ThemeFamily, ThemeMode } from '../services/theme.service';

export type ToastPosition = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';
export type SavePathInputType = 'select' | 'typeahead';

export type DateFormatPreset = 'follow-language' | 'iso' | 'us' | 'eu' | 'custom';

export const DATE_FORMAT_PRESETS: DateFormatPreset[] = [
  'follow-language',
  'iso',
  'us',
  'eu',
  'custom',
];

export const LANGUAGE_LOCALE_MAP: Record<string, string> = {
  us: 'en-US',
  hu: 'hu-HU',
};

export const DEFAULT_LOCALE = 'en-US';

export interface GeneralSettings {
  behavior: {
    deleteTorrentFile: boolean;
    automaticUpdate: boolean;
    toastPosition: ToastPosition;
  };
  language: {
    language: string;
  };
  dateFormat: {
    preset: DateFormatPreset;
    customPattern: string;
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
  dateFormat: {
    preset: 'iso',
    customPattern: 'yyyy-MM-dd HH:mm',
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

export function resolveDateFormat(settings: Pick<GeneralSettings, 'language' | 'dateFormat'>): {
  pattern: string;
  locale: string;
} {
  const locale = LANGUAGE_LOCALE_MAP[settings.language.language] ?? DEFAULT_LOCALE;

  switch (settings.dateFormat.preset) {
    case 'follow-language':
      return { pattern: 'short', locale };
    case 'us':
      return { pattern: 'MM/dd/yyyy hh:mm a', locale };
    case 'eu':
      return { pattern: 'dd.MM.yyyy HH:mm', locale };
    case 'custom':
      return { pattern: settings.dateFormat.customPattern || 'yyyy-MM-dd HH:mm', locale };
    case 'iso':
    default:
      return { pattern: 'yyyy-MM-dd HH:mm', locale };
  }
}
