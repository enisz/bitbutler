const TORRENT_STATE_TOOLTIP: Record<string, string> = {
  error: 'An error occurred. Applies to paused torrents.',
  missingFiles: 'Torrent data files are missing.',
  uploading: 'Torrent is seeding and data is being uploaded.',
  pausedUP: 'Torrent is paused and has finished downloading.',
  queuedUP: 'Queuing is enabled and torrent is queued for upload.',
  stalledUP: 'Torrent is seeding, but no connections were made.',
  checkingUP: 'Torrent has finished downloading and is being checked.',
  forcedUP: 'Torrent is forced to upload and ignores queue limits.',
  allocating: 'Torrent is allocating disk space for download.',
  downloading: 'Torrent is downloading and data is being transferred.',
  metaDL: 'Torrent has started and is fetching metadata.',
  pausedDL: 'Torrent is paused and has not finished downloading.',
  queuedDL: 'Queuing is enabled and torrent is queued for download.',
  stalledDL: 'Torrent is downloading, but no connections were made.',
  checkingDL: 'Torrent is being checked and has not finished downloading.',
  forcedDL: 'Torrent is forced to download and ignores queue limits.',
  checkingResumeData: 'Checking resume data on qBittorrent startup.',
  moving: 'Torrent is being moved to another location.',
  unknown: 'Unknown torrent status.',
};

export function torrentStateText(key: string): string {
  return TORRENT_STATE_TOOLTIP[key] ?? TORRENT_STATE_TOOLTIP['unknown'];
}
