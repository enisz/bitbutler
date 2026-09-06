export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogProcess = 'main' | 'renderer';

export interface RendererLogEntry {
  level: LogLevel;
  message: string;
  context: string | null;
  filename: string | null;
  line: number | null;
  column: number | null;
}

export interface LogEntry {
  id: number;
  timestamp: number;
  process: LogProcess;
  level: LogLevel;
  message: string;
  context: string | null;
  filename: string | null;
  line: number | null;
}
