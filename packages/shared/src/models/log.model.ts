export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface RendererLogEntry {
  level: LogLevel;
  message: string;
  filename: string | null;
  line: number | null;
  column: number | null;
}
