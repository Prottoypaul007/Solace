import { randomUUID } from 'node:crypto';
import { db, ownedStudent, enrolledStudent, tutorForStudent } from './db.mjs';

const now = () => new Date().toISOString();
const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max + 1) : '';
const validText = (value, max) => value.length > 0 && value.length <= max;
const validDate = value => typeof value === 'string' && !Number.isNaN(Date.parse(value)) && /(?:Z|[+-]\d\d:\d\d)$/.test(value);
const listeners = new Map();
const publish = (accountId, event) => {
  for (const res of listeners.get(accountId) || []) res.write(`data: ${JSON.stringify(event)}\n\n`);
};
export const disconnectAccount = accountId => { for (const res of listeners.get(accountId) || []) res.end(); listeners.delete(accountId); };
const accountForStudent = studentId => db.prepare(`SELECT a.id FROM student_enrollment e JOIN access_account a ON a.id=e.account_id
  WHERE e.student_id=? AND e.status='ACTIVE' AND a.role='STUDENT' AND a.status='ACTIVE'`).get(studentId)?.id;
const linkedAccountForStudent = studentId => db.prepare('SELECT account_id AS id FROM student_enrollment WHERE student_id=?').get(studentId)?.id;
const tutorAccount = studentId => tutorForStudent(studentId);
const addNotification = (accountId, type, resourceId, uniqueKey) => {
  if (!accountId) return;
  const result = db.prepare('INSERT OR IGNORE INTO notification(id,account_id,type,resource_id,created_at,read_at,unique_key) VALUES(?,?,?,?,?,NULL,?)')
    .run(randomUUID(), accountId, type, resourceId, now(), uniqueKey);
  if (result.changes) publish(accountId, { type: 'notification', resourceType: type, resourceId });
};
const studentExists = id => Boolean(db.prepare('SELECT 1 FROM students WHERE id = ?').get(id));
const notificationStudentId = (row, accountId) => {
  if (row.type === 'MESSAGE') return row.resourceId;
  if (row.type === 'ANNOUNCEMENT') return db.prepare(`SELECT r.student_id AS id FROM announcement_recipient r
    JOIN student_enrollment e ON e.student_id=r.student_id WHERE r.announcement_id=? AND e.account_id=? LIMIT 1`).get(row.resourceId, accountId)?.id;
  if (row.type === 'HOMEWORK') return db.prepare(`SELECT r.student_id AS id FROM homework_recipient r
    JOIN student_enrollment e ON e.student_id=r.student_id WHERE r.homework_id=? AND e.account_id=? LIMIT 1`).get(row.resourceId, accountId)?.id;
  if (row.type === 'CLASS_REMINDER') return db.prepare('SELECT student_id AS id FROM scheduled_class WHERE id=?').get(row.resourceId)?.id;
  return null;
};
const authorizedStudent = (account, studentId) => account.role === 'TUTOR'
  ? ownedStudent(account.id, studentId) : enrolledStudent(account.id, studentId);
const recipientIds = value => Array.isArray(value) ? [...new Set(value.filter(id => typeof id === 'string'))] : [];
const validateRecipients = (ids, tutorId) => ids.length > 0 && ids.length <= 500 && ids.every(id => ownedStudent(tutorId, id));

export function installCommunications(app, { accountFor, tutor, student }) {
  const anyAccount = async (req, res, next) => {
    try { req.account = await accountFor(req); if (!req.account) return res.status(401).json({ error: 'Authentication required.' }); next(); }
    catch (error) { next(error); }
  };
  app.get('/api/events', anyAccount, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const id = req.account.id;
    if (!listeners.has(id)) listeners.set(id, new Set());
    listeners.get(id).add(res);
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
    const heartbeat = setInterval(async () => {
      try {
        if (!await accountFor(req)) return res.end();
        res.write(': heartbeat\n\n');
      } catch { res.end(); }
    }, 25_000);
    req.on('close', () => { clearInterval(heartbeat); listeners.get(id)?.delete(res); if (!listeners.get(id)?.size) listeners.delete(id); });
  });

  app.get('/api/conversations', anyAccount, (req, res) => {
    const rows = db.prepare(`SELECT s.id AS studentId, json_extract(s.payload,'$.name') AS studentName,
      (SELECT u.name FROM access_account t JOIN user u ON u.id=t.user_id WHERE t.id=s.owner_tutor_id) AS teacherName,
      c.id AS conversationId,
      (SELECT body FROM message m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS latestMessage,
      (SELECT created_at FROM message m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS latestAt,
      (SELECT count(*) FROM message m WHERE m.conversation_id = c.id AND m.read_at IS NULL AND m.sender_account_id != ?) AS unreadCount
      FROM students s LEFT JOIN conversation c ON c.student_id = s.id
      ${req.account.role === 'STUDENT' ? "WHERE s.id IN (SELECT student_id FROM student_enrollment WHERE account_id=? AND status='ACTIVE')" : 'WHERE s.owner_tutor_id=?'}
      ORDER BY COALESCE(latestAt,'') DESC,studentName`).all(req.account.id, req.account.id);
    res.json(rows);
  });
  const conversationAccess = (req, res, next) => {
    if (!authorizedStudent(req.account, req.params.studentId)) return res.status(403).json({ error: 'Access denied.' });
    if (!studentExists(req.params.studentId)) return res.status(404).json({ error: 'Student not found.' });
    next();
  };
  app.get('/api/conversations/:studentId/messages', anyAccount, conversationAccess, (req, res) => {
    const conversation = db.prepare('SELECT id FROM conversation WHERE student_id = ?').get(req.params.studentId);
    if (!conversation) return res.json({ messages: [], nextCursor: null });
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const before = typeof req.query.before === 'string' ? db.prepare('SELECT created_at,id FROM message WHERE id = ? AND conversation_id = ?').get(req.query.before, conversation.id) : null;
    const rows = before
      ? db.prepare(`SELECT id,sender_account_id AS senderAccountId,body,created_at AS createdAt,read_at AS readAt FROM message
        WHERE conversation_id = ? AND (created_at < ? OR (created_at = ? AND id < ?)) ORDER BY created_at DESC,id DESC LIMIT ?`)
        .all(conversation.id, before.created_at, before.created_at, before.id, limit + 1)
      : db.prepare(`SELECT id,sender_account_id AS senderAccountId,body,created_at AS createdAt,read_at AS readAt FROM message
        WHERE conversation_id = ? ORDER BY created_at DESC,id DESC LIMIT ?`).all(conversation.id, limit + 1);
    res.json({ messages: rows.slice(0, limit).reverse(), nextCursor: rows.length > limit ? rows[limit - 1].id : null });
  });
  app.post('/api/conversations/:studentId/messages', anyAccount, conversationAccess, (req, res) => {
    const body = text(req.body?.body, 2000);
    const nonce = req.body?.clientNonce;
    if (!validText(body, 2000) || typeof nonce !== 'string' || !/^[0-9a-f-]{36}$/i.test(nonce)) return res.status(400).json({ error: 'Enter a message up to 2000 characters.' });
    const earlier = db.prepare(`SELECT m.id,m.sender_account_id AS senderAccountId,m.body,m.created_at AS createdAt,m.read_at AS readAt,c.student_id AS studentId
      FROM message m JOIN conversation c ON c.id=m.conversation_id WHERE m.sender_account_id=? AND m.client_nonce=?`).get(req.account.id, nonce);
    if (earlier) {
      if (earlier.studentId !== req.params.studentId) return res.status(409).json({ error: 'Message ID already used.' });
      const { studentId: _studentId, ...message } = earlier;
      return res.json(message);
    }
    let result;
    db.exec('BEGIN IMMEDIATE');
    try {
      const stamp = now();
      db.prepare('INSERT OR IGNORE INTO conversation(id,student_id,created_at) VALUES(?,?,?)').run(randomUUID(), req.params.studentId, stamp);
      const conversation = db.prepare('SELECT id FROM conversation WHERE student_id = ?').get(req.params.studentId);
      db.prepare('INSERT INTO message(id,conversation_id,sender_account_id,client_nonce,body,created_at,read_at) VALUES(?,?,?,?,?,?,NULL)')
        .run(randomUUID(), conversation.id, req.account.id, nonce, body, stamp);
      result = db.prepare('SELECT id,sender_account_id AS senderAccountId,body,created_at AS createdAt,read_at AS readAt FROM message WHERE sender_account_id = ? AND client_nonce = ?').get(req.account.id, nonce);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    const recipient = req.account.role === 'TUTOR' ? accountForStudent(req.params.studentId) : tutorAccount(req.params.studentId);
    addNotification(recipient, 'MESSAGE', req.params.studentId, `message:${result.id}`);
    publish(recipient, { type: 'message', studentId: req.params.studentId });
    publish(req.account.id, { type: 'message', studentId: req.params.studentId });
    res.json(result);
  });
  app.post('/api/conversations/:studentId/read', anyAccount, conversationAccess, (req, res) => {
    const conversation = db.prepare('SELECT id FROM conversation WHERE student_id = ?').get(req.params.studentId);
    if (!conversation) return res.json({ read: 0 });
    let result;
    db.exec('BEGIN IMMEDIATE');
    try {
      const stamp = now();
      result = db.prepare('UPDATE message SET read_at = ? WHERE conversation_id = ? AND sender_account_id != ? AND read_at IS NULL')
        .run(stamp, conversation.id, req.account.id);
      db.prepare("UPDATE notification SET read_at = ? WHERE account_id = ? AND type = 'MESSAGE' AND resource_id = ? AND read_at IS NULL")
        .run(stamp, req.account.id, req.params.studentId);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    const other = req.account.role === 'TUTOR' ? accountForStudent(req.params.studentId) : tutorAccount(req.params.studentId);
    if (result.changes) { publish(other, { type: 'read', studentId: req.params.studentId }); publish(req.account.id, { type: 'read', studentId: req.params.studentId }); }
    res.json({ read: result.changes });
  });

  app.get('/api/announcements', anyAccount, (req, res) => {
    const rows = req.account.role === 'TUTOR'
      ? db.prepare(`SELECT a.*, (SELECT count(*) FROM announcement_recipient r WHERE r.announcement_id=a.id) AS recipientCount,
        (SELECT count(*) FROM announcement_recipient r WHERE r.announcement_id=a.id AND r.read_at IS NOT NULL) AS readCount
        FROM announcement a WHERE a.deleted_at IS NULL AND a.owner_tutor_id=? ORDER BY a.created_at DESC`).all(req.account.id)
      : db.prepare(`SELECT a.*,r.student_id AS studentId,r.read_at AS readAt,u.name AS teacherName FROM announcement a JOIN announcement_recipient r ON r.announcement_id=a.id
        JOIN access_account t ON t.id=a.owner_tutor_id JOIN user u ON u.id=t.user_id
        JOIN student_enrollment e ON e.student_id=r.student_id WHERE e.account_id=? AND e.status='ACTIVE'
        AND a.deleted_at IS NULL ORDER BY a.created_at DESC`).all(req.account.id);
    res.json(rows);
  });
  app.get('/api/announcements/:id/readership', tutor, (req, res) => {
    const rows = db.prepare(`SELECT r.student_id AS studentId, json_extract(s.payload,'$.name') AS studentName,r.read_at AS readAt
      FROM announcement_recipient r JOIN students s ON s.id=r.student_id JOIN announcement a ON a.id=r.announcement_id
      WHERE r.announcement_id=? AND a.owner_tutor_id=? ORDER BY studentName`).all(req.params.id, req.account.id);
    res.json(rows);
  });
  const saveAnnouncement = (req, res, existing) => {
    const title = text(req.body?.title, 120), body = text(req.body?.body, 5000);
    const ids = recipientIds(req.body?.studentIds);
    if (!validText(title, 120) || !validText(body, 5000) || !validateRecipients(ids, req.account.id)) return res.status(400).json({ error: 'Enter a title, description, and valid students.' });
    const id = existing?.id || randomUUID(), stamp = now();
    db.exec('BEGIN IMMEDIATE');
    try {
      if (existing) db.prepare('UPDATE announcement SET title=?,body=?,updated_at=? WHERE id=?').run(title, body, stamp, id);
      else db.prepare('INSERT INTO announcement(id,title,body,owner_tutor_id,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,NULL)').run(id, title, body, req.account.id, stamp, stamp);
      const old = new Set(db.prepare('SELECT student_id FROM announcement_recipient WHERE announcement_id=?').all(id).map(row => row.student_id));
      for (const studentId of old) if (!ids.includes(studentId)) {
        db.prepare('DELETE FROM announcement_recipient WHERE announcement_id=? AND student_id=?').run(id, studentId);
        const accountId = linkedAccountForStudent(studentId);
        if (accountId) db.prepare("DELETE FROM notification WHERE account_id=? AND type='ANNOUNCEMENT' AND resource_id=?").run(accountId, id);
      }
      for (const studentId of ids) db.prepare('INSERT OR IGNORE INTO announcement_recipient(announcement_id,student_id,read_at) VALUES(?,?,NULL)').run(id, studentId);
      db.exec('COMMIT');
      for (const studentId of ids) if (!old.has(studentId) || !existing) addNotification(accountForStudent(studentId), 'ANNOUNCEMENT', id, `announcement:${id}:${studentId}`);
      for (const studentId of new Set([...old, ...ids])) publish(accountForStudent(studentId), { type: 'announcement', id });
      res.json({ id });
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  app.post('/api/announcements', tutor, (req, res) => saveAnnouncement(req, res));
  app.patch('/api/announcements/:id', tutor, (req, res) => {
    const row = db.prepare('SELECT id FROM announcement WHERE id=? AND owner_tutor_id=? AND deleted_at IS NULL').get(req.params.id, req.account.id);
    if (!row) return res.status(404).json({ error: 'Announcement not found.' });
    saveAnnouncement(req, res, row);
  });
  app.delete('/api/announcements/:id', tutor, (req, res) => {
    const result = db.prepare('UPDATE announcement SET deleted_at=? WHERE id=? AND owner_tutor_id=? AND deleted_at IS NULL').run(now(), req.params.id, req.account.id);
    if (result.changes) db.prepare("DELETE FROM notification WHERE type='ANNOUNCEMENT' AND resource_id=?").run(req.params.id);
    if (result.changes) for (const row of db.prepare('SELECT student_id FROM announcement_recipient WHERE announcement_id=?').all(req.params.id)) publish(accountForStudent(row.student_id), { type: 'announcement', id: req.params.id });
    res.status(result.changes ? 200 : 404).json(result.changes ? { deleted: true } : { error: 'Announcement not found.' });
  });
  app.post('/api/announcements/:id/read', student, (req, res) => {
    const studentId = db.prepare(`SELECT r.student_id AS id FROM announcement_recipient r JOIN student_enrollment e ON e.student_id=r.student_id
      WHERE r.announcement_id=? AND e.account_id=? AND e.status='ACTIVE'`).get(req.params.id, req.account.id)?.id;
    if (!studentId) return res.json({ read: false });
    const result = db.prepare(`UPDATE announcement_recipient SET read_at=? WHERE announcement_id=? AND student_id=? AND read_at IS NULL
      AND EXISTS(SELECT 1 FROM announcement WHERE id=? AND deleted_at IS NULL)`).run(now(), req.params.id, studentId, req.params.id);
    if (result.changes) publish(tutorAccount(studentId), { type: 'announcement-read', id: req.params.id });
    res.json({ read: Boolean(result.changes) });
  });

  app.get('/api/homework', anyAccount, (req, res) => {
    const rows = req.account.role === 'TUTOR'
      ? db.prepare(`SELECT h.*, (SELECT count(*) FROM homework_recipient r WHERE r.homework_id=h.id) AS recipientCount,
        (SELECT count(*) FROM homework_recipient r WHERE r.homework_id=h.id AND r.completed_at IS NOT NULL) AS completedCount
        FROM homework h WHERE h.deleted_at IS NULL AND h.owner_tutor_id=? ORDER BY h.created_at DESC`).all(req.account.id)
      : db.prepare(`SELECT h.*,r.student_id AS studentId,r.completed_at AS completedAt,u.name AS teacherName FROM homework h JOIN homework_recipient r ON r.homework_id=h.id
        JOIN access_account t ON t.id=h.owner_tutor_id JOIN user u ON u.id=t.user_id
        JOIN student_enrollment e ON e.student_id=r.student_id WHERE e.account_id=? AND e.status='ACTIVE'
        AND h.deleted_at IS NULL ORDER BY h.created_at DESC`).all(req.account.id);
    res.json(rows.map(row => ({ ...row, attachments: db.prepare('SELECT id,name,mime,size FROM homework_attachment WHERE homework_id=?').all(row.id) })));
  });
  app.get('/api/homework/:id/completion', tutor, (req, res) => {
    res.json(db.prepare(`SELECT r.student_id AS studentId,json_extract(s.payload,'$.name') AS studentName,r.completed_at AS completedAt
      FROM homework_recipient r JOIN students s ON s.id=r.student_id JOIN homework h ON h.id=r.homework_id
      WHERE r.homework_id=? AND h.owner_tutor_id=? ORDER BY studentName`).all(req.params.id, req.account.id));
  });
  const saveHomework = (req, res, existing) => {
    const title = text(req.body?.title, 120), description = text(req.body?.description, 10000);
    const ids = recipientIds(req.body?.studentIds), deadline = req.body?.deadline || null, classId = req.body?.classId || null;
    if (!validText(title, 120) || !validText(description, 10000) || !validateRecipients(ids, req.account.id) ||
      (deadline && !validDate(deadline)) || (classId && !db.prepare(`SELECT 1 FROM scheduled_class c JOIN students s ON s.id=c.student_id
        WHERE c.id=? AND c.status='SCHEDULED' AND s.owner_tutor_id=?`).get(classId, req.account.id))) {
      return res.status(400).json({ error: 'Enter valid homework details and recipients.' });
    }
    if (classId) {
      const classStudent = db.prepare('SELECT student_id FROM scheduled_class WHERE id=?').get(classId).student_id;
      if (!ids.includes(classStudent)) return res.status(400).json({ error: 'The class student must be a homework recipient.' });
    }
    const id = existing?.id || randomUUID(), stamp = now();
    db.exec('BEGIN IMMEDIATE');
    try {
      if (existing) db.prepare('UPDATE homework SET title=?,description=?,class_id=?,deadline=?,updated_at=? WHERE id=?').run(title, description, classId, deadline, stamp, id);
      else db.prepare('INSERT INTO homework(id,title,description,class_id,deadline,owner_tutor_id,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,?,NULL)')
        .run(id, title, description, classId, deadline, req.account.id, stamp, stamp);
      const old = new Set(db.prepare('SELECT student_id FROM homework_recipient WHERE homework_id=?').all(id).map(row => row.student_id));
      for (const studentId of old) if (!ids.includes(studentId)) {
        db.prepare('DELETE FROM homework_recipient WHERE homework_id=? AND student_id=?').run(id, studentId);
        const accountId = linkedAccountForStudent(studentId);
        if (accountId) db.prepare("DELETE FROM notification WHERE account_id=? AND type='HOMEWORK' AND resource_id=?").run(accountId, id);
      }
      for (const studentId of ids) db.prepare('INSERT OR IGNORE INTO homework_recipient(homework_id,student_id,completed_at) VALUES(?,?,NULL)').run(id, studentId);
      db.exec('COMMIT');
      for (const studentId of ids) if (!old.has(studentId) || !existing) addNotification(accountForStudent(studentId), 'HOMEWORK', id, `homework:${id}:${studentId}`);
      for (const studentId of new Set([...old, ...ids])) publish(accountForStudent(studentId), { type: 'homework', id });
      res.json({ id });
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  app.post('/api/homework', tutor, (req, res) => saveHomework(req, res));
  app.patch('/api/homework/:id', tutor, (req, res) => {
    const row = db.prepare('SELECT id FROM homework WHERE id=? AND owner_tutor_id=? AND deleted_at IS NULL').get(req.params.id, req.account.id);
    if (!row) return res.status(404).json({ error: 'Homework not found.' });
    saveHomework(req, res, row);
  });
  app.delete('/api/homework/:id', tutor, (req, res) => {
    const result = db.prepare('UPDATE homework SET deleted_at=? WHERE id=? AND owner_tutor_id=? AND deleted_at IS NULL').run(now(), req.params.id, req.account.id);
    if (result.changes) db.prepare("DELETE FROM notification WHERE type='HOMEWORK' AND resource_id=?").run(req.params.id);
    if (result.changes) for (const row of db.prepare('SELECT student_id FROM homework_recipient WHERE homework_id=?').all(req.params.id)) publish(accountForStudent(row.student_id), { type: 'homework', id: req.params.id });
    res.status(result.changes ? 200 : 404).json(result.changes ? { deleted: true } : { error: 'Homework not found.' });
  });
  app.post('/api/homework/:id/complete', student, (req, res) => {
    const row = db.prepare(`SELECT r.student_id FROM homework_recipient r JOIN homework h ON h.id=r.homework_id
      JOIN student_enrollment e ON e.student_id=r.student_id WHERE r.homework_id=? AND e.account_id=?
      AND e.status='ACTIVE' AND h.deleted_at IS NULL`).get(req.params.id, req.account.id);
    if (!row) return res.status(404).json({ error: 'Homework not found.' });
    db.prepare('UPDATE homework_recipient SET completed_at=COALESCE(completed_at,?) WHERE homework_id=? AND student_id=?')
      .run(now(), req.params.id, row.student_id);
    publish(tutorAccount(row.student_id), { type: 'homework-complete', id: req.params.id });
    res.json({ completed: true });
  });
  app.post('/api/homework/:id/attachments', tutor, (req, res) => {
    const homework = db.prepare('SELECT id FROM homework WHERE id=? AND owner_tutor_id=? AND deleted_at IS NULL').get(req.params.id, req.account.id);
    if (!homework) return res.status(404).json({ error: 'Homework not found.' });
    const { name, mime, base64, clientNonce } = req.body || {};
    if (typeof name !== 'string' || !validText(name.trim(), 160) || typeof base64 !== 'string' || base64.length > 7_000_000 || typeof clientNonce !== 'string' || !/^[0-9a-f-]{36}$/i.test(clientNonce)) return res.status(400).json({ error: 'Invalid attachment.' });
    const bytes = Buffer.from(base64, 'base64');
    const formats = {
      'application/pdf': bytes.subarray(0, 5).toString() === '%PDF-',
      'image/png': bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
      'image/jpeg': bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    };
    if (!formats[mime] || bytes.length === 0 || bytes.length > 5_000_000) return res.status(400).json({ error: 'Only PDF, PNG, or JPG up to 5 MB is allowed.' });
    const id = randomUUID();
    db.prepare('INSERT OR IGNORE INTO homework_attachment(id,homework_id,name,mime,size,bytes,client_nonce) VALUES(?,?,?,?,?,?,?)')
      .run(id, req.params.id, name.replace(/[\\/\r\n]/g, '_'), mime, bytes.length, bytes, clientNonce);
    for (const row of db.prepare('SELECT student_id FROM homework_recipient WHERE homework_id=?').all(req.params.id)) publish(accountForStudent(row.student_id), { type: 'homework', id: req.params.id });
    res.json({ id: db.prepare('SELECT id FROM homework_attachment WHERE homework_id=? AND client_nonce=?').get(req.params.id, clientNonce).id });
  });
  app.get('/api/homework/attachments/:id', anyAccount, (req, res) => {
    const file = db.prepare(`SELECT a.*,h.deleted_at FROM homework_attachment a JOIN homework h ON h.id=a.homework_id WHERE a.id=?`).get(req.params.id);
    if (!file || file.deleted_at) return res.status(404).json({ error: 'Attachment not found.' });
    const fileAllowed = req.account.role === 'TUTOR'
      ? db.prepare('SELECT 1 FROM homework WHERE id=? AND owner_tutor_id=?').get(file.homework_id, req.account.id)
      : db.prepare(`SELECT 1 FROM homework_recipient r JOIN student_enrollment e ON e.student_id=r.student_id
        WHERE r.homework_id=? AND e.account_id=? AND e.status='ACTIVE'`).get(file.homework_id, req.account.id);
    if (!fileAllowed) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Disposition', 'attachment; filename="download"');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.bytes);
  });

  app.get('/api/notifications', anyAccount, (req, res) => {
    const rows = db.prepare('SELECT id,type,resource_id AS resourceId,created_at AS createdAt,read_at AS readAt FROM notification WHERE account_id=? ORDER BY created_at DESC LIMIT 100').all(req.account.id);
    res.json(rows.map(row => {
      const studentId = notificationStudentId(row, req.account.id);
      const teacherName = studentId ? db.prepare(`SELECT u.name FROM students s JOIN access_account t ON t.id=s.owner_tutor_id
        JOIN user u ON u.id=t.user_id WHERE s.id=?`).get(studentId)?.name : null;
      return { ...row, studentId, teacherName };
    }).filter(row => req.account.role === 'STUDENT' ? Boolean(row.studentId && authorizedStudent(req.account, row.studentId))
      : !row.studentId || authorizedStudent(req.account, row.studentId)));
  });
  app.post('/api/notifications/:id/read', anyAccount, (req, res) => {
    const notice = db.prepare('SELECT type,resource_id AS resourceId FROM notification WHERE id=? AND account_id=?').get(req.params.id, req.account.id);
    if (!notice || (notificationStudentId(notice, req.account.id) && !authorizedStudent(req.account, notificationStudentId(notice, req.account.id)))) return res.status(404).json({ error: 'Notification not found.' });
    const result = db.prepare('UPDATE notification SET read_at=COALESCE(read_at,?) WHERE id=? AND account_id=?').run(now(), req.params.id, req.account.id);
    if (result.changes) publish(req.account.id, { type: 'notification-read', id: req.params.id });
    res.status(result.changes ? 200 : 404).json(result.changes ? { read: true } : { error: 'Notification not found.' });
  });

  app.get('/api/scheduled-classes', anyAccount, (req, res) => {
    const rows = req.account.role === 'TUTOR'
      ? db.prepare("SELECT c.*,json_extract(s.payload,'$.name') AS studentName FROM scheduled_class c JOIN students s ON s.id=c.student_id WHERE s.owner_tutor_id=? AND c.status='SCHEDULED' ORDER BY c.start_at").all(req.account.id)
      : db.prepare(`SELECT c.*,json_extract(s.payload,'$.name') AS studentName,u.name AS teacherName FROM scheduled_class c
        JOIN students s ON s.id=c.student_id JOIN student_enrollment e ON e.student_id=s.id
        JOIN access_account t ON t.id=s.owner_tutor_id JOIN user u ON u.id=t.user_id
        WHERE e.account_id=? AND e.status='ACTIVE' AND c.status='SCHEDULED' ORDER BY c.start_at`).all(req.account.id);
    res.json(rows);
  });
  app.post('/api/scheduled-classes', tutor, (req, res) => {
    const studentId = req.body?.studentId, subject = text(req.body?.subject, 120), startAt = req.body?.startAt;
    const minutes = Number(req.body?.reminderMinutes ?? 30);
    if (!ownedStudent(req.account.id, studentId) || !validText(subject, 120) || !validDate(startAt) || Date.parse(startAt) <= Date.now() || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
      return res.status(400).json({ error: 'Enter a future class time, student, subject, and reminder offset.' });
    }
    const id = randomUUID(), stamp = now();
    db.prepare("INSERT INTO scheduled_class(id,student_id,start_at,subject,status,reminder_minutes,created_at,updated_at) VALUES(?,?,?,?,'SCHEDULED',?,?,?)")
      .run(id, studentId, new Date(startAt).toISOString(), subject, minutes, stamp, stamp);
    publish(accountForStudent(studentId), { type: 'schedule', id });
    res.json({ id });
  });
  app.patch('/api/scheduled-classes/:id', tutor, (req, res) => {
    const prior = db.prepare('SELECT * FROM scheduled_class WHERE id=?').get(req.params.id);
    if (!prior || !ownedStudent(req.account.id, prior.student_id)) return res.status(404).json({ error: 'Class not found.' });
    const subject = text(req.body?.subject ?? prior.subject, 120), startAt = req.body?.startAt ?? prior.start_at;
    const minutes = Number(req.body?.reminderMinutes ?? prior.reminder_minutes);
    if (!validText(subject, 120) || !validDate(startAt) || Date.parse(startAt) <= Date.now() || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440) return res.status(400).json({ error: 'Enter a valid future class time.' });
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE scheduled_class SET subject=?,start_at=?,reminder_minutes=?,status=?,updated_at=? WHERE id=?')
        .run(subject, new Date(startAt).toISOString(), minutes, 'SCHEDULED', now(), prior.id);
      db.prepare('DELETE FROM reminder_occurrence WHERE scheduled_class_id=?').run(prior.id);
      db.prepare("DELETE FROM notification WHERE type='CLASS_REMINDER' AND resource_id=?").run(prior.id);
      db.exec('COMMIT');
      publish(accountForStudent(prior.student_id), { type: 'schedule', id: prior.id });
      res.json({ updated: true });
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  });
  app.delete('/api/scheduled-classes/:id', tutor, (req, res) => {
    const prior = db.prepare('SELECT student_id FROM scheduled_class WHERE id=?').get(req.params.id);
    if (!prior || !ownedStudent(req.account.id, prior.student_id)) return res.status(404).json({ error: 'Class not found.' });
    let result;
    db.exec('BEGIN IMMEDIATE');
    try {
      result = db.prepare("UPDATE scheduled_class SET status='CANCELLED',updated_at=? WHERE id=? AND status='SCHEDULED'").run(now(), req.params.id);
      if (result.changes) {
        db.prepare('DELETE FROM reminder_occurrence WHERE scheduled_class_id=?').run(req.params.id);
        db.prepare("DELETE FROM notification WHERE type='CLASS_REMINDER' AND resource_id=?").run(req.params.id);
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    if (!result.changes) return res.status(404).json({ error: 'Class not found.' });
    const studentId = db.prepare('SELECT student_id FROM scheduled_class WHERE id=?').get(req.params.id)?.student_id;
    publish(accountForStudent(studentId), { type: 'schedule', id: req.params.id });
    res.json({ cancelled: true });
  });
}

export function runReminderCheck(at = Date.now()) {
  const rows = db.prepare("SELECT * FROM scheduled_class WHERE status='SCHEDULED' AND start_at > ? AND start_at <= ?")
    .all(new Date(at).toISOString(), new Date(at + 1440 * 60_000).toISOString());
  let generated = 0;
  for (const row of rows) {
    if (at < Date.parse(row.start_at) - row.reminder_minutes * 60_000) continue;
    const accountId = accountForStudent(row.student_id);
    if (!accountId) continue;
    db.exec('BEGIN IMMEDIATE');
    try {
      const inserted = db.prepare('INSERT OR IGNORE INTO reminder_occurrence(scheduled_class_id,start_at,reminder_minutes,generated_at) VALUES(?,?,?,?)')
        .run(row.id, row.start_at, row.reminder_minutes, now());
      if (inserted.changes) {
        db.prepare('INSERT INTO notification(id,account_id,type,resource_id,created_at,read_at,unique_key) VALUES(?,?,?,?,?,NULL,?)')
          .run(randomUUID(), accountId, 'CLASS_REMINDER', row.id, now(), `reminder:${row.id}:${row.start_at}:${row.reminder_minutes}`);
        generated += 1;
      }
      db.exec('COMMIT');
      if (inserted.changes) publish(accountId, { type: 'notification', resourceType: 'CLASS_REMINDER', resourceId: row.id });
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  return generated;
}
