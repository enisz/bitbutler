// Trims every hash, drops blanks and joins the rest with the `|` separator qBittorrent expects.
export function cleanHashes(hashes: string[]): string {
  return hashes
    .map((h) => (h ?? '').trim())
    .filter(Boolean)
    .join('|');
}
