import { initLogger } from './logger.js';

// Evaluated before main.ts (see index.ts) so console wrappers and crash handlers exist before
// db.js / better-sqlite3 load and any startup failure there is written to the log file.
initLogger();
