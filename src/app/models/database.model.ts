export type DbAction = 'select' | 'insert' | 'update' | 'delete';

export interface DbRequest {
  action: DbAction;
  table: string;
  where?: Record<string, any>;
  data?: Record<string, any>;
  limit?: number;
  orderBy?: string;
}
