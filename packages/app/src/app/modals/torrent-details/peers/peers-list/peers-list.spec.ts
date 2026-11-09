import { TestBed } from '@angular/core/testing';
import { QbTorrentPeer } from '../../../../models/torrent.model';
import { PeersList } from './peers-list';

const peer = (patch: Partial<QbTorrentPeer> = {}): QbTorrentPeer =>
  ({
    ip: '10.0.0.1',
    port: 6881,
    client: 'qBittorrent/5.0',
    dl_speed: 2048,
    up_speed: 0,
    progress: 0.5,
    downloaded: 0,
    uploaded: 0,
    relevance: 1,
    flags: 'D',
    flags_desc: '',
    country: 'Hungary',
    country_code: 'HU',
    connection: 'BT',
    files: '',
    ...patch,
  }) as QbTorrentPeer;

describe('PeersList', () => {
  const create = (peers: QbTorrentPeer[], loading = false) => {
    const fixture = TestBed.createComponent(PeersList);
    fixture.componentRef.setInput('peers', peers);
    fixture.componentRef.setInput('loading', loading);
    fixture.detectChanges();
    return fixture;
  };

  const rows = (fixture: ReturnType<typeof create>): HTMLElement[] =>
    [...fixture.nativeElement.querySelectorAll('[data-testid="peer-row"]')] as HTMLElement[];

  it('renders one row per peer with address, client and progress', () => {
    const fixture = create([peer(), peer({ ip: '10.0.0.2', port: 51413, client: 'Transmission' })]);
    const items = rows(fixture);
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('10.0.0.1:6881');
    expect(items[0].textContent).toContain('qBittorrent/5.0');
    expect(items[0].textContent).toContain('50');
    expect(items[1].textContent).toContain('10.0.0.2:51413');
  });

  it('shows the speeds only when they are not zero', () => {
    const fixture = create([peer({ dl_speed: 2048, up_speed: 0 })]);
    const text = rows(fixture)[0].textContent ?? '';
    expect(text).toContain('2 KB/s');
    expect(text).not.toContain('↑');
  });

  it('wraps IPv6 addresses in brackets', () => {
    const fixture = create([peer({ ip: '2001:db8::1', port: 6881 })]);
    expect(rows(fixture)[0].textContent).toContain('[2001:db8::1]:6881');
  });

  it('shows the loading message while loading with no peers', () => {
    const fixture = create([], true);
    expect(fixture.nativeElement.querySelector('[data-testid="peers-loading"]')).not.toBeNull();
  });

  it('shows the empty message when there are no peers', () => {
    const fixture = create([], false);
    expect(fixture.nativeElement.querySelector('[data-testid="peers-empty"]')).not.toBeNull();
  });
});
