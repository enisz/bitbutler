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

export type FirstDayOfWeek = 'auto' | 'sunday' | 'monday' | 'saturday';

export const FIRST_DAY_OF_WEEK_OPTIONS: FirstDayOfWeek[] = ['auto', 'sunday', 'monday', 'saturday'];

export const LANGUAGE_LOCALE_MAP: Record<string, string> = {
  us: 'en-US',
  hu: 'hu-HU',
};

export const DEFAULT_LOCALE = 'en-US';

export interface GeneralSettings {
  behavior: {
    deleteTorrentFile: boolean;
    deleteTorrentFileOnDuplicate: boolean;
    automaticUpdate: boolean;
    toastPosition: ToastPosition;
  };
  language: {
    language: string;
  };
  dateFormat: {
    preset: DateFormatPreset;
    customPattern: string;
    firstDayOfWeek: FirstDayOfWeek;
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
    deleteTorrentFileOnDuplicate: true,
    automaticUpdate: true,
    toastPosition: 'bottom-right',
  },
  language: {
    language: 'us',
  },
  dateFormat: {
    preset: 'iso',
    customPattern: 'yyyy-MM-dd HH:mm',
    firstDayOfWeek: 'auto',
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

const TIME_TOKEN_PATTERN = /HH|hh|H|h|mm|ss|a/g;
const SEPARATOR_TRIM_PATTERN = /^[\s,./:-]+|[\s,./:-]+$/g;

function toDateOnlyPattern(pattern: string): string {
  const segments = pattern.match(/'[^']*'|[^']+/g) ?? [];
  const stripped = segments
    .map((segment) => (segment.startsWith("'") ? segment : segment.replace(TIME_TOKEN_PATTERN, '')))
    .join('')
    .replace(SEPARATOR_TRIM_PATTERN, '');

  return stripped || 'yyyy-MM-dd';
}

export function resolveDateFormat(settings: {
  language: Pick<GeneralSettings['language'], 'language'>;
  dateFormat: Pick<GeneralSettings['dateFormat'], 'preset' | 'customPattern'>;
}): {
  pattern: string;
  datePattern: string;
  locale: string;
} {
  const locale = LANGUAGE_LOCALE_MAP[settings.language.language] ?? DEFAULT_LOCALE;

  switch (settings.dateFormat.preset) {
    case 'follow-language':
      return { pattern: 'short', datePattern: 'shortDate', locale };
    case 'us':
      return { pattern: 'MM/dd/yyyy hh:mm a', datePattern: 'MM/dd/yyyy', locale };
    case 'eu':
      return { pattern: 'dd.MM.yyyy HH:mm', datePattern: 'dd.MM.yyyy', locale };
    case 'custom': {
      const pattern = settings.dateFormat.customPattern || 'yyyy-MM-dd HH:mm';
      return { pattern, datePattern: toDateOnlyPattern(pattern), locale };
    }
    case 'iso':
    default:
      return { pattern: 'yyyy-MM-dd HH:mm', datePattern: 'yyyy-MM-dd', locale };
  }
}

const FIXED_FIRST_DAY_OF_WEEK: Record<Exclude<FirstDayOfWeek, 'auto'>, number> = {
  sunday: 7,
  monday: 1,
  saturday: 6,
};

export function resolveFirstDayOfWeek(settings: {
  language: Pick<GeneralSettings['language'], 'language'>;
  dateFormat: Pick<GeneralSettings['dateFormat'], 'firstDayOfWeek'>;
}): number {
  const { firstDayOfWeek } = settings.dateFormat;

  if (firstDayOfWeek !== 'auto') {
    return FIXED_FIRST_DAY_OF_WEEK[firstDayOfWeek];
  }

  const locale = LANGUAGE_LOCALE_MAP[settings.language.language] ?? DEFAULT_LOCALE;

  try {
    // Intl.Locale#getWeekInfo isn't in TS's bundled lib.d.ts yet; the runtime supports it (Electron 39 / Chromium).
    const localeInfo = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
    };
    const weekInfo = localeInfo.getWeekInfo?.();
    if (weekInfo && Number.isInteger(weekInfo.firstDay)) {
      return weekInfo.firstDay;
    }
  } catch {
    // Malformed locale tag - fall through to the Monday default below.
  }

  return 1;
}
