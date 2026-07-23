import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

type TranslationMap = Record<string, unknown>;

let translations: TranslationMap = {};
let currentLang = 'us';

function getI18nFilePath(lang: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'i18n', `${lang}.json`);
  }
  return path.join(app.getAppPath(), 'public', 'i18n', `${lang}.json`);
}

export function loadTranslations(lang: string): void {
  currentLang = lang;
  const filePath = getI18nFilePath(lang);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    translations = JSON.parse(content) as TranslationMap;
  } catch (e) {
    console.warn(`[i18n] Failed to load translations for "${lang}":`, e);
    translations = {};
  }
}

export function getCurrentLanguage(): string {
  return currentLang;
}

export function t(key: string): string {
  const value = key.split('.').reduce<unknown>((obj, k) => {
    if (obj !== null && typeof obj === 'object') {
      return (obj as TranslationMap)[k];
    }
    return undefined;
  }, translations);
  return typeof value === 'string' ? value : key;
}
