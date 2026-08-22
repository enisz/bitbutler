export type DbAction = 'select' | 'insert' | 'update' | 'delete';

/** A single SQL-bindable column value. */
export type DbValue = string | number | boolean | null;

export interface DbRequest {
  action: DbAction;
  table: string;
  where?: Record<string, DbValue>;
  data?: Record<string, DbValue>;
  limit?: number;
  orderBy?: string;
}
