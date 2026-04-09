import { BbProgressState, BbProgressVariant } from '../components/bb-progress/bb-progress.types';

export function variantForTorrentState(state: BbProgressState): BbProgressVariant {
  switch (state) {
    case 'error':
    case 'missingFiles':
      return 'danger';

    case 'pausedDL':
    case 'pausedUP':
    case 'stoppedDL':
    case 'stoppedUP':
    case 'queuedDL':
    case 'queuedUP':
      return 'secondary';

    case 'stalledDL':
    case 'stalledUP':
      return 'warning';

    case 'uploading':
    case 'forcedUP':
      return 'success';

    case 'downloading':
    case 'forcedDL':
      return 'info';

    case 'checkingDL':
    case 'checkingUP':
    case 'checkingResumeData':
      return 'primary';

    case 'metaDL':
    case 'allocating':
    case 'moving':
      return 'primary';

    default:
      return 'secondary';
  }
}
