import { BreakdownField } from '../../models/dashboard.model';
import { TorrentState } from '../../models/torrent.model';

export interface BreakdownBucket {
  key: string;
  labelKey: string;
  /** First bucket in the array whose test passes wins - order matters. */
  test: (value: number) => boolean;
}

export interface BreakdownFieldMeta {
  field: BreakdownField;
  labelKey: string;
  kind: 'categorical' | 'numeric';
  /** Only true for 'tags' - a comma-separated field where one torrent can land in multiple slices. */
  multiValued?: boolean;
  /** Only set for kind: 'numeric'. */
  buckets?: BreakdownBucket[];
}

function fieldLabelKey(field: BreakdownField): string {
  return `pages.main.grid.grid-lib.col-def.${field}`;
}

function categoricalMeta(field: BreakdownField, multiValued = false): BreakdownFieldMeta {
  return { field, labelKey: fieldLabelKey(field), kind: 'categorical', multiValued };
}

function bucket(
  field: BreakdownField,
  key: string,
  test: (value: number) => boolean,
): BreakdownBucket {
  return { key, labelKey: `pages.dashboard.widgets.breakdown.${field}.bucket.${key}`, test };
}

function numericMeta(field: BreakdownField, buckets: BreakdownBucket[]): BreakdownFieldMeta {
  return { field, labelKey: fieldLabelKey(field), kind: 'numeric', buckets };
}

const GIB = 1024 ** 3;

const RATIO_BUCKETS: BreakdownBucket[] = [
  bucket('ratio', 'lt-0-1', (v) => v < 0.1),
  bucket('ratio', '0-1-to-0-5', (v) => v < 0.5),
  bucket('ratio', '0-5-to-1', (v) => v < 1),
  bucket('ratio', '1-to-2', (v) => v < 2),
  bucket('ratio', 'gte-2', () => true),
];

const PROGRESS_BUCKETS: BreakdownBucket[] = [
  bucket('progress', '0-25', (v) => v < 0.25),
  bucket('progress', '25-50', (v) => v < 0.5),
  bucket('progress', '50-75', (v) => v < 0.75),
  bucket('progress', '75-99', (v) => v < 1),
  bucket('progress', '100', () => true),
];

const SIZE_BUCKETS: BreakdownBucket[] = [
  bucket('size', 'lt-1gib', (v) => v < GIB),
  bucket('size', '1-5gib', (v) => v < 5 * GIB),
  bucket('size', '5-20gib', (v) => v < 20 * GIB),
  bucket('size', '20-100gib', (v) => v < 100 * GIB),
  bucket('size', 'gte-100gib', () => true),
];

const ETA_BUCKETS: BreakdownBucket[] = [
  // qBittorrent returns 8640000 (100 days) as a sentinel meaning "no estimate" (stalled/no
  // peers), not a real duration - this must be checked first, or every unknown-ETA torrent
  // would be miscounted as ">=7d".
  bucket('eta', 'unknown', (v) => v >= 8_640_000),
  bucket('eta', 'lt-1h', (v) => v < 3600),
  bucket('eta', '1h-6h', (v) => v < 21_600),
  bucket('eta', '6h-24h', (v) => v < 86_400),
  bucket('eta', '1d-7d', (v) => v < 604_800),
  bucket('eta', 'gte-7d', () => true),
];

export const BREAKDOWN_FIELD_CATALOG: BreakdownFieldMeta[] = [
  categoricalMeta('state'),
  categoricalMeta('category'),
  categoricalMeta('tracker'),
  categoricalMeta('save_path'),
  categoricalMeta('tags', true),
  numericMeta('ratio', RATIO_BUCKETS),
  numericMeta('progress', PROGRESS_BUCKETS),
  numericMeta('size', SIZE_BUCKETS),
  numericMeta('eta', ETA_BUCKETS),
];

export const BREAKDOWN_FIELD_META_BY_FIELD: Record<BreakdownField, BreakdownFieldMeta> =
  Object.fromEntries(BREAKDOWN_FIELD_CATALOG.map((m) => [m.field, m])) as Record<
    BreakdownField,
    BreakdownFieldMeta
  >;

// Moved from widget-selectors.ts (unchanged) - every TorrentState maps to exactly one bucket,
// unlike ACTIVE_STATES/the sidebar's `groups` map in status.ts, whose groups deliberately overlap
// for independent filter checkboxes. A breakdown's slices must sum to the full torrent count.
export type PieStateBucket =
  | 'downloading'
  | 'completed'
  | 'inactive'
  | 'stopped'
  | 'checking'
  | 'errored'
  | 'other';

export const PIE_STATE_BUCKETS: Record<TorrentState, PieStateBucket> = {
  downloading: 'downloading',
  forcedDL: 'downloading',
  metaDL: 'downloading',
  allocating: 'downloading',
  uploading: 'completed',
  forcedUP: 'completed',
  queuedDL: 'inactive',
  queuedUP: 'inactive',
  stalledDL: 'inactive',
  stalledUP: 'inactive',
  pausedDL: 'stopped',
  stoppedDL: 'stopped',
  pausedUP: 'stopped',
  stoppedUP: 'stopped',
  checkingDL: 'checking',
  checkingUP: 'checking',
  checkingResumeData: 'checking',
  moving: 'checking',
  error: 'errored',
  missingFiles: 'errored',
  unknown: 'other',
};

export const PIE_STATE_BUCKET_ORDER: PieStateBucket[] = [
  'downloading',
  'completed',
  'inactive',
  'stopped',
  'checking',
  'errored',
  'other',
];
