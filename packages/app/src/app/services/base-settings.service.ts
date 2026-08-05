import { inject } from '@angular/core';
import { Observable, ReplaySubject } from 'rxjs';
import { SettingsService } from './settings.service';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    value.constructor === Object
  );
}

function mergeUnknown(defaults: unknown, stored: unknown): unknown {
  if (!isPlainObject(defaults) || !isPlainObject(stored)) {
    return stored;
  }

  const merged: Record<string, unknown> = { ...defaults };
  for (const key of Object.keys(stored)) {
    merged[key] = mergeUnknown(defaults[key], stored[key]);
  }
  return merged;
}

function deepMergeDefaults<T>(defaults: T, stored: Partial<T>): T {
  return mergeUnknown(defaults, stored) as T;
}

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

        const rawSettings = deepMergeDefaults(this.DEFAULT_SETTINGS, stored ?? {});
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
