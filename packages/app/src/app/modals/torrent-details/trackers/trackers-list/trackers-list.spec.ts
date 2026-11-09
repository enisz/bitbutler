import { TestBed } from '@angular/core/testing';
import { QbTorrentTracker } from '../../../../models/qbittorrent.model';
import { TrackersList } from './trackers-list';

const tracker = (patch: Partial<QbTorrentTracker> = {}): QbTorrentTracker =>
  ({
    url: 'udp://tracker.example.org:6969/announce',
    status: 2,
    tier: 0,
    num_peers: 10,
    num_seeds: 5,
    num_leeches: 3,
    num_downloaded: 100,
    msg: '',
    ...patch,
  }) as QbTorrentTracker;

describe('TrackersList', () => {
  const create = (trackers: QbTorrentTracker[], loading = false) => {
    const fixture = TestBed.createComponent(TrackersList);
    fixture.componentRef.setInput('trackers', trackers);
    fixture.componentRef.setInput('loading', loading);
    fixture.detectChanges();
    return fixture;
  };

  const rows = (fixture: ReturnType<typeof create>): HTMLElement[] =>
    [...fixture.nativeElement.querySelectorAll('[data-testid="tracker-row"]')] as HTMLElement[];

  it('renders one row per tracker with the url and counts', () => {
    const fixture = create([tracker(), tracker({ url: 'https://other.example/announce' })]);
    const items = rows(fixture);
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('udp://tracker.example.org:6969/announce');
    expect(items[0].textContent).toContain('5');
    expect(items[0].textContent).toContain('3');
    expect(items[1].textContent).toContain('https://other.example/announce');
  });

  it('shows the status label key for a working tracker', () => {
    const fixture = create([tracker({ status: 2 })]);
    expect(rows(fixture)[0].textContent).toContain(
      'components.modals.torrent-details.trackers.status.working',
    );
  });

  it('shows the tracker message when there is one', () => {
    const fixture = create([tracker({ msg: 'unregistered torrent' })]);
    expect(rows(fixture)[0].textContent).toContain('unregistered torrent');
  });

  it('shows the loading message while loading with no trackers', () => {
    const fixture = create([], true);
    expect(fixture.nativeElement.querySelector('[data-testid="trackers-loading"]')).not.toBeNull();
  });

  it('shows the empty message when there are no trackers', () => {
    const fixture = create([], false);
    expect(fixture.nativeElement.querySelector('[data-testid="trackers-empty"]')).not.toBeNull();
  });
});
