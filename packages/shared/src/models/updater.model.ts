export interface UpdateCapability {
  supported: boolean;
}

export type UpdaterEvent =
  | { status: 'checking' }
  | { status: 'downloading'; percent: number; transferred: number; total: number }
  | { status: 'downloaded' }
  | { status: 'error'; message: string };
