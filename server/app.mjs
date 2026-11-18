import express from 'express';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import { auth, internalAuth, origins, baseURL } from './auth.mjs';
import { db, migrateAppTables, recordsFor, tables } from './db.mjs';
import { getMigrations } from 'better-auth/db/migration';
import { parseBackup } from '../services/backup.ts';
import { installCommunications, disconnectAccount } from './communications.mjs';

await (await getMigrations(auth.options)).runMigrations();
migrateAppTables();

const app = express();
const allowed = new Set([new URL(baseURL).origin, ...origins]);
app.disable('x-powered-by');
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !allowed.has(origin)) return res.status(403).json({ error: 'Origin not allowed.' });
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
const authHandler = toNodeHandler(auth);
app.all('/api/auth/*splat', (req, res) => {
  // Replace any client-supplied value before Better Auth applies per-IP limits.
  req.headers['x-solace-client-ip'] = req.socket.remoteAddress || '';
  return authHandler(req, res);
});
app.use(express.json({ limit: '8mb' }));

const accountFor = async req => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session?.user?.id) return null;
  return db.prepare('SELECT * FROM access_account WHERE user_id = ? AND status = ?').get(session.user.id, 'ACTIVE') || null;
};
const requireRole = role => async (req, res, next) => {
  try {
    const account = await accountFor(req);
    if (!account) return res.status(401).json({ error: 'Authentication required.' });
    if (account.role !== role) return res.status(403).json({ error: 'Access denied.' });
    req.account = account;
    next();
  } catch (error) { next(error); }
};
const tutor = requireRole('TUTOR');
const student = requireRole('STUDENT');
const hashToken = token => createHash('sha256').update(token).digest('hex');
const validEmail = email => typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;

app.get('/api/me', async (req, res, next) => {
  try {
    const account = await accountFor(req);
    if (!account) return res.status(401).json({ error: 'Authentication required.' });
    const user = db.prepare('SELECT name, email FROM user WHERE id = ?').get(account.user_id);
    res.json({ id: account.id, role: account.role, status: account.status, studentId: account.student_id, name: user.name, email: user.email });
  } catch (error) { next(error); }
});

app.post('/api/tutor/import', tutor, (req, res, next) => {
  try {
    const backup = parseBackup(JSON.stringify(req.body));
    if (Object.values(tables).some(table => db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).get())) {
      return res.status(409).json({ error: 'Records already exist. Import is only allowed into an empty database.' });
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const [collection, table] of Object.entries(tables)) {
        const insert = collection === 'students'
          ? db.prepare(`INSERT INTO ${table} (id, payload) VALUES (?, ?)`)
          : db.prepare(`INSERT INTO ${table} (id, student_id, payload) VALUES (?, ?, ?)`);
        for (const record of backup.data[collection]) {
          if (collection === 'students') insert.run(record.id, JSON.stringify(record));
          else insert.run(record.id, record.studentId, JSON.stringify(record));
        }
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    res.json({ imported: Object.fromEntries(Object.entries(backup.data).map(([key, value]) => [key, value.length])) });
  } catch (error) { next(error); }
});

app.get('/api/tutor/data', tutor, (_req, res) => {
  res.json({ app: 'solace', version: 1, exportedAt: new Date().toISOString(), data: Object.fromEntries(Object.keys(tables).map(key => [key, recordsFor(key)])) });
});

app.put('/api/tutor/data', tutor, (req, res, next) => {
  try {
    const backup = parseBackup(JSON.stringify(req.body));
    const studentIds = new Set(backup.data.students.map(item => item.id));
    for (const [collection, records] of Object.entries(backup.data)) {
      if (new Set(records.map(item => item.id)).size !== records.length) return res.status(400).json({ error: `Duplicate ${collection} IDs.` });
      if (collection !== 'students' && records.some(item => !studentIds.has(item.studentId))) {
        return res.status(400).json({ error: `${collection} contains a missing student reference.` });
      }
    }
    const linkedIds = db.prepare("SELECT student_id FROM access_account WHERE role = 'STUDENT'").all().map(row => row.student_id);
    if (linkedIds.some(id => !studentIds.has(id))) return res.status(409).json({ error: 'A student with an account cannot be deleted.' });
    db.exec('BEGIN IMMEDIATE');
    try {
      const saveStudent = db.prepare('INSERT INTO students(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload');
      for (const record of backup.data.students) saveStudent.run(record.id, JSON.stringify(record));
      for (const row of db.prepare('SELECT id FROM students').all()) {
        if (!studentIds.has(row.id)) db.prepare('DELETE FROM students WHERE id=?').run(row.id);
      }
      for (const [collection, table] of Object.entries(tables)) {
        if (collection === 'students') continue;
        db.prepare(`DELETE FROM ${table}`).run();
        const insert = db.prepare(`INSERT INTO ${table} (id, student_id, payload) VALUES (?, ?, ?)`);
        for (const record of backup.data[collection]) insert.run(record.id, record.studentId, JSON.stringify(record));
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    res.json({ saved: true });
  } catch (error) { next(error); }
});

app.get('/api/tutor/accounts', tutor, (_req, res) => {
  const rows = db.prepare(`SELECT a.id, a.student_id AS studentId, a.email, a.status, a.created_at AS createdAt,
    s.payload AS studentPayload FROM access_account a LEFT JOIN students s ON s.id = a.student_id WHERE a.role = 'STUDENT' ORDER BY a.created_at DESC`).all();
  res.json(rows.map(({ studentPayload, ...row }) => ({ ...row, studentName: studentPayload ? JSON.parse(studentPayload).name : null })));
});

app.post('/api/tutor/students/:id/invite', tutor, (req, res, next) => {
  try {
    const studentId = req.params.id;
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (!db.prepare('SELECT id FROM students WHERE id = ?').get(studentId)) return res.status(404).json({ error: 'Student not found.' });
    const existing = db.prepare('SELECT * FROM access_account WHERE student_id = ?').get(studentId);
    if (existing?.user_id) return res.status(409).json({ error: 'This student already has an account.' });
    const otherEmail = db.prepare('SELECT id FROM access_account WHERE email = ?').get(email);
    if (otherEmail && otherEmail.id !== existing?.id) return res.status(409).json({ error: 'This email is already linked to an account.' });
    const now = new Date().toISOString();
    const accessId = existing?.id || randomUUID();
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
      if (existing) db.prepare('UPDATE access_account SET email = ?, status = ?, updated_at = ? WHERE id = ?').run(email, 'PENDING', now, accessId);
      else db.prepare(`INSERT INTO access_account (id, user_id, student_id, email, role, status, created_at, updated_at)
        VALUES (?, NULL, ?, ?, 'STUDENT', 'PENDING', ?, ?)`).run(accessId, studentId, email, now, now);
      db.prepare('DELETE FROM invitation WHERE access_id = ? AND used_at IS NULL').run(accessId);
      db.prepare('INSERT INTO invitation (id, access_id, token_hash, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)')
        .run(randomUUID(), accessId, hashToken(token), expiresAt, now);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    const appURL = process.env.SOLACE_APP_URL || 'http://localhost:5173';
    res.json({ status: 'PENDING', expiresAt, activationLink: `${appURL.replace(/\/$/, '')}/#/activate?token=${encodeURIComponent(token)}` });
  } catch (error) { next(error); }
});

const findInvitation = token => {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  return db.prepare(`SELECT i.*, a.student_id, a.email, a.status, s.payload FROM invitation i
    JOIN access_account a ON a.id = i.access_id JOIN students s ON s.id = a.student_id
    WHERE i.token_hash = ? AND i.used_at IS NULL AND i.expires_at > ? AND a.status = 'PENDING'`)
    .get(hashToken(token), new Date().toISOString()) || null;
};
app.get('/api/public/invitations/:token', (req, res) => {
  const invite = findInvitation(req.params.token);
  if (!invite) return res.status(404).json({ error: 'Invitation is invalid or expired.' });
  res.json({ studentName: JSON.parse(invite.payload).name, email: invite.email, expiresAt: invite.expires_at });
});

app.post('/api/public/activate', async (req, res, next) => {
  try {
    const { token, password } = req.body || {};
    if (typeof password !== 'string' || password.length < 12 || password.length > 128) return res.status(400).json({ error: 'Password must be 12 to 128 characters.' });
    const invite = findInvitation(token);
    if (!invite) return res.status(400).json({ error: 'Invitation is invalid or expired.' });
    const claimed = db.prepare('UPDATE invitation SET used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?')
      .run(new Date().toISOString(), invite.id, new Date().toISOString());
    if (claimed.changes !== 1) return res.status(400).json({ error: 'Invitation is invalid or expired.' });
    let created;
    try {
      created = await internalAuth.api.signUpEmail({
        body: { name: JSON.parse(invite.payload).name, email: invite.email, password },
        headers: new Headers({ origin: baseURL }),
      });
      if (!created?.user?.id) throw new Error('Could not activate account.');
      const linked = db.prepare("UPDATE access_account SET user_id = ?, status = ?, updated_at = ? WHERE id = ? AND user_id IS NULL AND status = 'PENDING'")
        .run(created.user.id, 'ACTIVE', new Date().toISOString(), invite.access_id);
      if (linked.changes !== 1) throw new Error('Account activation conflicted with another change.');
      db.prepare('DELETE FROM session WHERE userId = ?').run(created.user.id);
    } catch (error) {
      if (created?.user?.id) {
        db.prepare('DELETE FROM session WHERE userId = ?').run(created.user.id);
        db.prepare('DELETE FROM account WHERE userId = ?').run(created.user.id);
        db.prepare('DELETE FROM user WHERE id = ?').run(created.user.id);
      }
      db.prepare('UPDATE invitation SET used_at = NULL WHERE id = ?').run(invite.id);
      throw error;
    }
    res.json({ activated: true });
  } catch (error) { next(error); }
});

for (const action of ['disable', 'reactivate']) {
  app.post(`/api/tutor/accounts/:id/${action}`, tutor, (req, res) => {
    const account = db.prepare("SELECT * FROM access_account WHERE id = ? AND role = 'STUDENT'").get(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found.' });
    const status = action === 'disable' ? 'DISABLED' : account.user_id ? 'ACTIVE' : 'PENDING';
    db.prepare('UPDATE access_account SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), account.id);
    if (action === 'disable' && account.user_id) db.prepare('DELETE FROM session WHERE userId = ?').run(account.user_id);
    if (action === 'disable') disconnectAccount(account.id);
    res.json({ status });
  });
}

app.patch('/api/tutor/accounts/:id', tutor, (req, res, next) => {
  try {
    const account = db.prepare("SELECT * FROM access_account WHERE id = ? AND role = 'STUDENT'").get(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found.' });
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (email === account.email) return res.json({ email });
    if (db.prepare('SELECT 1 FROM access_account WHERE email = ?').get(email)) return res.status(409).json({ error: 'Email already in use.' });
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE access_account SET email = ?, updated_at = ? WHERE id = ?').run(email, new Date().toISOString(), account.id);
      if (account.user_id) {
        db.prepare('UPDATE user SET email = ?, emailVerified = 0, updatedAt = ? WHERE id = ?').run(email, Date.now(), account.user_id);
        db.prepare('DELETE FROM session WHERE userId = ?').run(account.user_id);
        disconnectAccount(account.id);
      } else {
        db.prepare('DELETE FROM invitation WHERE access_id = ? AND used_at IS NULL').run(account.id);
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    res.json({ email, sessionsRevoked: Boolean(account.user_id) });
  } catch (error) { next(error); }
});

app.get('/api/student/dashboard', student, (req, res) => {
  const studentId = req.account.student_id;
  const profile = recordsFor('students').find(item => item.id === studentId);
  if (!profile) return res.status(404).json({ error: 'Student profile not found.' });
  res.json({ profile, completedClasses: recordsFor('classes', studentId), testResults: recordsFor('testResults', studentId) });
});

app.get('/api/students/:id', async (req, res, next) => {
  try {
    const account = await accountFor(req);
    if (!account) return res.status(401).json({ error: 'Authentication required.' });
    if (account.role === 'STUDENT' && account.student_id !== req.params.id) return res.status(403).json({ error: 'Access denied.' });
    const profile = recordsFor('students').find(item => item.id === req.params.id);
    if (!profile) return res.status(404).json({ error: 'Student not found.' });
    res.json({ profile, classes: recordsFor('classes', req.params.id), testResults: recordsFor('testResults', req.params.id) });
  } catch (error) { next(error); }
});

installCommunications(app, { accountFor, tutor, student });

// The same server can host the built web app used by invitation links.
app.use(express.static(resolve(import.meta.dirname, '..', 'dist')));

app.use((error, _req, res, _next) => {
  console.error('Request failed:', error?.message || error);
  if (!res.headersSent) res.status(500).json({ error: 'Request failed.' });
});

export { app };
