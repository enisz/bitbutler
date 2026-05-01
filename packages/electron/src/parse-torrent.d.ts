declare module 'parse-torrent' {
  interface TorrentFile {
    path: string;
    length: number;
    offset?: number;
  }

  interface ParsedTorrent {
    name?: string;
    infoHash?: string;
    infoHashV2?: string;
    length?: number;
    announce?: string | string[];
    announceList?: string[][];
    files?: TorrentFile[];
    private?: boolean;
  }

  function parseTorrent(buf: Buffer | Uint8Array): Promise<ParsedTorrent> | ParsedTorrent;
  export = parseTorrent;
}
