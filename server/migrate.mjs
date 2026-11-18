import { getMigrations } from 'better-auth/db/migration';
import { auth } from './auth.mjs';
import { migrateAppTables } from './db.mjs';

const migration = await getMigrations(auth.options);
await migration.runMigrations();
migrateAppTables();
console.log('Solace database migrations complete.');
