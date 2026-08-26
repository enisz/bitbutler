export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface RendererLogEntry {
  level: LogLevel;
  message: string;
  context: string | null;
  filename: string | null;
  line: number | null;
  column: number | null;
}
