import type { LogEntry } from '@bitbutler/shared';

export const LOG_EXPORT_FORMAT_TOKENS = [
  'date',
  'process',
  'level',
  'message',
  'context',
  'filename',
  'line',
  'id',
] as const;

export type LogExportFormatToken = (typeof LOG_EXPORT_FORMAT_TOKENS)[number];

export interface LogExportDateFormatter {
  format(value: number | string | undefined): string;
}

export function renderLogFormatTemplate(
  template: string,
  entry: LogEntry,
  dateFormatter: LogExportDateFormatter,
): string {
  const values: Record<LogExportFormatToken, string> = {
    date: dateFormatter.format(entry.timestamp),
    process: entry.process,
    level: entry.level,
    message: entry.message,
    context: entry.context ?? '',
    filename: entry.filename ?? '',
    line: entry.line == null ? '' : String(entry.line),
    id: String(entry.id),
  };

  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, token: string) =>
    Object.prototype.hasOwnProperty.call(values, token)
      ? values[token as LogExportFormatToken]
      : match,
  );
}
