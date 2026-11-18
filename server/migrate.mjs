import { getMigrations } from 'better-auth/db/migration';
import { auth } from './auth.mjs';
import { migrateAppTables, saveDatabase } from './db.mjs';

const migration = await getMigrations(auth.options);
await migration.runMigrations();
migrateAppTables();
await saveDatabase({ force: true });
console.log('Solace database migrations complete.');
