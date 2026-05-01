export type ToastType =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'light'
  | 'dark';

export interface Toast {
  id: string;
  title: string;
  html: string;
  type: ToastType;
  duration: number;
  isClosing?: boolean;
}
