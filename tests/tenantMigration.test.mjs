import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dir = mkdtempSync(join(tmpdir(), 'solace-tenant-migration-'));
const path = join(dir, 'legacy.sqlite');
const legacy = new DatabaseSync(path);
legacy.exec(`
  CREATE TABLE access_account (id TEXT PRIMARY KEY,user_id TEXT UNIQUE,student_id TEXT UNIQUE,email TEXT UNIQUE,
    role TEXT,status TEXT,created_at TEXT,updated_at TEXT);
  CREATE TABLE students (id TEXT PRIMARY KEY,payload TEXT NOT NULL);
  CREATE TABLE announcement (id TEXT PRIMARY KEY,title TEXT,body TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);
  CREATE TABLE homework (id TEXT PRIMARY KEY,title TEXT,description TEXT,class_id TEXT,deadline TEXT,created_at TEXT,updated_at TEXT,deleted_at TEXT);
  INSERT INTO access_account VALUES ('old-tutor','old-user',NULL,'old@example.test','TUTOR','ACTIVE','2025-01-01','2025-01-01');
  INSERT INTO access_account VALUES ('old-student','student-user','student-a','student@example.test','STUDENT','ACTIVE','2025-02-01','2025-02-01');
  INSERT INTO students VALUES ('student-a','{"id":"student-a","name":"Existing Student"}');
  INSERT INTO announcement VALUES ('announcement-a','Title','Body','2025-02-01','2025-02-01',NULL);
  INSERT INTO homework VALUES ('homework-a','Title','Body',NULL,NULL,'2025-02-01','2025-02-01',NULL);
`);
legacy.close();
process.env.SOLACE_DATABASE_PATH = path;
const { db, migrateAppTables, ownedStudent, enrolledStudent } = await import('../server/db.mjs');

test('legacy student records and links receive the original teacher without changing IDs', () => {
  try {
    migrateAppTables();
    assert.equal(ownedStudent('old-tutor', 'student-a'), true);
    assert.equal(enrolledStudent('old-student', 'student-a'), true);
    assert.equal(db.prepare("SELECT owner_tutor_id AS id FROM announcement WHERE id='announcement-a'").get().id, 'old-tutor');
    assert.equal(db.prepare("SELECT owner_tutor_id AS id FROM homework WHERE id='homework-a'").get().id, 'old-tutor');
    migrateAppTables();
    assert.equal(db.prepare('SELECT count(*) AS count FROM student_enrollment').get().count, 1);
  } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
});
