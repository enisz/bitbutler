export type PeerFlagColor = 'info' | 'success' | 'warning' | 'danger' | 'primary' | 'secondary';

export interface PeerFlagDefinition {
  flag: string;
  label: string;
  description: string;
  color: PeerFlagColor;
}

export const PEER_FLAG_DEFINITIONS: PeerFlagDefinition[] = [
  {
    flag: 'D',
    label: 'Downloading',
    description: 'You are currently receiving data from this peer.',
    color: 'info',
  },
  {
    flag: 'U',
    label: 'Uploading',
    description: 'You are currently sending data to this peer.',
    color: 'success',
  },
  {
    flag: 'd',
    label: 'Interested (Down)',
    description: 'You want to download from them, but they are choking you (refusing to send).',
    color: 'info',
  },
  {
    flag: 'u',
    label: 'Interested (Up)',
    description: 'They want to download from you, but you are choking them.',
    color: 'success',
  },
  {
    flag: 'O',
    label: 'Optimistic Unchoke',
    description: 'You are testing this peer to see if they give you good speeds.',
    color: 'warning',
  },
  {
    flag: 'S',
    label: 'Snubbed',
    description: "The peer hasn't sent you data for a while, so you've stopped sending to them.",
    color: 'danger',
  },
  {
    flag: 'I',
    label: 'Incoming',
    description: 'The peer connected to you (useful for checking if your ports are open).',
    color: 'primary',
  },
  {
    flag: 'E',
    label: 'Encrypted',
    description: 'The connection is using protocol encryption.',
    color: 'warning',
  },
  {
    flag: 'H',
    label: 'DHT',
    description: 'Found via Distributed Hash Table (no tracker needed).',
    color: 'secondary',
  },
  {
    flag: 'X',
    label: 'PEX',
    description: 'Found via Peer Exchange (other peers told you about them).',
    color: 'secondary',
  },
  {
    flag: 'L',
    label: 'Local',
    description: 'Found via Local Peer Discovery (same Wi-Fi/LAN).',
    color: 'secondary',
  },
  {
    flag: 'P',
    label: 'uTP',
    description: 'The connection is using the Micro Transport Protocol (UDP-based).',
    color: 'secondary',
  },
];
