import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { SnapshotStore } from '../server/snapshot-store.mjs';

class MemoryPool {
  row = null;
  writes = 0;
  async query(sql, values = []) {
    if (sql.startsWith('CREATE TABLE')) return { rows: [] };
    if (sql.startsWith('SELECT revision')) return { rows: this.row ? [{ ...this.row }] : [] };
    if (sql.startsWith('INSERT INTO')) {
      if (this.row) return { rows: [] };
      this.row = { revision: 1, snapshot: Buffer.from(values[0]), sha256: values[1] };
    } else if (sql.startsWith('UPDATE solace_snapshot')) {
      if (!this.row || this.row.revision !== values[2]) return { rows: [] };
      this.row = { revision: this.row.revision + 1, snapshot: Buffer.from(values[0]), sha256: values[1] };
    } else throw new Error(`Unexpected SQL: ${sql}`);
    this.writes += 1;
    return { rows: [{ revision: this.row.revision }] };
  }
}

test('Neon snapshot restores a complete SQLite database after a restart', async () => {
  const pool = new MemoryPool();
  const first = new DatabaseSync(':memory:');
  first.exec('CREATE TABLE student (id TEXT PRIMARY KEY, name TEXT); INSERT INTO student VALUES (\'1\', \'Ada\')');
  const writer = new SnapshotStore(pool);
  await writer.load(first);
  await writer.saveIfChanged(first, { force: true });
  first.prepare('UPDATE student SET name = ? WHERE id = ?').run('Grace', '1');
  await writer.saveIfChanged(first);
  await writer.saveIfChanged(first);
  assert.equal(pool.writes, 2);
  first.close();

  const restored = new DatabaseSync(':memory:');
  await new SnapshotStore(pool, { requireExisting: true }).load(restored);
  assert.equal(restored.prepare('SELECT name FROM student WHERE id = ?').get('1').name, 'Grace');
  restored.close();
});

test('a stale instance cannot replace a newer Neon snapshot', async () => {
  const pool = new MemoryPool();
  const first = new DatabaseSync(':memory:');
  first.exec('CREATE TABLE t (value TEXT); INSERT INTO t VALUES (\'first\')');
  const current = new SnapshotStore(pool);
  await current.load(first);
  await current.saveIfChanged(first, { force: true });

  const staleDb = new DatabaseSync(':memory:');
  const stale = new SnapshotStore(pool);
  await stale.load(staleDb);
  first.prepare('UPDATE t SET value = ?').run('current');
  await current.saveIfChanged(first);
  staleDb.prepare('UPDATE t SET value = ?').run('stale');
  await assert.rejects(stale.saveIfChanged(staleDb), /changed elsewhere/);
  assert.equal(pool.writes, 2);
  first.close(); staleDb.close();
});

test('missing or corrupted required snapshots stop startup', async () => {
  const pool = new MemoryPool();
  const db = new DatabaseSync(':memory:');
  await assert.rejects(new SnapshotStore(pool, { requireExisting: true }).load(db), /no Solace snapshot/);
  db.exec('CREATE TABLE t (id TEXT)');
  const writer = new SnapshotStore(pool);
  await writer.load(db);
  await writer.saveIfChanged(db, { force: true });
  pool.row.sha256 = 'incorrect';
  await assert.rejects(new SnapshotStore(pool).load(new DatabaseSync(':memory:')), /checksum/);
  db.close();
});
