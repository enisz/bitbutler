export type TorrentState =
  | 'error'
  | 'missingFiles'
  | 'uploading'
  | 'pausedUP'
  | 'stoppedUP'
  | 'queuedUP'
  | 'stalledUP'
  | 'checkingUP'
  | 'forcedUP'
  | 'allocating'
  | 'downloading'
  | 'metaDL'
  | 'pausedDL'
  | 'stoppedDL'
  | 'queuedDL'
  | 'stalledDL'
  | 'checkingDL'
  | 'forcedDL'
  | 'checkingResumeData'
  | 'moving'
  | 'unknown';

export interface Torrent {
  added_on: number;
  amount_left: number;
  auto_tmm: boolean;
  availability: number;
  category: string;
  completed: number;
  completion_on: number;
  content_path: string;
  dl_limit: number;
  dlspeed: number;
  download_path: string;
  downloaded: number;
  downloaded_session: number;
  eta: number;
  f_l_piece_prio: boolean;
  force_start: boolean;
  hash: string;
  inactive_seeding_time_limit: number;
  infohash_v1: string;
  infohash_v2: string;
  last_activity: number;
  magnet_uri: string;
  max_inactive_seeding_time: number;
  max_ratio: number;
  max_seeding_time: number;
  name: string;
  num_complete: number;
  num_incomplete: number;
  num_leechs: number;
  num_seeds: number;
  priority: number;
  progress: number;
  ratio: number;
  ratio_limit: number;
  save_path: string;
  seeding_time: number;
  seeding_time_limit: number;
  seen_complete: number;
  seq_dl: boolean;
  size: number;
  state: TorrentState;
  super_seeding: boolean;
  tags: string;
  time_active: number;
  total_size: number;
  tracker: string;
  trackers_count: number;
  up_limit: number;
  uploaded: number;
  uploaded_session: number;
  upspeed: number;
}

export type TorrentDelta = Partial<Torrent> & { hash: string };
export type TorrentMap = Map<string, Torrent>;

export interface QbCategory {
  name: string;
  savePath: string;
}

export interface QbServerState {
  alltime_dl: number;
  alltime_ul: number;
  dl_info_data: number;
  dl_info_speed: number;
  dl_rate_limit: number;
  up_info_data: number;
  up_info_speed: number;
  up_rate_limit: number;
  free_space_on_disk?: number;
  total_peer_connections?: number;
  connection_status?: string;
  global_ratio?: string;
  read_cache_hits?: string;
  read_cache_overload?: string;
  write_cache_overload?: string;
  queueing?: boolean;
  use_alt_speed_limits?: boolean;
  refresh_interval?: number;
  [key: string]: number | string | boolean | null | undefined;
}

export interface Maindata {
  rid: number;
  full_update: boolean;
  torrents?: Record<string, TorrentDelta>;
  torrents_removed?: string[];
  categories?: Record<string, QbCategory>;
  categories_removed?: string[];
  tags?: string[];
  tags_removed?: string[];
  server_state: QbServerState;
}

export type QbPeerId = string;

export interface QbTorrentPeer {
  ip: string;
  port: number;
  client: string;

  dl_speed: number;
  up_speed: number;

  progress: number;
  downloaded: number;
  uploaded: number;
  relevance: number;

  flags: string;
  flags_desc: string;

  country?: string;
  country_code?: string;
  connection: string;
  files: string;
}

export interface QbTorrentPeersResponse {
  rid: number;
  full_update: boolean;
  peers?: Record<QbPeerId, QbTorrentPeer>;
  peers_removed?: QbPeerId[];
}

export interface QbTorrentContent {
  index: number;
  name: string;
  size: number;
  progress: number;
  priority: QbTorrentContentPriority;
  is_seed: boolean;
  piece_range: number[];
  availability: number;
}

export enum QbTorrentContentPriority {
  DO_NOT_DOWNLOAD = 0,
  NORMAL_PRIORTY = 1,
  HIGH_PRIORITY = 6,
  MAXIMAL_PRIORITY = 7,
}
