export type PeerFlagColor = 'info' | 'success' | 'warning' | 'danger' | 'primary' | 'secondary';

export interface PeerFlagDefinition {
  flag: string;
  label: string;
  description: string;
  color: PeerFlagColor;
}

const flagKey = (flag: string, field: 'label' | 'description'): string =>
  `components.modals.torrent-details.peers.flags-tooltip.flags.${flag}.${field}`;

export const PEER_FLAG_DEFINITIONS: PeerFlagDefinition[] = [
  {
    flag: 'D',
    label: flagKey('D', 'label'),
    description: flagKey('D', 'description'),
    color: 'info',
  },
  {
    flag: 'U',
    label: flagKey('U', 'label'),
    description: flagKey('U', 'description'),
    color: 'success',
  },
  {
    flag: 'd',
    label: flagKey('d', 'label'),
    description: flagKey('d', 'description'),
    color: 'info',
  },
  {
    flag: 'u',
    label: flagKey('u', 'label'),
    description: flagKey('u', 'description'),
    color: 'success',
  },
  {
    flag: 'O',
    label: flagKey('O', 'label'),
    description: flagKey('O', 'description'),
    color: 'warning',
  },
  {
    flag: 'S',
    label: flagKey('S', 'label'),
    description: flagKey('S', 'description'),
    color: 'danger',
  },
  {
    flag: 'I',
    label: flagKey('I', 'label'),
    description: flagKey('I', 'description'),
    color: 'primary',
  },
  {
    flag: 'E',
    label: flagKey('E', 'label'),
    description: flagKey('E', 'description'),
    color: 'warning',
  },
  {
    flag: 'H',
    label: flagKey('H', 'label'),
    description: flagKey('H', 'description'),
    color: 'secondary',
  },
  {
    flag: 'X',
    label: flagKey('X', 'label'),
    description: flagKey('X', 'description'),
    color: 'secondary',
  },
  {
    flag: 'L',
    label: flagKey('L', 'label'),
    description: flagKey('L', 'description'),
    color: 'secondary',
  },
  {
    flag: 'P',
    label: flagKey('P', 'label'),
    description: flagKey('P', 'description'),
    color: 'secondary',
  },
];
