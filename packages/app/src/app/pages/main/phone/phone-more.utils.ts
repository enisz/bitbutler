import { ContextMenuEntry } from '../grid/context-menu/context-menu.types';

const SET_SAVE_PATH_ID = 'files.setSavePath';

// Covered by the phone action bar / details screen, or only meaningful inside the desktop grid.
const REMOVED_IDS = new Set([
  'control.start',
  'control.stop',
  'torrent.details',
  'files.remove',
  'torrent.copyCellValue',
  'row.pin',
]);

function idOf(entry: ContextMenuEntry): string | null {
  return 'id' in entry ? entry.id : null;
}

function isRemoved(entry: ContextMenuEntry): boolean {
  const id = idOf(entry);
  return id !== null && (REMOVED_IDS.has(id) || id.startsWith('all.'));
}

function tidyDividers(entries: ContextMenuEntry[]): ContextMenuEntry[] {
  const out: ContextMenuEntry[] = [];
  for (const entry of entries) {
    if (entry.kind === 'divider') {
      if (out.length === 0 || out[out.length - 1].kind === 'divider') continue;
    }
    out.push(entry);
  }
  while (out.length > 0 && out[out.length - 1].kind === 'divider') out.pop();
  return out;
}

/** Pulls the set save path entry out of the (possibly nested) list. */
function extractSavePath(entries: ContextMenuEntry[]): {
  rest: ContextMenuEntry[];
  savePath: ContextMenuEntry | null;
} {
  let savePath: ContextMenuEntry | null = null;
  const rest: ContextMenuEntry[] = [];
  for (const entry of entries) {
    if (idOf(entry) === SET_SAVE_PATH_ID) {
      savePath = entry;
    } else if (entry.kind === 'submenu') {
      const inner = extractSavePath(entry.children);
      if (inner.savePath) savePath = inner.savePath;
      rest.push({ ...entry, children: inner.rest });
    } else {
      rest.push(entry);
    }
  }
  return { rest, savePath };
}

function clean(entries: ContextMenuEntry[]): ContextMenuEntry[] {
  const kept = entries
    .filter((entry) => !isRemoved(entry))
    .map((entry) =>
      entry.kind === 'submenu' ? { ...entry, children: clean(entry.children) } : entry,
    );
  return tidyDividers(kept);
}

/**
 * Turns the desktop context menu into the phone "More" list: drops entries the action bar
 * already covers or that only make sense in the grid, and puts Set Save Path first.
 */
export function buildPhoneMoreEntries(entries: ContextMenuEntry[]): ContextMenuEntry[] {
  const { rest, savePath } = extractSavePath(clean(entries));
  const nonEmpty = rest.filter((entry) => entry.kind !== 'submenu' || entry.children.length > 0);
  return savePath ? [savePath, ...tidyDividers(nonEmpty)] : tidyDividers(nonEmpty);
}
