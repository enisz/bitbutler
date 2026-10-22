import type { BbcImportPayload, BbcImportResult, BbcMetadata } from '@bitbutler/shared';
import { dialog, ipcMain } from 'electron';
import fs from 'node:fs';
import { applyConfiguration } from '../configuration-apply.js';
import { buildConfiguration, describeConfiguration, parseConfiguration } from '../configuration.js';

const BBC_FILTER = { name: 'BitButler Configuration', extensions: ['bbc'] };

export function registerConfigurationIpcHandlers(): void {
  ipcMain.handle('config:export', async () => exportToFile());
  ipcMain.handle('config:open-picker', async () => openPicker());
  ipcMain.handle('config:read', async (_event, payload: unknown) => readConfiguration(payload));
  ipcMain.handle('config:import', async (_event, payload: unknown) => importConfiguration(payload));
}

async function exportToFile(): Promise<{ canceled: boolean; path?: string }> {
  const date = new Date().toISOString().slice(0, 10);
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: `bitbutler-${date}.bbc`,
    filters: [BBC_FILTER],
  });
  if (canceled || !filePath) return { canceled: true };

  await fs.promises.writeFile(filePath, JSON.stringify(buildConfiguration(), null, 2));
  return { canceled: false, path: filePath };
}

async function openPicker(): Promise<string | undefined> {
  const { filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [BBC_FILTER],
  });
  return filePaths[0];
}

function requirePath(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error("Field 'path' is required.");
  }
  // The renderer supplies this path, so only configuration files are ever read from it.
  if (!value.toLowerCase().endsWith('.bbc')) {
    throw new Error('Only .bbc configuration files can be read.');
  }
  return value;
}

async function readConfiguration(payload: unknown): Promise<BbcMetadata> {
  const path = requirePath((payload as Record<string, unknown> | null)?.['path']);
  const raw = await fs.promises.readFile(path, 'utf8');
  return describeConfiguration(parseConfiguration(raw));
}

async function importConfiguration(payload: unknown): Promise<BbcImportResult> {
  const p = (payload ?? {}) as Partial<BbcImportPayload>;
  const path = requirePath(p.path);
  if (typeof p.applySettings !== 'boolean') {
    throw new Error("Field 'applySettings' must be a boolean.");
  }
  if (!Array.isArray(p.serverIds) || p.serverIds.some((id) => typeof id !== 'string')) {
    throw new Error("Field 'serverIds' must be an array of strings.");
  }

  // The file is read again here instead of trusting anything the renderer parsed earlier.
  const raw = await fs.promises.readFile(path, 'utf8');
  return applyConfiguration(parseConfiguration(raw), {
    applySettings: p.applySettings,
    serverIds: p.serverIds,
  });
}
