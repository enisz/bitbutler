import { inject } from '@angular/core';
import { Observable, ReplaySubject } from 'rxjs';
import { SettingsService } from './settings.service';

export abstract class BaseSettingsService<T> {
  protected settings = inject(SettingsService);

  protected abstract readonly SETTINGS_ID: string;
  protected abstract readonly DEFAULT_SETTINGS: T;

  private settings$ = new ReplaySubject<T>(1);
  private loadPromise: Promise<T> | null = null;

  private loadedId: string | null = null;

  public asObservable(): Observable<T> {
    if (!this.loadPromise) {
      this.load();
    }
    return this.settings$.asObservable();
  }

  public load(): Promise<T> {
    if (this.loadPromise && this.loadedId !== this.SETTINGS_ID) {
      this.loadPromise = null;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadedId = this.SETTINGS_ID;
    this.loadPromise = (async () => {
      try {
        const stored = await this.settings.get<Partial<T>>(this.SETTINGS_ID);

        const rawSettings = { ...this.DEFAULT_SETTINGS, ...(stored ?? {}) } as T;
        const settings = this.normalize(rawSettings);

        if (!stored) {
          await this.settings.set(this.SETTINGS_ID, settings);
        }

        this.settings$.next(settings);
        return settings;
      } catch (error) {
        this.loadPromise = null;
        this.loadedId = null;
        throw error;
      }
    })();

    return this.loadPromise;
  }

  public reload(): Promise<T> {
    this.loadPromise = null;
    return this.load();
  }

  async save(settings: T): Promise<void> {
    const newSettings = this.normalize(settings);
    await this.settings.set(this.SETTINGS_ID, newSettings);
    this.settings$.next(newSettings);
    this.loadPromise = Promise.resolve(newSettings);
  }

  protected normalize(settings: T): T {
    return settings;
  }
}
