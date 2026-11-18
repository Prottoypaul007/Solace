import { createHash } from 'node:crypto';
import { Pool } from 'pg';

const checksum = bytes => createHash('sha256').update(bytes).digest('hex');

export class SnapshotStore {
  constructor(pool, { requireExisting = false } = {}) {
    this.pool = pool;
    this.requireExisting = requireExisting;
    this.revision = 0;
    this.lastCapturedChanges = 0;
    this.queue = Promise.resolve();
  }

  async load(db) {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS solace_snapshot (
      id integer PRIMARY KEY CHECK (id = 1),
      revision bigint NOT NULL,
      snapshot bytea NOT NULL,
      sha256 text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    const result = await this.pool.query('SELECT revision, snapshot, sha256 FROM solace_snapshot WHERE id = 1');
    const row = result.rows[0];
    if (!row) {
      if (this.requireExisting) throw new Error('Neon has no Solace snapshot. Create the tutor account before starting Render.');
      return;
    }
    const bytes = Buffer.from(row.snapshot);
    if (checksum(bytes) !== row.sha256) throw new Error('Neon snapshot checksum does not match. Startup stopped.');
    db.deserialize(bytes);
    if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') {
      throw new Error('Neon snapshot failed SQLite integrity check. Startup stopped.');
    }
    this.revision = Number(row.revision);
    if (!Number.isSafeInteger(this.revision) || this.revision < 1) throw new Error('Invalid Neon snapshot revision.');
  }

  saveIfChanged(db, { force = false } = {}) {
    const changes = db.prepare('SELECT total_changes() AS count').get().count;
    if (!force && changes === this.lastCapturedChanges) return this.queue;
    const bytes = Buffer.from(db.serialize());
    const hash = checksum(bytes);
    this.lastCapturedChanges = changes;
    this.queue = this.queue.then(async () => {
      const result = this.revision === 0
        ? await this.pool.query(`INSERT INTO solace_snapshot (id, revision, snapshot, sha256)
            VALUES (1, 1, $1, $2) ON CONFLICT (id) DO NOTHING RETURNING revision`, [bytes, hash])
        : await this.pool.query(`UPDATE solace_snapshot
            SET revision = revision + 1, snapshot = $1, sha256 = $2, updated_at = now()
            WHERE id = 1 AND revision = $3 RETURNING revision`, [bytes, hash, this.revision]);
      if (result.rows.length !== 1) throw new Error('Neon snapshot changed elsewhere. Restart the service before writing again.');
      this.revision = Number(result.rows[0].revision);
    });
    return this.queue;
  }
}

export const openSnapshotStore = async (connectionString, options) => {
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 20_000 });
  const store = new SnapshotStore(pool, options);
  return store;
};
