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
