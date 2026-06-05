import type {
  BbeMetadata,
  BbeTorrentEntry,
  BbeTorrentFile,
  ExportDoneEvent,
  ExportProgressEvent,
  ExportStartPayload,
  ImportStartPayload,
} from '@bitbutler/shared';
import AdmZip from 'adm-zip';
import archiver from 'archiver';
import { dialog, ipcMain } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import semver from 'semver';
import { qbRequest } from './qbittorrent.js';

const INACTIVE_STATES = new Set(['pausedDL', 'pausedUP', 'stoppedDL', 'stoppedUP']);

export function isActiveState(state: string | undefined): boolean {
  if (!state) return false;
  return !INACTIVE_STATES.has(state);
}

export function applyPathMappings(
  savePath: string,
  mappings: Array<{ from: string; to: string }>,
): string {
  for (const { from, to } of mappings) {
    if (!from) continue;
    if (savePath.startsWith(from)) {
      return to + savePath.slice(from.length);
    }
  }
  return savePath;
}
