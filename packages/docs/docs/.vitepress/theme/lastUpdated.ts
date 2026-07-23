import dayjs from 'dayjs';
import 'dayjs/locale/hu';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

function ordinalSuffix(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return 'th';

  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

// Returns HTML - the English ordinal suffix is wrapped in <sup>, e.g. "22<sup>nd</sup> of July, 2026 (2 days ago)".
export function formatLastUpdated(date: Date, lang: string): string {
  const isHungarian = lang.startsWith('hu');
  const instance = isHungarian ? dayjs(date).locale('hu') : dayjs(date);
  const day = instance.date();
  const datePart = isHungarian
    ? instance.format('YYYY. MMMM D.')
    : `${day}<sup class="ordinal-suffix">${ordinalSuffix(day)}</sup> of ${instance.format('MMMM, YYYY')}`;

  return `${datePart} (${instance.fromNow()})`;
}
