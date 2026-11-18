import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { db } from './db.mjs';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to export the Neon snapshot.');
const directory = resolve('backups');
await mkdir(directory, { recursive: true });
const filename = `solace-server-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`;
const path = resolve(directory, filename);
await writeFile(path, Buffer.from(db.serialize()), { flag: 'wx', mode: 0o600 });
console.log(`Verified Neon snapshot saved to ${path}. Keep this file private.`);
