export type ToastType =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'light'
  | 'dark';

export type ToastActionKind = 'primary' | 'outline' | 'text';

export interface ToastAction {
  label: string;
  /** Rightmost action is the primary one; secondary actions sit to its left. Defaults to 'outline'. */
  kind?: ToastActionKind;
  onClick: () => void;
}

export interface Toast {
  id: string;
  title: string;
  html: string;
  type: ToastType;
  duration: number;
  actions?: ToastAction[];
  /** Runs when the toast is closed without one of its actions being chosen. */
  onDismiss?: () => void;
  isClosing?: boolean;
}
