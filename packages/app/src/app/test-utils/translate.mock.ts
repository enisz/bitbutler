import { EMPTY, Subject } from 'rxjs';

export function mockTranslateService() {
  return {
    instant: vi.fn().mockReturnValue(''),
    get: vi.fn().mockReturnValue(EMPTY),
    getParsedResult: vi.fn().mockReturnValue(''),
    onTranslationChange: new Subject(),
    onLangChange: new Subject(),
    onFallbackLangChange: new Subject(),
    getCurrentLang: vi.fn().mockReturnValue('en'),
    getFallbackLang: vi.fn().mockReturnValue(null),
  };
}
