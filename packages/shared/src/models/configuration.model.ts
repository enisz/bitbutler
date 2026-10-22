import type { ServerProtocol } from './server.model.js';

export interface BbcServer {
  id: string;
  name: string;
  host: string;
  protocol: ServerProtocol;
  port: number;
  auto_login: boolean;
  created_at: string;
  settings: Record<string, unknown>;
}

export interface BbcFile {
  version: number;
  exported_at: number;
  settings: Record<string, unknown>;
  servers: Record<string, BbcServer>;
}

export interface BbcServerSummary {
  id: string;
  name: string;
  host: string;
  port: number;
  exists: boolean;
}

export interface BbcMetadata {
  version: number;
  exportedAt: number;
  hasSettings: boolean;
  servers: BbcServerSummary[];
}

export interface BbcImportPayload {
  path: string;
  applySettings: boolean;
  serverIds: string[];
}

export interface BbcImportResult {
  settings: boolean;
  servers: number;
}
