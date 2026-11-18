import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { openSnapshotStore } from './snapshot-store.mjs';

const remoteUrl = process.env.DATABASE_URL;
if (process.env.RENDER === 'true' && !remoteUrl) {
  throw new Error('DATABASE_URL is required on Render. Refusing to use temporary SQLite storage.');
}
export const databasePath = remoteUrl ? ':memory:' : resolve(process.env.SOLACE_DATABASE_PATH || 'server/data/solace.sqlite');
if (!remoteUrl) mkdirSync(dirname(databasePath), { recursive: true });
export const db = new DatabaseSync(databasePath);
const snapshotStore = remoteUrl
  ? await openSnapshotStore(remoteUrl, { requireExisting: process.env.RENDER === 'true' || process.env.SOLACE_REQUIRE_SNAPSHOT === '1' })
  : null;
if (snapshotStore) {
  await snapshotStore.load(db);
  console.log(`Neon snapshot loaded at revision ${snapshotStore.revision}.`);
}
db.exec(remoteUrl ? 'PRAGMA foreign_keys = ON;' : 'PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
export const saveDatabase = options => snapshotStore?.saveIfChanged(db, options) ?? Promise.resolve();
export const usesRemoteSnapshot = Boolean(snapshotStore);

export const migrateAppTables = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS access_account (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE,
      student_id TEXT UNIQUE,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK (role IN ('TUTOR', 'STUDENT')),
      status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'DISABLED')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS invitation (
      id TEXT PRIMARY KEY,
      access_id TEXT NOT NULL REFERENCES access_account(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS students (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS classes (id TEXT PRIMARY KEY, student_id TEXT NOT NULL, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, student_id TEXT NOT NULL, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS test_results (id TEXT PRIMARY KEY, student_id TEXT NOT NULL, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS parent_contacts (id TEXT PRIMARY KEY, student_id TEXT NOT NULL, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS communications (id TEXT PRIMARY KEY, student_id TEXT NOT NULL, payload TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS classes_student_idx ON classes(student_id);
    CREATE INDEX IF NOT EXISTS payments_student_idx ON payments(student_id);
    CREATE INDEX IF NOT EXISTS test_results_student_idx ON test_results(student_id);
    CREATE INDEX IF NOT EXISTS parent_contacts_student_idx ON parent_contacts(student_id);
    CREATE INDEX IF NOT EXISTS communications_student_idx ON communications(student_id);
    CREATE INDEX IF NOT EXISTS invitations_access_idx ON invitation(access_id);
    CREATE TABLE IF NOT EXISTS scheduled_class (
      id TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE, start_at TEXT NOT NULL,
      subject TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('SCHEDULED','CANCELLED')),
      reminder_minutes INTEGER NOT NULL DEFAULT 30, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS scheduled_class_student_idx ON scheduled_class(student_id,start_at);
    CREATE TABLE IF NOT EXISTS conversation (
      id TEXT PRIMARY KEY, student_id TEXT NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS message (
      id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
      sender_account_id TEXT NOT NULL REFERENCES access_account(id), client_nonce TEXT NOT NULL,
      body TEXT NOT NULL, created_at TEXT NOT NULL, read_at TEXT,
      UNIQUE(sender_account_id,client_nonce)
    );
    CREATE INDEX IF NOT EXISTS message_conversation_idx ON message(conversation_id,created_at,id);
    CREATE TABLE IF NOT EXISTS announcement (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS announcement_recipient (
      announcement_id TEXT NOT NULL REFERENCES announcement(id) ON DELETE CASCADE, student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      read_at TEXT, PRIMARY KEY(announcement_id,student_id)
    );
    CREATE INDEX IF NOT EXISTS announcement_student_idx ON announcement_recipient(student_id);
    CREATE TABLE IF NOT EXISTS homework (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
      class_id TEXT REFERENCES scheduled_class(id) ON DELETE SET NULL, deadline TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS homework_recipient (
      homework_id TEXT NOT NULL REFERENCES homework(id) ON DELETE CASCADE, student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      completed_at TEXT, PRIMARY KEY(homework_id,student_id)
    );
    CREATE INDEX IF NOT EXISTS homework_student_idx ON homework_recipient(student_id);
    CREATE TABLE IF NOT EXISTS homework_attachment (
      id TEXT PRIMARY KEY, homework_id TEXT NOT NULL REFERENCES homework(id) ON DELETE CASCADE, name TEXT NOT NULL,
      mime TEXT NOT NULL, size INTEGER NOT NULL, bytes BLOB NOT NULL, client_nonce TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notification (
      id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES access_account(id),
      type TEXT NOT NULL, resource_id TEXT NOT NULL, created_at TEXT NOT NULL, read_at TEXT,
      unique_key TEXT UNIQUE
    );
    CREATE INDEX IF NOT EXISTS notification_account_idx ON notification(account_id,created_at);
    CREATE TABLE IF NOT EXISTS reminder_occurrence (
      scheduled_class_id TEXT NOT NULL REFERENCES scheduled_class(id) ON DELETE CASCADE, start_at TEXT NOT NULL,
      reminder_minutes INTEGER NOT NULL, generated_at TEXT NOT NULL,
      PRIMARY KEY(scheduled_class_id,start_at,reminder_minutes)
    );
  `);
  // Existing installations had one tutor. Assign their records before adding
  // another tutor, keeping every student and record ID intact.
  if (!db.prepare('PRAGMA table_info(students)').all().some(column => column.name === 'owner_tutor_id')) {
    db.exec('ALTER TABLE students ADD COLUMN owner_tutor_id TEXT');
  }
  if (!db.prepare('PRAGMA table_info(announcement)').all().some(column => column.name === 'owner_tutor_id')) {
    db.exec('ALTER TABLE announcement ADD COLUMN owner_tutor_id TEXT');
  }
  if (!db.prepare('PRAGMA table_info(homework)').all().some(column => column.name === 'owner_tutor_id')) {
    db.exec('ALTER TABLE homework ADD COLUMN owner_tutor_id TEXT');
  }
  const firstTutor = db.prepare("SELECT id FROM access_account WHERE role='TUTOR' ORDER BY created_at,id LIMIT 1").get()?.id;
  if (firstTutor) {
    db.prepare('UPDATE students SET owner_tutor_id=? WHERE owner_tutor_id IS NULL').run(firstTutor);
    db.prepare('UPDATE announcement SET owner_tutor_id=? WHERE owner_tutor_id IS NULL').run(firstTutor);
    db.prepare('UPDATE homework SET owner_tutor_id=? WHERE owner_tutor_id IS NULL').run(firstTutor);
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS students_owner_idx ON students(owner_tutor_id);
    CREATE TABLE IF NOT EXISTS student_enrollment (
      student_id TEXT PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES access_account(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','DISABLED')),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS enrollment_account_idx ON student_enrollment(account_id);
    CREATE TABLE IF NOT EXISTS teacher_invitation (
      id TEXT PRIMARY KEY,
      inviter_account_id TEXT NOT NULL REFERENCES access_account(id),
      email TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS student_link_invitation (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES access_account(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );
  `);
  if (!db.prepare('PRAGMA table_info(student_enrollment)').all().some(column => column.name === 'status')) {
    db.exec("ALTER TABLE student_enrollment ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE'");
  }
  db.prepare(`INSERT OR IGNORE INTO student_enrollment(student_id,account_id,created_at)
    SELECT student_id,id,created_at FROM access_account WHERE role='STUDENT' AND student_id IS NOT NULL`).run();
  if (!db.prepare('PRAGMA table_info(homework_attachment)').all().some(column => column.name === 'client_nonce')) {
    db.exec('ALTER TABLE homework_attachment ADD COLUMN client_nonce TEXT');
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS homework_attachment_nonce_idx ON homework_attachment(homework_id,client_nonce)');
};

export const tables = {
  students: 'students', classes: 'classes', payments: 'payments',
  testResults: 'test_results', parentContacts: 'parent_contacts', communications: 'communications',
};

export const recordsFor = (collection, studentId) => {
  const table = tables[collection];
  if (!table) throw new Error('Unknown collection');
  const rows = studentId === undefined
    ? db.prepare(`SELECT payload FROM ${table}`).all()
    : db.prepare(`SELECT payload FROM ${table} WHERE student_id = ?`).all(studentId);
  return rows.map(row => JSON.parse(row.payload));
};

export const ownedStudent = (tutorId, studentId) => Boolean(db.prepare('SELECT 1 FROM students WHERE id=? AND owner_tutor_id=?').get(studentId, tutorId));
export const enrolledStudent = (accountId, studentId) => Boolean(db.prepare("SELECT 1 FROM student_enrollment WHERE student_id=? AND account_id=? AND status='ACTIVE'").get(studentId, accountId));
export const studentIdsFor = accountId => db.prepare("SELECT student_id AS id FROM student_enrollment WHERE account_id=? AND status='ACTIVE'").all(accountId).map(row => row.id);
export const tutorForStudent = studentId => db.prepare('SELECT owner_tutor_id AS id FROM students WHERE id=?').get(studentId)?.id;
export const recordsForTutor = (collection, tutorId) => {
  const table = tables[collection];
  if (!table) throw new Error('Unknown collection');
  const rows = collection === 'students'
    ? db.prepare('SELECT payload FROM students WHERE owner_tutor_id=?').all(tutorId)
    : db.prepare(`SELECT r.payload FROM ${table} r JOIN students s ON s.id=r.student_id WHERE s.owner_tutor_id=?`).all(tutorId);
  return rows.map(row => JSON.parse(row.payload));
};
