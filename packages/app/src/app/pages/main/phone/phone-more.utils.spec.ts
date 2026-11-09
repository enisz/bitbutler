import { ContextMenuEntry } from '../grid/context-menu/context-menu.types';
import { buildPhoneMoreEntries } from './phone-more.utils';

const item = (id: string): ContextMenuEntry => ({ kind: 'item', id, label: id });
const sub = (id: string, children: ContextMenuEntry[]): ContextMenuEntry => ({
  kind: 'submenu',
  id,
  label: id,
  children,
});
const divider: ContextMenuEntry = { kind: 'divider' };

const ids = (entries: ContextMenuEntry[]): string[] =>
  entries.map((e) => ('id' in e ? e.id : e.kind));

const desktopLikeMenu = (): ContextMenuEntry[] => [
  item('control.start'),
  item('control.stop'),
  item('control.forceResume'),
  divider,
  item('torrent.details'),
  divider,
  sub('files', [
    item('files.openDestination'),
    item('files.setSavePath'),
    item('files.exportFile'),
  ]),
  sub('manage', [item('manage.category'), item('manage.tags')]),
  sub('queue', [item('queue.moveTop')]),
  sub('transfer', [item('speed.limitTransferRate')]),
  sub('maintenance', [item('maintenance.forceRecheck')]),
  sub('copy', [item('torrent.copyCellValue'), item('torrent.copyName')]),
  sub('row.pin', [item('row.pinToTop')]),
  divider,
  item('files.remove'),
];

describe('buildPhoneMoreEntries', () => {
  it('puts the set save path entry first', () => {
    const result = buildPhoneMoreEntries(desktopLikeMenu());
    expect(ids(result)[0]).toBe('files.setSavePath');
  });

  it('removes entries that the action bar or the phone UI already covers', () => {
    const result = ids(buildPhoneMoreEntries(desktopLikeMenu()));
    for (const removed of [
      'control.start',
      'control.stop',
      'torrent.details',
      'files.remove',
      'row.pin',
    ]) {
      expect(result).not.toContain(removed);
    }
  });

  it('removes grid-only copy cell value but keeps the other copy entries', () => {
    const result = buildPhoneMoreEntries(desktopLikeMenu());
    const copy = result.find((e) => 'id' in e && e.id === 'copy');
    expect(copy && 'children' in copy ? ids(copy.children) : []).toEqual(['torrent.copyName']);
  });

  it('keeps the remaining groups and force resume', () => {
    const result = ids(buildPhoneMoreEntries(desktopLikeMenu()));
    for (const kept of [
      'control.forceResume',
      'manage',
      'queue',
      'transfer',
      'maintenance',
      'files',
    ]) {
      expect(result).toContain(kept);
    }
  });

  it('does not duplicate the set save path entry inside the files group', () => {
    const result = buildPhoneMoreEntries(desktopLikeMenu());
    const files = result.find((e) => 'id' in e && e.id === 'files');
    expect(files && 'children' in files ? ids(files.children) : []).not.toContain(
      'files.setSavePath',
    );
  });

  it('drops entries whose id starts with all.', () => {
    const result = ids(buildPhoneMoreEntries([item('all.show'), item('manage.tags')]));
    expect(result).toEqual(['manage.tags']);
  });

  it('collapses leading, trailing and doubled dividers', () => {
    const result = buildPhoneMoreEntries([
      divider,
      item('control.start'),
      divider,
      divider,
      item('manage.tags'),
      divider,
    ]);
    expect(ids(result)).toEqual(['manage.tags']);
  });

  it('works when there is no set save path entry', () => {
    expect(ids(buildPhoneMoreEntries([item('manage.tags')]))).toEqual(['manage.tags']);
  });
});
