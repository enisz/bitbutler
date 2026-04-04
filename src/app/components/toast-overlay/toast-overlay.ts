import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faCircleCheck,
  faCircleInfo,
  faCircleXmark,
  faTriangleExclamation,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { Toast, ToastType } from '../../models/toast.model';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'bb-toast-container',
  standalone: true,
  imports: [FontAwesomeModule],
  templateUrl: './toast-overlay.html',
  styleUrls: ['./toast-overlay.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastOverlay {
  private readonly toastService = inject(ToastService);

  readonly toasts = signal<Toast[]>([]);
  readonly xmark = faXmark;
  readonly icons: Record<ToastType, any> = {
    primary: faCircleInfo,
    secondary: faCircleInfo,
    success: faCircleCheck,
    danger: faCircleXmark,
    warning: faTriangleExclamation,
    info: faCircleInfo,
    light: faCircleInfo,
    dark: faCircleInfo,
  };

  add(toast: Toast) {
    this.toasts.update((t) => [...t, toast]);
  }

  beginDismiss(id: string) {
    this.toasts.update((t) =>
      t.map((toast) => (toast.id === id ? { ...toast, isClosing: true } : toast)),
    );
  }

  remove(id: string) {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }

  dismiss(id: string) {
    this.toastService.dismiss(id);
  }

  iconFor(type: ToastType) {
    return this.icons[type];
  }

  onEnter(id: string) {
    this.toastService.pause(id);
  }

  onLeave(id: string) {
    this.toastService.resume(id);
  }
}
