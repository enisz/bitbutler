import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NgSelectConfig } from '@ng-select/ng-select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TimeagoIntl, provideTimeago } from 'ngx-timeago';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App, TranslateModule.forRoot()],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideTimeago({ intl: { provide: TimeagoIntl, useClass: TimeagoIntl } }),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should configure ng-select labels from translations', () => {
    TestBed.createComponent(App);

    const ngSelectConfig = TestBed.inject(NgSelectConfig);

    expect(ngSelectConfig.addTagText).toBe('general.form.ng-select.add-tag');
    expect(ngSelectConfig.clearAllText).toBe('general.form.ng-select.clear-all');
    expect(ngSelectConfig.loadingText).toBe('general.form.ng-select.loading');
    expect(ngSelectConfig.notFoundText).toBe('general.form.ng-select.not-found');
    expect(ngSelectConfig.typeToSearchText).toBe('general.form.ng-select.type-to-search');
  });

  it('should re-apply ng-select labels when the language changes', () => {
    TestBed.createComponent(App);

    const translateService = TestBed.inject(TranslateService);
    const instantSpy = vi.spyOn(translateService, 'instant');
    instantSpy.mockClear();

    translateService.use('hu');

    expect(instantSpy).toHaveBeenCalledWith('general.form.ng-select.add-tag');
    expect(instantSpy).toHaveBeenCalledWith('general.form.ng-select.clear-all');
    expect(instantSpy).toHaveBeenCalledWith('general.form.ng-select.loading');
    expect(instantSpy).toHaveBeenCalledWith('general.form.ng-select.not-found');
    expect(instantSpy).toHaveBeenCalledWith('general.form.ng-select.type-to-search');
  });
});
