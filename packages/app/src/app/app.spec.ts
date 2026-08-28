import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
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
        provideRouter([
          { path: 'pages/torrent-list', component: App },
          { path: 'login', component: App },
        ]),
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

    it('should not re-check a routed draft when the store catches up while it is still queued (mid-add poll race)', () => {
      const fixture = TestBed.createComponent(App);
      const openFilesService = TestBed.inject(OpenFilesService);
      const torrentStoreService = TestBed.inject(TorrentStoreService);
      const commandBusService = TestBed.inject(CommandBusService);
      const emitSpy = vi.spyOn(commandBusService, 'emit');

      torrentStoreService.applyMaindata(makeMaindata({ full_update: true }));

      const draft = makePendingDraft({ originalPath: '/tmp/new.torrent', infoHashV1: 'NEW789' });
      openFilesService.pendingDrafts.set([draft]);

      fixture.detectChanges();

      expect(emitSpy).toHaveBeenCalledWith({ type: 'UI_ADD_TORRENT' });
      expect(openFilesService.pendingDrafts()).toEqual([draft]);

      emitSpy.mockClear();

      // Simulate a background maindata poll landing while AddTorrent is still finishing up for
      // this same draft (e.g. post-add renaming/priority calls) and now reporting the torrent
      // this draft itself just added as present in the store.
      torrentStoreService.applyMaindata(
        makeMaindata({ full_update: true, torrents: { new789: { name: 'New' } as any } }),
      );

      fixture.detectChanges();

      expect(emitSpy).not.toHaveBeenCalled();
      expect(openFilesService.pendingDrafts()).toEqual([draft]);
    });

    it('should re-check a torrent if it is queued again after its earlier draft left the queue', () => {
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

      // The draft leaves the queue (e.g. consumed after a successful add) and later the same
      // torrent is queued again - this time it should be re-checked against the store.
      openFilesService.pendingDrafts.set([]);
      fixture.detectChanges();

      torrentStoreService.applyMaindata(
        makeMaindata({ full_update: true, torrents: { new789: { name: 'New' } as any } }),
      );

      emitSpy.mockClear();
      const secondDraft = makePendingDraft({
        originalPath: '/tmp/new-again.torrent',
        infoHashV1: 'NEW789',
      });
      openFilesService.pendingDrafts.set([secondDraft]);
      fixture.detectChanges();

      expect(emitSpy).toHaveBeenCalledWith({
        type: 'UI_TORRENT_EXISTS',
        hash: 'new789',
        originalPath: '/tmp/new-again.torrent',
      });
      expect(openFilesService.pendingDrafts()).toEqual([]);
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

  describe('active view reporting', () => {
    it('notifies the main process of the active view when navigation reaches a /pages/* route', async () => {
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      const router = TestBed.inject(Router);
      const setActiveSpy = vi.spyOn(window.bitbutler.view, 'setActive');

      await router.navigateByUrl('/pages/torrent-list');

      expect(setActiveSpy).toHaveBeenCalledWith('torrent-list');
    });

    it('does not notify the main process for a non-/pages/ route', async () => {
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      const router = TestBed.inject(Router);
      const setActiveSpy = vi.spyOn(window.bitbutler.view, 'setActive');

      await router.navigateByUrl('/login');

      expect(setActiveSpy).not.toHaveBeenCalled();
    });

    it('strips a query string from the reported view id', async () => {
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      const router = TestBed.inject(Router);
      const setActiveSpy = vi.spyOn(window.bitbutler.view, 'setActive');

      await router.navigateByUrl('/pages/torrent-list?tab=general');

      expect(setActiveSpy).toHaveBeenCalledWith('torrent-list');
    });
  });
});
