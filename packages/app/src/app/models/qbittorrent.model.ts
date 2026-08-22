export interface QbTorrentProperties {
  save_path: string;
  creation_date: number;
  piece_size: number;
  comment: string;
  total_wasted: number;
  total_uploaded: number;
  total_uploaded_session: number;
  total_downloaded: number;
  total_downloaded_session: number;
  up_limit: number;
  dl_limit: number;
  time_elapsed: number;
  seeding_time: number;
  nb_connections: number;
  nb_connections_limit: number;
  share_ratio: number;
  addition_date: number;
  completion_date: number;
  created_by: string;
  dl_speed_avg: number;
  dl_speed: number;
  eta: number;
  last_seen: number;
  peers: number;
  peers_total: number;
  pieces_have: number;
  pieces_num: number;
  reannounce: number;
  seeds: number;
  seeds_total: number;
  total_size: number;
  up_speed_avg: number;
  up_speed: number;
  isPrivate: boolean;
  infohash_v1: string;
  infohash_v2: string;
}

export enum QbTrackerStatus {
  Disabled = 0,
  NotContacted = 1,
  Working = 2,
  Updating = 3,
  NotWorking = 4,
}

export interface QbTorrentTracker {
  url: string;
  status: QbTrackerStatus;
  tier: number;
  num_peers: number;
  num_seeds: number;
  num_leeches: number;
  num_downloaded: number;
  msg: string;
}

export interface QbResponse<T> {
  ok: boolean;
  status: number;
  statusText: string;
  body: T;
  path?: string;
}

export interface QbAppPreferences {
  add_to_top_of_queue: boolean;
  add_trackers: string;
  add_trackers_enabled: boolean;
  alt_dl_limit: number;
  alt_up_limit: number;
  alternative_webui_enabled: boolean;
  alternative_webui_path: string;
  announce_ip: string;
  announce_to_all_tiers: boolean;
  announce_to_all_trackers: boolean;
  anonymous_mode: boolean;
  async_io_threads: number;
  auto_delete_mode: number;
  auto_tmm_enabled: boolean;
  autorun_enabled: boolean;
  autorun_on_torrent_added_enabled: boolean;
  autorun_on_torrent_added_program: string;
  autorun_program: string;
  banned_IPs: string;
  bdecode_depth_limit: number;
  bdecode_token_limit: number;
  bittorrent_protocol: number;
  block_peers_on_privileged_ports: boolean;
  bypass_auth_subnet_whitelist: string;
  bypass_auth_subnet_whitelist_enabled: boolean;
  bypass_local_auth: boolean;
  category_changed_tmm_enabled: boolean;
  checking_memory_use: number;
  connection_speed: number;
  current_interface_address: string;
  current_interface_name: string;
  current_network_interface: string;
  dht: boolean;
  disk_cache: number;
  disk_cache_ttl: number;
  disk_io_read_mode: number;
  disk_io_type: number;
  disk_io_write_mode: number;
  disk_queue_size: number;
  dl_limit: number;
  dont_count_slow_torrents: boolean;
  dyndns_domain: string;
  dyndns_enabled: boolean;
  dyndns_password: string;
  dyndns_service: number;
  dyndns_username: string;
  embedded_tracker_port: number;
  embedded_tracker_port_forwarding: boolean;
  enable_coalesce_read_write: boolean;
  enable_embedded_tracker: boolean;
  enable_multi_connections_from_same_ip: boolean;
  enable_os_cache?: boolean;
  enable_piece_extent_affinity: boolean;
  enable_super_seeding?: boolean;
  enable_upload_suggestions: boolean;
  encryption: number;
  excluded_file_names: string;
  excluded_file_names_enabled: boolean;
  export_dir: string;
  export_dir_fin: string;
  file_log_age: number;
  file_log_age_type: number;
  file_log_backup_enabled: boolean;
  file_log_delete_old: boolean;
  file_log_enabled: boolean;
  file_log_max_size: number;
  file_log_path: string;
  file_pool_size: number;
  hashing_threads: number;
  i2p_address: string;
  i2p_enabled: boolean;
  i2p_inbound_length: number;
  i2p_inbound_quantity: number;
  i2p_mixed_mode: boolean;
  i2p_outbound_length: number;
  i2p_outbound_quantity: number;
  i2p_port: number;
  idn_support_enabled: boolean;
  incomplete_files_ext: boolean;
  ip_filter_enabled: boolean;
  ip_filter_path: string;
  ip_filter_trackers: boolean;
  limit_lan_peers: boolean;
  limit_tcp_overhead: boolean;
  limit_utp_rate: boolean;
  listen_port: number;
  locale: string;
  lsd: boolean;
  mail_notification_auth_enabled: boolean;
  mail_notification_email: string;
  mail_notification_enabled: boolean;
  mail_notification_password: string;
  mail_notification_sender: string;
  mail_notification_smtp: string;
  mail_notification_smtp_server?: string;
  mail_notification_ssl_enabled: boolean;
  mail_notification_username: string;
  max_active_checking_torrents: number;
  max_active_downloads: number;
  max_active_torrents: number;
  max_active_uploads: number;
  max_concurrent_http_announces: number;
  max_connec: number;
  max_connec_per_torrent: number;
  max_half_open_connec?: number;
  max_inactive_seeding_time?: number;
  max_inactive_seeding_time_enabled?: boolean;
  max_ratio: number;
  max_ratio_act: number;
  max_ratio_enabled: boolean;
  max_seeding_time: number;
  max_seeding_time_enabled: boolean;
  max_uploads: number;
  max_uploads_per_torrent: number;
  memory_working_set_limit: number;
  merge_trackers: boolean;
  outgoing_ports_max: number;
  outgoing_ports_min: number;
  peer_proportional?: boolean;
  peer_tos: number;
  peer_turnover: number;
  peer_turnover_cutoff: number;
  peer_turnover_interval: number;
  performance_warning: boolean;
  pex: boolean;
  preallocate_all: boolean;
  proxy_auth_enabled: boolean;
  proxy_bittorrent: boolean;
  proxy_hostname_lookup: boolean;
  proxy_ip: string;
  proxy_misc: boolean;
  proxy_password: string;
  proxy_peer_connections: boolean;
  proxy_port: number;
  proxy_rss: boolean;
  proxy_torrents_only?: boolean;
  proxy_type: string | number;
  proxy_username: string;
  queueing_enabled: boolean;
  random_port: boolean;
  reannounce_when_address_changed: boolean;
  recheck_completed_torrents: boolean;
  recheck_torrents_on_completion?: boolean;
  refresh_interval: number;
  request_queue_size: number;
  resolve_peer_countries: boolean;
  resume_data_storage_type: string;
  rss_auto_downloading_enabled: boolean;
  rss_download_repack_proper_episodes: boolean;
  rss_download_rules?: string;
  rss_max_articles_per_feed: number;
  rss_processing_enabled: boolean;
  rss_refresh_interval: number;
  rss_smart_episode_filters: string;
  save_path: string;
  save_path_changed_tmm_enabled: boolean;
  save_resume_data_interval: number;
  scan_dirs: Record<string, string>;
  schedule_from_hour: number;
  schedule_from_min: number;
  schedule_to_hour: number;
  schedule_to_min: number;
  scheduler_days: number;
  scheduler_enabled: boolean;
  send_buffer_low_watermark: number;
  send_buffer_watermark: number;
  send_buffer_watermark_factor: number;
  slow_torrent_dl_rate_threshold: number;
  slow_torrent_inactive_timer: number;
  slow_torrent_ul_rate_threshold: number;
  smtp_server?: string;
  socket_backlog_size: number;
  socket_receive_buffer_size: number;
  socket_send_buffer_size: number;
  ssl_cert?: string;
  ssl_key?: string;
  ssrf_mitigation: boolean;
  start_paused_enabled: boolean;
  stop_tracker_timeout: number;
  temp_path: string;
  temp_path_enabled: boolean;
  torrent_changed_tmm_enabled: boolean;
  torrent_content_layout: string;
  torrent_file_size_limit: number;
  torrent_stop_condition: string;
  up_limit: number;
  upload_choking_algorithm: number;
  upload_slots_behavior: number;
  upnp: boolean;
  upnp_lease_duration: number;
  use_category_paths_in_manual_mode: boolean;
  use_https: boolean;
  use_subcategories: boolean;
  utp_tcp_mixed_mode: number;
  validate_https_tracker_certificate: boolean;
  web_ui_address: string;
  web_ui_ban_duration: number;
  web_ui_ban_subnets?: string;
  web_ui_clickjacking_protection_enabled: boolean;
  web_ui_csrf_protection_enabled: boolean;
  web_ui_custom_http_headers: string;
  web_ui_domain_list: string;
  web_ui_host_header_validation_enabled: boolean;
  web_ui_https_cert_path: string;
  web_ui_https_key_path: string;
  web_ui_max_auth_fail_count: number;
  web_ui_port: number;
  web_ui_reverse_proxies_list: string;
  web_ui_reverse_proxy_enabled: boolean;
  web_ui_secure_cookie_enabled: boolean;
  web_ui_session_timeout: number;
  web_ui_upnp: boolean;
  web_ui_use_custom_http_headers_enabled: boolean;
  web_ui_username: string;
}

export type QbSetAppPreferences = Partial<QbAppPreferences>;

export enum QbLogMessageType {
  Normal = 1,
  Info = 2,
  Warning = 4,
  Critical = 8,
}

export interface QbLogEntry {
  id: number;
  message: string;
  timestamp: number;
  type: QbLogMessageType;
}

export interface QbLogPeerEntry {
  id: number;
  ip: string;
  timestamp: number;
  blocked: boolean;
  reason: string;
}
