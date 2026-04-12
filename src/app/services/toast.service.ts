import { GlobalPositionStrategy, Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { DestroyRef, Injectable, SecurityContext, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer } from '@angular/platform-browser';
import { ToastOverlay } from '../components/toast-overlay/toast-overlay';
import { GeneralSettings, ToastPosition } from '../models/general-settings.model';
import { Toast, ToastType } from '../models/toast.model';
import { GeneralSettingsService } from './general-settings.service';
import { ThemeService } from './theme.service';

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
  private readonly destroyRef = inject(DestroyRef);

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
        this.updatePosition(settings.behavior.toastPosition);
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
  }

  private getPositionStrategy(position?: ToastPosition): GlobalPositionStrategy {
    const toastPosition = position ?? this.settings?.behavior.toastPosition ?? 'bottom-right';

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
    } = {},
  ): string {
    this.ensureContainer();

    const toast: Toast = {
      id: crypto.randomUUID(),
      title: opts.title ?? 'Notification',
      html: this.sanitizeHtml(html),
      type: opts.type ?? 'info',
      duration: opts.duration ?? 6000,
    };

    this.container!.add(toast);

    const duration = toast.duration ?? 0;
    if (duration > 0) {
      this.startTimer(toast.id, duration);
    }
    return toast.id;
  }

  showText(
    message: string,
    opts: { title?: string; type?: ToastType; duration?: number } = {},
  ): string {
    const html = message
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('\n', '<br>');
    return this.showHtml(html, opts);
  }

  dismiss(id: string) {
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

  success(html: string, title = 'Success', duration = 6000): string {
    return this.showHtml(html, { type: 'success', title, duration });
  }

  error(html: string, title = 'Error', duration = 6000): string {
    return this.showHtml(html, { type: 'danger', title, duration });
  }

  danger(html: string, title = 'Error', duration = 6000): string {
    return this.showHtml(html, { type: 'danger', title, duration });
  }

  warning(html: string, title = 'Warning', duration = 6000): string {
    return this.showHtml(html, { type: 'warning', title, duration });
  }

  info(html: string, title = 'Info', duration = 6000): string {
    return this.showHtml(html, { type: 'info', title, duration });
  }

  light(html: string, title: string, duration = 6000): string {
    return this.showHtml(html, { type: 'light', title, duration });
  }

  dark(html: string, title: string, duration = 6000): string {
    return this.showHtml(html, { type: 'dark', title, duration });
  }

  adaptive(html: string, title: string, duration = 6000): string {
    let mode = this.themeService.mode();

    if (mode === 'system') {
      mode = this.themeService.getSystemMode();
    }

    if (mode === 'light') {
      return this.dark(html, title, duration);
    } else {
      return this.light(html, title, duration);
    }
  }
}
