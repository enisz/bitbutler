export type ServerProtocol = 'http' | 'https';

export interface ServerEditorFormValue {
  name: string;
  host: string;
  protocol: ServerProtocol;
  port: number;
  username: string;
  password: string;
  autoLogin: boolean;
}
