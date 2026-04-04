export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface HttpRequest {
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean>;
  body?: any;
  timeoutMs?: number;
  cookieKey?: string;
}

export interface HttpResponse<T = any> {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    message?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
