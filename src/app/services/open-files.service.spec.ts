import { TestBed } from '@angular/core/testing';
import { OpenFilesService, PendingAddTorrent } from './open-files.service';

const makeDraft = (path: string, hash = ''): any => ({
  originalPath: path,
  originalName: null,
  torrent: { infoHashV1: hash, infoHashV2: '' },
});

describe('OpenFilesService', () => {
  let service: OpenFilesService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [OpenFilesService] });
    service = TestBed.inject(OpenFilesService);
  });

  it('should start with empty pending', () => {
    expect(service.pending()).toEqual([]);
  });

  it('should start with empty pendingDrafts', () => {
    expect(service.pendingDrafts()).toEqual([]);
  });

  it('should drain drafts and clear the signal', () => {
    const draft: PendingAddTorrent = {
      draft: makeDraft('/a/b.torrent'),
      selected: { name: 'b.torrent', path: '/a/b.torrent' },
    };
    service.pendingDrafts.set([draft]);

    const drained = service.drainDrafts();
    expect(drained).toHaveLength(1);
    expect(service.pendingDrafts()).toHaveLength(0);
  });

  it('should consume the first draft from pendingDrafts', () => {
    const d1: PendingAddTorrent = {
      draft: makeDraft('/a/1.torrent'),
      selected: { name: '1.torrent', path: '/a/1.torrent' },
    };
    const d2: PendingAddTorrent = {
      draft: makeDraft('/a/2.torrent'),
      selected: { name: '2.torrent', path: '/a/2.torrent' },
    };
    service.pendingDrafts.set([d1, d2]);

    service.consumeCurrentDraft();
    expect(service.pendingDrafts()).toHaveLength(1);
    expect(service.pendingDrafts()[0].selected.name).toBe('2.torrent');
  });

  it('should not throw when consuming from empty pendingDrafts', () => {
    expect(() => service.consumeCurrentDraft()).not.toThrow();
  });

  it('should start listening to window events on start()', () => {
    const spy = vi.spyOn(window.bitbutler.window, 'onOpenFiles').mockReturnValue(() => {});
    vi.spyOn(window.bitbutler.window, 'onTorrentDrafts').mockReturnValue(() => {});
    service.start();
    expect(spy).toHaveBeenCalled();
  });

  it('should not register listeners twice when start() called twice', () => {
    const spy = vi.spyOn(window.bitbutler.window, 'onOpenFiles').mockReturnValue(() => {});
    vi.spyOn(window.bitbutler.window, 'onTorrentDrafts').mockReturnValue(() => {});
    service.start();
    service.start();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should stop listeners on stop()', () => {
    const unsub = vi.fn();
    vi.spyOn(window.bitbutler.window, 'onOpenFiles').mockReturnValue(unsub);
    vi.spyOn(window.bitbutler.window, 'onTorrentDrafts').mockReturnValue(() => {});
    service.start();
    service.stop();
    expect(unsub).toHaveBeenCalled();
  });
});
