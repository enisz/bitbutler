import { ToastType } from './toast.model';

export type NotificationCategory = 'finished' | 'errors' | 'updates' | 'confirmations';

// Toasts raised by the generic helpers (success(), danger(), ...) fall into a category by
// their type; only the finished and update events pass an explicit category.
export function categoryForToastType(type: ToastType): NotificationCategory {
  return type === 'danger' || type === 'warning' ? 'errors' : 'confirmations';
}
