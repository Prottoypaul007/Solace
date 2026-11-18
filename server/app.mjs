import express from 'express';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import { auth, internalAuth, origins, baseURL } from './auth.mjs';
import { db, migrateAppTables, recordsFor, recordsForTutor, ownedStudent, enrolledStudent, studentIdsFor, saveDatabase, tables, usesRemoteSnapshot } from './db.mjs';
import { getMigrations } from 'better-auth/db/migration';
import { parseBackup } from '../services/backup.ts';
import { installCommunications, disconnectAccount } from './communications.mjs';
import { persistBeforeResponse } from './persist-response.mjs';

await (await getMigrations(auth.options)).runMigrations();
migrateAppTables();
await saveDatabase({ force: true });

const app = express();
const allowed = new Set([new URL(baseURL).origin, ...origins]);
app.disable('x-powered-by');
app.use((req, res, next) => {
  // Browser module and stylesheet requests may carry an Origin header too.
  // Restrict API origins without blocking public files served from dist/.
  if (!req.path.startsWith('/api/')) return next();
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
if (usesRemoteSnapshot) app.use(persistBeforeResponse(saveDatabase));
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
    const studentIds = new Set(backup.data.students.map(item => item.id));
    for (const [collection, records] of Object.entries(backup.data)) {
      if (new Set(records.map(item => item.id)).size !== records.length) return res.status(400).json({ error: `Duplicate ${collection} IDs.` });
      if (collection !== 'students' && records.some(item => !studentIds.has(item.studentId))) {
        return res.status(400).json({ error: `${collection} contains a missing student reference.` });
      }
    }
    if (recordsForTutor('students', req.account.id).length) {
      return res.status(409).json({ error: 'Records already exist. Import is only allowed into an empty teacher account.' });
    }
    for (const [collection, table] of Object.entries(tables)) {
      if (backup.data[collection].some(item => db.prepare(`SELECT 1 FROM ${table} WHERE id=?`).get(item.id))) {
        return res.status(409).json({ error: `A ${collection} ID already exists in another teacher's records.` });
      }
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const [collection, table] of Object.entries(tables)) {
        const insert = collection === 'students'
          ? db.prepare(`INSERT INTO ${table} (id, payload, owner_tutor_id) VALUES (?, ?, ?)`)
          : db.prepare(`INSERT INTO ${table} (id, student_id, payload) VALUES (?, ?, ?)`);
        for (const record of backup.data[collection]) {
          if (collection === 'students') insert.run(record.id, JSON.stringify(record), req.account.id);
          else insert.run(record.id, record.studentId, JSON.stringify(record));
        }
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    res.json({ imported: Object.fromEntries(Object.entries(backup.data).map(([key, value]) => [key, value.length])) });
  } catch (error) { next(error); }
});

app.get('/api/tutor/data', tutor, (req, res) => {
  res.json({ app: 'solace', version: 1, exportedAt: new Date().toISOString(), data: Object.fromEntries(Object.keys(tables).map(key => [key, recordsForTutor(key, req.account.id)])) });
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
    const linkedIds = db.prepare(`SELECT e.student_id FROM student_enrollment e JOIN students s ON s.id=e.student_id
      WHERE s.owner_tutor_id=?`).all(req.account.id).map(row => row.student_id);
    if (linkedIds.some(id => !studentIds.has(id))) return res.status(409).json({ error: 'A student with an account cannot be deleted.' });
    if (backup.data.students.some(item => db.prepare('SELECT 1 FROM students WHERE id=? AND owner_tutor_id!=?').get(item.id, req.account.id))) {
      return res.status(409).json({ error: 'A student ID belongs to another teacher.' });
    }
    for (const [collection, table] of Object.entries(tables)) {
      if (collection === 'students') continue;
      if (backup.data[collection].some(item => db.prepare(`SELECT 1 FROM ${table} r JOIN students s ON s.id=r.student_id WHERE r.id=? AND s.owner_tutor_id!=?`).get(item.id, req.account.id))) {
        return res.status(409).json({ error: `A ${collection} ID belongs to another teacher.` });
      }
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const [collection, table] of Object.entries(tables)) {
        if (collection !== 'students') db.prepare(`DELETE FROM ${table} WHERE student_id IN
          (SELECT id FROM students WHERE owner_tutor_id=?)`).run(req.account.id);
      }
      const saveStudent = db.prepare('INSERT INTO students(id,payload,owner_tutor_id) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload');
      for (const record of backup.data.students) saveStudent.run(record.id, JSON.stringify(record), req.account.id);
      for (const row of db.prepare('SELECT id FROM students WHERE owner_tutor_id=?').all(req.account.id)) {
        if (!studentIds.has(row.id)) db.prepare('DELETE FROM students WHERE id=?').run(row.id);
      }
      for (const [collection, table] of Object.entries(tables)) {
        if (collection === 'students') continue;
        const insert = db.prepare(`INSERT INTO ${table} (id, student_id, payload) VALUES (?, ?, ?)`);
        for (const record of backup.data[collection]) insert.run(record.id, record.studentId, JSON.stringify(record));
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    res.json({ saved: true });
  } catch (error) { next(error); }
});

app.get('/api/tutor/accounts', tutor, (_req, res) => {
  const rows = db.prepare(`SELECT a.id, e.student_id AS studentId, a.email,
    CASE WHEN a.status='PENDING' THEN 'PENDING' ELSE e.status END AS status, a.created_at AS createdAt,
    (SELECT count(*) FROM student_enrollment x WHERE x.account_id=a.id) > 1 AS shared,
    s.payload AS studentPayload FROM access_account a JOIN student_enrollment e ON e.account_id=a.id
    JOIN students s ON s.id=e.student_id WHERE a.role='STUDENT' AND s.owner_tutor_id=? ORDER BY a.created_at DESC`).all(_req.account.id);
  res.json(rows.map(({ studentPayload, ...row }) => ({ ...row, studentName: studentPayload ? JSON.parse(studentPayload).name : null })));
});

app.post('/api/tutor/students/:id/invite', tutor, (req, res, next) => {
  try {
    const studentId = req.params.id;
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (!ownedStudent(req.account.id, studentId)) return res.status(404).json({ error: 'Student not found.' });
    const existing = db.prepare('SELECT a.* FROM access_account a JOIN student_enrollment e ON e.account_id=a.id WHERE e.student_id=?').get(studentId);
    if (existing?.user_id) return res.status(409).json({ error: 'This student already has an account.' });
    const otherEmail = db.prepare('SELECT id,role,status FROM access_account WHERE email = ?').get(email);
    if (otherEmail && otherEmail.id !== existing?.id) {
      if (otherEmail.role !== 'STUDENT' || otherEmail.status !== 'ACTIVE') return res.status(409).json({ error: 'This email belongs to another account.' });
      if (db.prepare(`SELECT 1 FROM student_enrollment e JOIN students s ON s.id=e.student_id
        WHERE e.account_id=? AND s.owner_tutor_id=?`).get(otherEmail.id, req.account.id)) {
        return res.status(409).json({ error: 'This student account is already linked to one of your students.' });
      }
      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      db.prepare('DELETE FROM student_link_invitation WHERE student_id=? AND used_at IS NULL').run(studentId);
      db.prepare(`INSERT INTO student_link_invitation(id,student_id,account_id,token_hash,expires_at,used_at,created_at)
        VALUES(?,?,?,?,?,NULL,?)`).run(randomUUID(), studentId, otherEmail.id, hashToken(token), expiresAt, new Date().toISOString());
      const appURL = process.env.SOLACE_APP_URL || 'http://localhost:5173';
      return res.json({ status: 'PENDING', expiresAt, activationLink: `${appURL.replace(/\/$/, '')}/#/activate?token=${encodeURIComponent(token)}` });
    }
    const now = new Date().toISOString();
    const accessId = existing?.id || randomUUID();
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
      if (existing) db.prepare('UPDATE access_account SET email = ?, status = ?, updated_at = ? WHERE id = ?').run(email, 'PENDING', now, accessId);
      else db.prepare(`INSERT INTO access_account (id, user_id, student_id, email, role, status, created_at, updated_at)
        VALUES (?, NULL, ?, ?, 'STUDENT', 'PENDING', ?, ?)`).run(accessId, studentId, email, now, now);
      db.prepare('INSERT OR IGNORE INTO student_enrollment(student_id,account_id,created_at) VALUES(?,?,?)').run(studentId, accessId, now);
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
  if (invite) return res.json({ kind: 'new-student', studentName: JSON.parse(invite.payload).name, email: invite.email, expiresAt: invite.expires_at });
  const link = db.prepare(`SELECT i.*,a.email,s.payload,u.name AS teacher_name FROM student_link_invitation i
    JOIN access_account a ON a.id=i.account_id JOIN students s ON s.id=i.student_id
    JOIN access_account t ON t.id=s.owner_tutor_id JOIN user u ON u.id=t.user_id
    WHERE i.token_hash=? AND i.used_at IS NULL AND i.expires_at>? AND a.status='ACTIVE'`).get(hashToken(req.params.token), new Date().toISOString());
  if (!link) return res.status(404).json({ error: 'Invitation is invalid or expired.' });
  res.json({ kind: 'existing-student', studentName: JSON.parse(link.payload).name, teacherName: link.teacher_name, email: link.email, expiresAt: link.expires_at });
});
app.post('/api/student/invitations/:token/accept', student, (req, res) => {
  const link = db.prepare(`SELECT * FROM student_link_invitation WHERE token_hash=? AND used_at IS NULL AND expires_at>?`)
    .get(hashToken(req.params.token), new Date().toISOString());
  if (!link || link.account_id !== req.account.id) return res.status(403).json({ error: 'Sign in with the invited student account.' });
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT OR IGNORE INTO student_enrollment(student_id,account_id,created_at) VALUES(?,?,?)').run(link.student_id, link.account_id, new Date().toISOString());
    db.prepare('UPDATE student_link_invitation SET used_at=? WHERE id=? AND used_at IS NULL').run(new Date().toISOString(), link.id);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  res.json({ linked: true });
});

app.post('/api/tutor/teachers/invite', tutor, (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid teacher email.' });
  if (db.prepare('SELECT 1 FROM access_account WHERE email=?').get(email)) return res.status(409).json({ error: 'This email already has an account.' });
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  db.prepare('DELETE FROM teacher_invitation WHERE email=? AND used_at IS NULL').run(email);
  db.prepare(`INSERT INTO teacher_invitation(id,inviter_account_id,email,token_hash,expires_at,used_at,created_at)
    VALUES(?,?,?,?,?,NULL,?)`).run(randomUUID(), req.account.id, email, hashToken(token), expiresAt, new Date().toISOString());
  const appURL = process.env.SOLACE_APP_URL || 'http://localhost:5173';
  res.json({ expiresAt, activationLink: `${appURL.replace(/\/$/, '')}/#/activate-teacher?token=${encodeURIComponent(token)}` });
});
const findTeacherInvitation = token => typeof token === 'string' && /^[A-Za-z0-9_-]{40,60}$/.test(token)
  ? db.prepare('SELECT * FROM teacher_invitation WHERE token_hash=? AND used_at IS NULL AND expires_at>?').get(hashToken(token), new Date().toISOString()) : null;
app.get('/api/public/teacher-invitations/:token', (req, res) => {
  const invite = findTeacherInvitation(req.params.token);
  res.status(invite ? 200 : 404).json(invite ? { email: invite.email, expiresAt: invite.expires_at } : { error: 'Invitation is invalid or expired.' });
});
app.post('/api/public/activate-teacher', async (req, res, next) => {
  try {
    const invite = findTeacherInvitation(req.body?.token);
    const name = String(req.body?.name || '').trim();
    const password = req.body?.password;
    if (!invite) return res.status(400).json({ error: 'Invitation is invalid or expired.' });
    if (!name || name.length > 120 || typeof password !== 'string' || password.length < 12 || password.length > 128) {
      return res.status(400).json({ error: 'Enter a name and password of at least 12 characters.' });
    }
    if (db.prepare('SELECT 1 FROM access_account WHERE email=?').get(invite.email)) return res.status(409).json({ error: 'This email already has an account.' });
    const claimed = db.prepare('UPDATE teacher_invitation SET used_at=? WHERE id=? AND used_at IS NULL AND expires_at>?')
      .run(new Date().toISOString(), invite.id, new Date().toISOString());
    if (!claimed.changes) return res.status(400).json({ error: 'Invitation is invalid or expired.' });
    let created;
    try {
      created = await internalAuth.api.signUpEmail({ body: { name, email: invite.email, password }, headers: new Headers({ origin: baseURL }) });
      if (!created?.user?.id) throw new Error('Could not create teacher account.');
      db.prepare(`INSERT INTO access_account(id,user_id,student_id,email,role,status,created_at,updated_at)
        VALUES(?,?,NULL,?,'TUTOR','ACTIVE',?,?)`).run(randomUUID(), created.user.id, invite.email, new Date().toISOString(), new Date().toISOString());
      db.prepare('DELETE FROM session WHERE userId=?').run(created.user.id);
    } catch (error) {
      if (created?.user?.id) {
        db.prepare('DELETE FROM session WHERE userId=?').run(created.user.id);
        db.prepare('DELETE FROM account WHERE userId=?').run(created.user.id);
        db.prepare('DELETE FROM user WHERE id=?').run(created.user.id);
      }
      db.prepare('UPDATE teacher_invitation SET used_at=NULL WHERE id=?').run(invite.id);
      throw error;
    }
    res.json({ activated: true });
  } catch (error) { next(error); }
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
    const account = db.prepare(`SELECT a.* FROM access_account a JOIN student_enrollment e ON e.account_id=a.id
      JOIN students s ON s.id=e.student_id WHERE a.id=? AND a.role='STUDENT' AND s.owner_tutor_id=?`).get(req.params.id, req.account.id);
    if (!account) return res.status(404).json({ error: 'Account not found.' });
    const status = action === 'disable' ? 'DISABLED' : 'ACTIVE';
    db.prepare(`UPDATE student_enrollment SET status=? WHERE account_id=? AND student_id IN
      (SELECT id FROM students WHERE owner_tutor_id=?)`).run(status, account.id, req.account.id);
    const activeLinks = db.prepare("SELECT count(*) AS count FROM student_enrollment WHERE account_id=? AND status='ACTIVE'").get(account.id).count;
    if (!activeLinks) {
      db.prepare("UPDATE access_account SET status='DISABLED',updated_at=? WHERE id=?").run(new Date().toISOString(), account.id);
      if (account.user_id) db.prepare('DELETE FROM session WHERE userId=?').run(account.user_id);
      disconnectAccount(account.id);
    } else if (account.status === 'DISABLED') {
      db.prepare("UPDATE access_account SET status='ACTIVE',updated_at=? WHERE id=?").run(new Date().toISOString(), account.id);
    }
    res.json({ status });
  });
}

app.patch('/api/tutor/accounts/:id', tutor, (req, res, next) => {
  try {
    const account = db.prepare(`SELECT a.* FROM access_account a JOIN student_enrollment e ON e.account_id=a.id
      JOIN students s ON s.id=e.student_id WHERE a.id=? AND a.role='STUDENT' AND s.owner_tutor_id=?`).get(req.params.id, req.account.id);
    if (!account) return res.status(404).json({ error: 'Account not found.' });
    if (db.prepare('SELECT count(*) AS count FROM student_enrollment WHERE account_id=?').get(account.id).count > 1) {
      return res.status(409).json({ error: 'This student uses more than one teacher. Ask the student to manage their account email.' });
    }
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
  const enrollments = db.prepare(`SELECT s.id AS studentId,s.payload,u.name AS teacherName,t.id AS teacherId
    FROM student_enrollment e JOIN students s ON s.id=e.student_id
    JOIN access_account t ON t.id=s.owner_tutor_id JOIN user u ON u.id=t.user_id
    WHERE e.account_id=? AND e.status='ACTIVE' ORDER BY e.created_at`).all(req.account.id)
    .map(row => ({ studentId: row.studentId, teacherId: row.teacherId, teacherName: row.teacherName, profile: JSON.parse(row.payload) }));
  if (!enrollments.length) return res.status(404).json({ error: 'No active teacher links found.' });
  const profile = enrollments[0].profile;
  res.json({ profile, enrollments,
    completedClasses: enrollments.flatMap(link => recordsFor('classes', link.studentId).map(item => ({ ...item, teacherName: link.teacherName }))),
    testResults: enrollments.flatMap(link => recordsFor('testResults', link.studentId).map(item => ({ ...item, teacherName: link.teacherName }))) });
});

app.get('/api/students/:id', async (req, res, next) => {
  try {
    const account = await accountFor(req);
    if (!account) return res.status(401).json({ error: 'Authentication required.' });
    if (account.role === 'STUDENT' ? !enrolledStudent(account.id, req.params.id) : !ownedStudent(account.id, req.params.id)) return res.status(403).json({ error: 'Access denied.' });
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
