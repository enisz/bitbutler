export type ServerProtocol = 'http' | 'https';

export interface ServerRecord {
  id: string;
  name: string;
  host: string;
  protocol: ServerProtocol;
  port: number;
  username: string;
  auto_login: boolean;
  created_at: string;
  has_password: boolean;
  export_available: 0 | 1 | null;
  webapi_version: string | null;
  qb_version: string | null;
}

export interface NewServer {
  id?: string;
  name: string;
  host: string;
  protocol: ServerProtocol;
  port: number;
  username?: string;
  password?: string;
  auto_login?: boolean;
}
