import { randomUUID } from 'node:crypto';
import { db, migrateAppTables, saveDatabase } from './db.mjs';
import { internalAuth, auth, baseURL } from './auth.mjs';
import { getMigrations } from 'better-auth/db/migration';

await (await getMigrations(auth.options)).runMigrations();
migrateAppTables();

const email = process.env.SOLACE_SETUP_EMAIL?.trim().toLowerCase();
const password = process.env.SOLACE_SETUP_PASSWORD;
const name = process.env.SOLACE_SETUP_NAME?.trim() || 'Tutor';
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 12) {
  throw new Error('Set SOLACE_SETUP_EMAIL and SOLACE_SETUP_PASSWORD (at least 12 characters).');
}
if (db.prepare('SELECT count(*) AS count FROM user').get().count !== 0 ||
    db.prepare('SELECT count(*) AS count FROM access_account').get().count !== 0) {
  throw new Error('Initial tutor setup is locked because an account already exists.');
}

const created = await internalAuth.api.signUpEmail({
  body: { name, email, password },
  headers: new Headers({ origin: baseURL }),
});
if (!created?.user?.id) throw new Error('Tutor account was not created.');
const now = new Date().toISOString();
db.prepare(`INSERT INTO access_account (id, user_id, student_id, email, role, status, created_at, updated_at)
  VALUES (?, ?, NULL, ?, 'TUTOR', 'ACTIVE', ?, ?)`).run(randomUUID(), created.user.id, email, now, now);
db.prepare('DELETE FROM session WHERE userId = ?').run(created.user.id);
await saveDatabase({ force: true });
console.log(`Initial tutor account created for ${email}. Remove SOLACE_SETUP_PASSWORD from .env or the shell now.`);
