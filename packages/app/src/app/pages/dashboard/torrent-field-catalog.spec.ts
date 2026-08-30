import { Torrent } from '../../models/torrent.model';
import { TORRENT_FIELD_CATALOG, TORRENT_FIELD_TYPES } from './torrent-field-catalog';

const sampleTorrent: Torrent = {
  added_on: 0,
  amount_left: 0,
  auto_tmm: false,
  availability: 0,
  category: '',
  completed: 0,
  completion_on: 0,
  content_path: '',
  dl_limit: 0,
  dlspeed: 0,
  download_path: '',
  downloaded: 0,
  downloaded_session: 0,
  eta: 0,
  f_l_piece_prio: false,
  force_start: false,
  hash: '',
  inactive_seeding_time_limit: 0,
  infohash_v1: '',
  infohash_v2: '',
  last_activity: 0,
  magnet_uri: '',
  max_inactive_seeding_time: 0,
  max_ratio: 0,
  max_seeding_time: 0,
  name: '',
  num_complete: 0,
  num_incomplete: 0,
  num_leechs: 0,
  num_seeds: 0,
  priority: 0,
  progress: 0,
  ratio: 0,
  ratio_limit: 0,
  save_path: '',
  seeding_time: 0,
  seeding_time_limit: 0,
  seen_complete: 0,
  seq_dl: false,
  size: 0,
  state: 'downloading',
  super_seeding: false,
  tags: '',
  time_active: 0,
  total_size: 0,
  tracker: '',
  trackers_count: 0,
  up_limit: 0,
  uploaded: 0,
  uploaded_session: 0,
  upspeed: 0,
};

describe('TORRENT_FIELD_CATALOG', () => {
  it('should have exactly one entry per Torrent property, with no duplicates', () => {
    const expectedFields = Object.keys(sampleTorrent).sort();
    const catalogFields = TORRENT_FIELD_CATALOG.map((m) => m.field).sort();
    expect(catalogFields).toEqual(expectedFields);
    expect(new Set(catalogFields).size).toBe(catalogFields.length);
  });

  it('should give every entry a labelKey following the pages.main.grid.grid-lib.col-def.<field> pattern', () => {
    for (const meta of TORRENT_FIELD_CATALOG) {
      expect(meta.labelKey).toBe(`pages.main.grid.grid-lib.col-def.${meta.field}`);
    }
  });

  it('should classify representative fields with the expected format type', () => {
    expect(TORRENT_FIELD_TYPES.size).toBe('bytes');
    expect(TORRENT_FIELD_TYPES.name).toBe('string');
    expect(TORRENT_FIELD_TYPES.auto_tmm).toBe('boolean');
    expect(TORRENT_FIELD_TYPES.added_on).toBe('timestamp');
    expect(TORRENT_FIELD_TYPES.progress).toBe('percent');
    expect(TORRENT_FIELD_TYPES.ratio).toBe('decimal');
    expect(TORRENT_FIELD_TYPES.dlspeed).toBe('bytesPerSec');
    expect(TORRENT_FIELD_TYPES.num_complete).toBe('integer');
    expect(TORRENT_FIELD_TYPES.eta).toBe('duration');
    expect(TORRENT_FIELD_TYPES.state).toBe('state');
  });
});
