import { Torrent } from '../../models/torrent.model';

export type TorrentField = keyof Torrent;

export type TorrentFieldType =
  | 'string'
  | 'integer'
  | 'decimal'
  | 'percent'
  | 'boolean'
  | 'bytes'
  | 'bytesPerSec'
  | 'duration'
  | 'timestamp'
  | 'state';

export interface TorrentFieldMeta {
  field: TorrentField;
  labelKey: string;
  type: TorrentFieldType;
  /** Only meaningful for the 'decimal' type. Defaults to 2 when unset. */
  precision?: number;
}

function meta(field: TorrentField, type: TorrentFieldType, precision?: number): TorrentFieldMeta {
  return { field, labelKey: `pages.main.grid.grid-lib.col-def.${field}`, type, precision };
}

export const TORRENT_FIELD_CATALOG: TorrentFieldMeta[] = [
  meta('added_on', 'timestamp'),
  meta('amount_left', 'bytes'),
  meta('auto_tmm', 'boolean'),
  meta('availability', 'decimal', 3),
  meta('category', 'string'),
  meta('completed', 'bytes'),
  meta('completion_on', 'timestamp'),
  meta('content_path', 'string'),
  meta('dl_limit', 'bytesPerSec'),
  meta('dlspeed', 'bytesPerSec'),
  meta('download_path', 'string'),
  meta('downloaded', 'bytes'),
  meta('downloaded_session', 'bytes'),
  meta('eta', 'duration'),
  meta('f_l_piece_prio', 'boolean'),
  meta('force_start', 'boolean'),
  meta('hash', 'string'),
  meta('inactive_seeding_time_limit', 'duration'),
  meta('infohash_v1', 'string'),
  meta('infohash_v2', 'string'),
  meta('last_activity', 'timestamp'),
  meta('magnet_uri', 'string'),
  meta('max_inactive_seeding_time', 'duration'),
  meta('max_ratio', 'decimal'),
  meta('max_seeding_time', 'duration'),
  meta('name', 'string'),
  meta('num_complete', 'integer'),
  meta('num_incomplete', 'integer'),
  meta('num_leechs', 'integer'),
  meta('num_seeds', 'integer'),
  meta('priority', 'integer'),
  meta('progress', 'percent'),
  meta('ratio', 'decimal'),
  meta('ratio_limit', 'decimal'),
  meta('save_path', 'string'),
  meta('seeding_time', 'duration'),
  meta('seeding_time_limit', 'duration'),
  meta('seen_complete', 'timestamp'),
  meta('seq_dl', 'boolean'),
  meta('size', 'bytes'),
  meta('state', 'state'),
  meta('super_seeding', 'boolean'),
  meta('tags', 'string'),
  meta('time_active', 'duration'),
  meta('total_size', 'bytes'),
  meta('tracker', 'string'),
  meta('trackers_count', 'integer'),
  meta('up_limit', 'bytesPerSec'),
  meta('uploaded', 'bytes'),
  meta('uploaded_session', 'bytes'),
  meta('upspeed', 'bytesPerSec'),
];

export const TORRENT_FIELD_TYPES: Record<TorrentField, TorrentFieldType> = Object.fromEntries(
  TORRENT_FIELD_CATALOG.map((m) => [m.field, m.type]),
) as Record<TorrentField, TorrentFieldType>;

export const TORRENT_FIELD_META_BY_FIELD: Record<TorrentField, TorrentFieldMeta> =
  Object.fromEntries(TORRENT_FIELD_CATALOG.map((m) => [m.field, m])) as Record<
    TorrentField,
    TorrentFieldMeta
  >;
