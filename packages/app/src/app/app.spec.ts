import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NgSelectConfig } from '@ng-select/ng-select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TimeagoIntl, provideTimeago } from 'ngx-timeago';
import { App } from './app';
import { Maindata } from './models/torrent.model';
import { CommandBusService } from './services/command-bus.service';
import { OpenFilesService, PendingAddTorrent } from './services/open-files.service';
import { TorrentStoreService } from './services/torrent-store.service';
import { UiCommandHandlerService } from './services/ui-command-handler.service';

const makeMaindata = (opts: Partial<Maindata>): Maindata =>
  ({
    rid: 1,
    full_update: false,
    torrents: {},
    torrents_removed: [],
    ...opts,
  }) as Maindata;

const makePendingDraft = (overrides: {
  originalPath: string;
  infoHashV1?: string;
}): PendingAddTorrent => ({
  draft: {
    source: 'startup',
    receivedAt: Date.now(),
    originalPath: overrides.originalPath,
    torrent: overrides.infoHashV1
      ? { name: 'Movie', totalSize: 100, infoHashV1: overrides.infoHashV1, files: [] }
      : undefined,
  },
  selected: { name: 'movie.torrent', path: overrides.originalPath },
});

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App, TranslateModule.forRoot()],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideTimeago({ intl: { provide: TimeagoIntl, useClass: TimeagoIntl } }),
        // Real UiCommandHandlerService would act on the commands emitted below (e.g. actually
        // opening NgbModal), which doesn't work once the test environment tears down. App's own
        // command-emitting logic is what these tests cover; modal-opening behavior for
        // UI_ADD_TORRENT/UI_TORRENT_EXISTS is covered in ui-command-handler.service.spec.ts.
        { provide: UiCommandHandlerService, useValue: { start: vi.fn() } },
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

  describe('ng-select Escape interception in modals', () => {
    let overlayContainer: HTMLDivElement;
    let panel: HTMLDivElement;

    beforeEach(() => {
      overlayContainer = document.createElement('div');
      overlayContainer.className = 'cdk-overlay-container';
      panel = document.createElement('div');
      panel.className = 'ng-dropdown-panel';
      document.body.appendChild(overlayContainer);
    });

    afterEach(() => {
      overlayContainer.remove();
    });

    it('should close an open ng-select dropdown on Escape and stop it from also closing the modal', () => {
      overlayContainer.appendChild(panel);
      TestBed.createComponent(App);

      const mousedownSpy = vi.fn();
      const clickSpy = vi.fn();
      document.body.addEventListener('mousedown', mousedownSpy);
      document.body.addEventListener('click', clickSpy);

      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        cancelable: true,
        bubbles: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
      expect(mousedownSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();

      document.body.removeEventListener('mousedown', mousedownSpy);
      document.body.removeEventListener('click', clickSpy);
    });

    it('should not intercept Escape when no ng-select dropdown is open', () => {
      TestBed.createComponent(App);

      const mousedownSpy = vi.fn();
      document.body.addEventListener('mousedown', mousedownSpy);

      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        cancelable: true,
        bubbles: true,
      });
      document.dispatchEvent(event);

      expect(mousedownSpy).not.toHaveBeenCalled();

      document.body.removeEventListener('mousedown', mousedownSpy);
    });

    it('should not intercept non-Escape keys', () => {
      overlayContainer.appendChild(panel);
      TestBed.createComponent(App);

      const mousedownSpy = vi.fn();
      document.body.addEventListener('mousedown', mousedownSpy);

      const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
      document.dispatchEvent(event);

      expect(mousedownSpy).not.toHaveBeenCalled();

      document.body.removeEventListener('mousedown', mousedownSpy);
    });

    it('should not intercept Escape for a dropdown rendered inside an ag-grid filter popup', () => {
      const popupPortal = document.createElement('div');
      popupPortal.className = 'ag-custom-component-popup';
      popupPortal.appendChild(overlayContainer);
      document.body.appendChild(popupPortal);
      overlayContainer.appendChild(panel);
      TestBed.createComponent(App);

      const mousedownSpy = vi.fn();
      document.body.addEventListener('mousedown', mousedownSpy);

      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        cancelable: true,
        bubbles: true,
      });
      document.dispatchEvent(event);

      expect(mousedownSpy).not.toHaveBeenCalled();

      document.body.removeEventListener('mousedown', mousedownSpy);
      popupPortal.remove();
    });
  });

  describe('open files queue duplicate handling', () => {
    it('should emit UI_TORRENT_EXISTS and consume the draft, without opening AddTorrent, when the front item is already in the list', () => {
      const fixture = TestBed.createComponent(App);
      const openFilesService = TestBed.inject(OpenFilesService);
      const torrentStoreService = TestBed.inject(TorrentStoreService);
      const commandBusService = TestBed.inject(CommandBusService);
      const emitSpy = vi.spyOn(commandBusService, 'emit');

      torrentStoreService.applyMaindata(
        makeMaindata({ full_update: true, torrents: { abc123: { name: 'Movie' } as any } }),
      );

      openFilesService.pendingDrafts.set([
        makePendingDraft({ originalPath: '/tmp/movie.torrent', infoHashV1: 'ABC123' }),
      ]);

      fixture.detectChanges();

      expect(emitSpy).toHaveBeenCalledWith({
        type: 'UI_TORRENT_EXISTS',
        hash: 'abc123',
        originalPath: '/tmp/movie.torrent',
      });
      expect(emitSpy).not.toHaveBeenCalledWith({ type: 'UI_ADD_TORRENT' });
      expect(openFilesService.pendingDrafts()).toEqual([]);
    });

    it('should skip every leading duplicate and open AddTorrent once a new torrent is reached', () => {
      const fixture = TestBed.createComponent(App);
      const openFilesService = TestBed.inject(OpenFilesService);
      const torrentStoreService = TestBed.inject(TorrentStoreService);
      const commandBusService = TestBed.inject(CommandBusService);
      const emitSpy = vi.spyOn(commandBusService, 'emit');

      torrentStoreService.applyMaindata(
        makeMaindata({
          full_update: true,
          torrents: { abc123: { name: 'A' } as any, def456: { name: 'B' } as any },
        }),
      );

      const newDraft = makePendingDraft({ originalPath: '/tmp/c.torrent', infoHashV1: 'NEW789' });
      openFilesService.pendingDrafts.set([
        makePendingDraft({ originalPath: '/tmp/a.torrent', infoHashV1: 'ABC123' }),
        makePendingDraft({ originalPath: '/tmp/b.torrent', infoHashV1: 'DEF456' }),
        newDraft,
      ]);

      fixture.detectChanges();

      expect(emitSpy).toHaveBeenCalledWith({
        type: 'UI_TORRENT_EXISTS',
        hash: 'abc123',
        originalPath: '/tmp/a.torrent',
      });
      expect(emitSpy).toHaveBeenCalledWith({
        type: 'UI_TORRENT_EXISTS',
        hash: 'def456',
        originalPath: '/tmp/b.torrent',
      });
      expect(emitSpy).toHaveBeenCalledWith({ type: 'UI_ADD_TORRENT' });
      expect(openFilesService.pendingDrafts()).toEqual([newDraft]);
    });

    it('should emit UI_ADD_TORRENT directly when the front item is a new torrent', () => {
      const fixture = TestBed.createComponent(App);
      const openFilesService = TestBed.inject(OpenFilesService);
      const torrentStoreService = TestBed.inject(TorrentStoreService);
      const commandBusService = TestBed.inject(CommandBusService);
      const emitSpy = vi.spyOn(commandBusService, 'emit');

      torrentStoreService.applyMaindata(makeMaindata({ full_update: true }));

      openFilesService.pendingDrafts.set([
        makePendingDraft({ originalPath: '/tmp/new.torrent', infoHashV1: 'NEW789' }),
      ]);

      fixture.detectChanges();

      expect(emitSpy).toHaveBeenCalledWith({ type: 'UI_ADD_TORRENT' });
      expect(openFilesService.pendingDrafts().length).toBe(1);
    });

    it('should not emit anything until the torrent store is primed', () => {
      const fixture = TestBed.createComponent(App);
      const openFilesService = TestBed.inject(OpenFilesService);
      const commandBusService = TestBed.inject(CommandBusService);
      const emitSpy = vi.spyOn(commandBusService, 'emit');

      openFilesService.pendingDrafts.set([
        makePendingDraft({ originalPath: '/tmp/new.torrent', infoHashV1: 'NEW789' }),
      ]);

      fixture.detectChanges();

      expect(emitSpy).not.toHaveBeenCalled();
    });
  });
});
