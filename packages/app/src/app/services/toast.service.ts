import { GlobalPositionStrategy, Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { DestroyRef, Injectable, SecurityContext, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import { ToastOverlay } from '../components/toast-overlay/toast-overlay';
import { GeneralSettings, ToastPosition } from '../models/general-settings.model';
import { NotificationCategory, categoryForToastType } from '../models/notification.model';
import { Toast, ToastAction, ToastType } from '../models/toast.model';
import { GeneralSettingsService } from './general-settings.service';
import { NotificationPolicyService } from './notification-policy.service';
import { NotificationService } from './notification.service';
import { ThemeService } from './theme.service';

// A toast with actions has to outlive a glance: errors stay until dismissed, anything else gets
// a longer window than a plain toast. Hover/focus still pauses the timer.
const ACTION_TOAST_DURATION_MS = 8000;
const MAX_TOAST_ACTIONS = 2;

type TimerState = {
  timeoutId: number | null;
  startedAt: number;
  remainingMs: number;
  paused: boolean;
};

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly overlay = inject(Overlay);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly themeService = inject(ThemeService);
  private readonly generalSettingsService = inject(GeneralSettingsService);
  private readonly translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notificationPolicy = inject(NotificationPolicyService);
  private readonly notificationService = inject(NotificationService);

  private overlayRef?: OverlayRef;
  private container?: ToastOverlay;
  private settings?: GeneralSettings;

  private timers = new Map<string, TimerState>();

  constructor() {
    this.generalSettingsService
      .asObservable()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((settings) => {
        this.settings = settings;
        this.updatePosition(settings.notifications.app.position);
      });
  }

  private ensureContainer() {
    if (this.container) return;

    this.overlayRef = this.overlay.create({
      positionStrategy: this.getPositionStrategy(),
      scrollStrategy: this.overlay.scrollStrategies.noop(),
      hasBackdrop: false,
    });

    const ref = this.overlayRef.attach(new ComponentPortal(ToastOverlay));
    this.container = ref.instance;
    this.container.position.set(this.settings?.notifications.app.position ?? 'bottom-right');
  }

  private getPositionStrategy(position?: ToastPosition): GlobalPositionStrategy {
    const toastPosition = position ?? this.settings?.notifications.app.position ?? 'bottom-right';

    const positionStrategy = this.overlay.position().global();
    switch (toastPosition) {
      case 'top-left':
        positionStrategy.top('25px').left('25px');
        break;
      case 'top-right':
        positionStrategy.top('25px').right('25px');
        break;
      case 'bottom-left':
        positionStrategy.bottom('25px').left('25px');
        break;
      case 'bottom-right':
      default:
        positionStrategy.bottom('25px').right('25px');
        break;
    }
    return positionStrategy;
  }

  private updatePosition(position: ToastPosition) {
    if (!this.overlayRef) {
      return;
    }
    this.overlayRef.updatePositionStrategy(this.getPositionStrategy(position));
    this.container?.position.set(position);
  }

  private sanitizeHtml(html: string): string {
    return this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
  }

  showHtml(
    html: string,
    opts: {
      title?: string;
      type?: ToastType;
      duration?: number;
      actions?: ToastAction[];
      onDismiss?: () => void;
      category?: NotificationCategory;
      notifyOs?: boolean;
    } = {},
  ): string {
    const type = opts.type ?? 'info';
    const title = opts.title ?? this.translateService.instant('general.toast.notification');
    const category = opts.category ?? categoryForToastType(type);
    const safeHtml = this.sanitizeHtml(html);
    const actions = opts.actions?.slice(0, MAX_TOAST_ACTIONS);

    const plainText = this.htmlToText(safeHtml);
    if (opts.notifyOs !== false && this.notificationPolicy.allowOs(category, title, plainText)) {
      void this.notificationService.send(title, plainText);
    }

    if (!this.notificationPolicy.allowApp(category)) {
      return '';
    }

    this.ensureContainer();

    const toast: Toast = {
      id: crypto.randomUUID(),
      title,
      html: safeHtml,
      type,
      duration: opts.duration ?? this.defaultDuration(type, actions),
      actions,
      onDismiss: opts.onDismiss,
    };

    this.container!.add(toast);

    if (toast.duration > 0) {
      this.startTimer(toast.id, toast.duration);
    }
    return toast.id;
  }

  showText(
    message: string,
    opts: {
      title?: string;
      type?: ToastType;
      duration?: number;
      actions?: ToastAction[];
      onDismiss?: () => void;
      category?: NotificationCategory;
      notifyOs?: boolean;
    } = {},
  ): string {
    const html = message
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('\n', '<br>');
    return this.showHtml(html, opts);
  }

  private defaultDuration(type: ToastType, actions?: ToastAction[]): number {
    if (!actions?.length) return 6000;
    return type === 'danger' ? 0 : ACTION_TOAST_DURATION_MS;
  }

  private htmlToText(html: string): string {
    const withBreaks = html.replace(/<br\s*\/?>/gi, '\n');
    return new DOMParser().parseFromString(withBreaks, 'text/html').body.textContent ?? '';
  }

  dismiss(id: string, opts: { actionChosen?: boolean } = {}) {
    if (!opts.actionChosen) {
      this.container
        ?.toasts()
        .find((t) => t.id === id && !t.isClosing)
        ?.onDismiss?.();
    }
    this.clearTimer(id);
    this.container?.beginDismiss(id);

    setTimeout(() => {
      this.container?.remove(id);
      this.cleanupOverlayIfEmpty();
    }, 350);
  }

  pause(id: string) {
    const s = this.timers.get(id);
    if (!s || s.paused) return;

    const elapsed = performance.now() - s.startedAt;
    s.remainingMs = Math.max(0, s.remainingMs - elapsed);
    s.paused = true;

    if (s.timeoutId !== null) {
      clearTimeout(s.timeoutId);
      s.timeoutId = null;
    }
  }

  resume(id: string) {
    const s = this.timers.get(id);
    if (!s || !s.paused) return;

    s.paused = false;
    this.startTimer(id, s.remainingMs);
  }

  private startTimer(id: string, ms: number) {
    if (ms <= 0) {
      this.dismiss(id);
      return;
    }

    this.clearTimer(id);

    const state: TimerState = {
      timeoutId: null,
      startedAt: performance.now(),
      remainingMs: ms,
      paused: false,
    };

    state.timeoutId = window.setTimeout(() => this.dismiss(id), ms);
    this.timers.set(id, state);
  }

  private clearTimer(id: string) {
    const s = this.timers.get(id);
    if (s && s.timeoutId !== null) {
      clearTimeout(s.timeoutId);
    }
    this.timers.delete(id);
  }

  private cleanupOverlayIfEmpty() {
    if (!this.container) return;
    if (this.container.toasts().length !== 0) return;

    this.overlayRef?.dispose();
    this.overlayRef = undefined;
    this.container = undefined;
  }

  primary(html: string, title: string, duration = 6000): string {
    return this.showHtml(html, { type: 'primary', title, duration });
  }

  secondary(html: string, title: string, duration = 6000): string {
    return this.showHtml(html, { type: 'secondary', title, duration });
  }

  success(html: string, title?: string, duration = 6000): string {
    return this.showHtml(html, {
      type: 'success',
      title: title ?? this.translateService.instant('general.toast.success'),
      duration,
    });
  }

  danger(html: string, title?: string, duration?: number, actions?: ToastAction[]): string {
    return this.showHtml(html, {
      type: 'danger',
      title: title ?? this.translateService.instant('general.toast.error'),
      duration: duration ?? (actions?.length ? undefined : 6000),
      actions,
    });
  }

  warning(html: string, title?: string, duration = 6000): string {
    return this.showHtml(html, {
      type: 'warning',
      title: title ?? this.translateService.instant('general.toast.warning'),
      duration,
    });
  }

  info(html: string, title?: string, duration = 6000): string {
    return this.showHtml(html, {
      type: 'info',
      title: title ?? this.translateService.instant('general.toast.info'),
      duration,
    });
  }

  light(html: string, title: string, duration = 6000): string {
    return this.showHtml(html, { type: 'light', title, duration });
  }

  dark(html: string, title: string, duration = 6000): string {
    return this.showHtml(html, { type: 'dark', title, duration });
  }

  // The inverse of the current mode, so the toast stands out from the surface behind it.
  adaptiveType(): 'light' | 'dark' {
    let mode = this.themeService.mode();

    if (mode === 'system') {
      mode = this.themeService.getSystemMode();
    }

    return mode === 'light' ? 'dark' : 'light';
  }

  adaptive(html: string, title: string, duration = 6000): string {
    return this.adaptiveType() === 'dark'
      ? this.dark(html, title, duration)
      : this.light(html, title, duration);
  }
}
