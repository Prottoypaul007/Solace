import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const dir = mkdtempSync(join(tmpdir(), 'solace-communications-'));
const port = 3107, base = `http://127.0.0.1:${port}`;
process.env.SOLACE_DATABASE_PATH = join(dir, 'test.sqlite');
process.env.BETTER_AUTH_SECRET = 'test-secret-only-for-automated-tests-123456789';
process.env.BETTER_AUTH_URL = base;
process.env.SOLACE_ALLOWED_ORIGINS = base;
process.env.SOLACE_APP_URL = base;
const { app } = await import('../server/app.mjs');
const { db } = await import('../server/db.mjs');
const { runReminderCheck } = await import('../server/communications.mjs');
const server = app.listen(port);
const req = async (path, { method = 'GET', body, cookie } = {}) => {
  const response = await fetch(base + path, { method, headers: { origin: base, ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.arrayBuffer();
  return { status: response.status, body: json, cookie: response.headers.get('set-cookie')?.split(';')[0] };
};
const signIn = (email, password) => req('/api/auth/sign-in/email', { method: 'POST', body: { email, password } });
const activate = async (studentId, email, tutorCookie) => {
  const invite = await req(`/api/tutor/students/${studentId}/invite`, { method: 'POST', body: { email }, cookie: tutorCookie });
  assert.equal(invite.status, 200);
  const token = new URL(invite.body.activationLink.split('#')[1], base).searchParams.get('token');
  assert.equal((await req('/api/public/activate', { method: 'POST', body: { token, password: 'student-test-password-123' } })).status, 200);
  return (await signIn(email, 'student-test-password-123')).cookie;
};

test('messages, announcements, homework, files, notifications and reminders are private', async () => {
  try {
    const setup = spawnSync(process.execPath, ['--experimental-strip-types', 'server/setup-tutor.mjs'], {
      cwd: process.cwd(), env: { ...process.env, SOLACE_SETUP_EMAIL: 'tutor@example.test', SOLACE_SETUP_PASSWORD: 'tutor-test-password-123' }, encoding: 'utf8',
    });
    assert.equal(setup.status, 0);
    const tutor = (await signIn('tutor@example.test', 'tutor-test-password-123')).cookie;
    const stamp = new Date().toISOString();
    const backup = { app: 'solace', version: 1, exportedAt: stamp, data: {
      students: ['a','b'].map(id => ({ id, name: `Student ${id.toUpperCase()}`, subject: 'Math', phone: '', ratePerClass: 10, createdAt: stamp })),
      classes: [], payments: [], testResults: [], parentContacts: [], communications: [],
    } };
    assert.equal((await req('/api/tutor/import', { method: 'POST', body: backup, cookie: tutor })).status, 200);
    const a = await activate('a', 'a@example.test', tutor), b = await activate('b', 'b@example.test', tutor);
    const controller = new AbortController();
    const secondController = new AbortController();
    const stream = await fetch(base + '/api/events', { headers: { origin: base, cookie: a }, signal: controller.signal });
    const secondStream = await fetch(base + '/api/events', { headers: { origin: base, cookie: a }, signal: secondController.signal });
    assert.equal(stream.status, 200);
    const reader = stream.body.getReader();
    const secondReader = secondStream.body.getReader();
    assert.match(new TextDecoder().decode((await reader.read()).value), /connected/);
    assert.match(new TextDecoder().decode((await secondReader.read()).value), /connected/);
    const nonce = randomUUID();
    const sent = await req('/api/conversations/a/messages', { method: 'POST', body: { body: 'Hello A', clientNonce: nonce }, cookie: tutor });
    assert.equal(sent.status, 200);
    assert.match(new TextDecoder().decode((await reader.read()).value), /notification|message/);
    assert.match(new TextDecoder().decode((await secondReader.read()).value), /notification|message/);
    controller.abort(); secondController.abort();
    const repeat = await req('/api/conversations/a/messages', { method: 'POST', body: { body: 'Hello A', clientNonce: nonce }, cookie: tutor });
    assert.equal(repeat.body.id, sent.body.id);
    assert.equal((await req('/api/conversations/b/messages', { method: 'POST', body: { body: 'wrong', clientNonce: nonce }, cookie: tutor })).status, 409);
    assert.equal((await req('/api/conversations/a/messages', { cookie: b })).status, 403);
    assert.equal((await req('/api/conversations/b/messages', { method: 'POST', body: { body: 'private', clientNonce: randomUUID() }, cookie: a })).status, 403);
    assert.equal((await req('/api/conversations/a/messages', { cookie: a })).body.messages.length, 1);
    assert.deepEqual((await req('/api/conversations', { cookie: b })).body.map(item => item.studentId), ['b']);
    assert.equal((await req('/api/conversations', { cookie: a })).body[0].unreadCount, 1);
    assert.equal((await req('/api/conversations/a/read', { method: 'POST', cookie: b })).status, 403);
    assert.equal((await req('/api/conversations/a/read', { method: 'POST', cookie: a })).body.read, 1);
    assert.ok((await req('/api/conversations/a/messages', { cookie: tutor })).body.messages[0].readAt);
    const conversationId = db.prepare("SELECT id FROM conversation WHERE student_id='a'").get().id;
    const tutorAccountId = db.prepare("SELECT id FROM access_account WHERE role='TUTOR'").get().id;
    const insertMessage = db.prepare('INSERT INTO message(id,conversation_id,sender_account_id,client_nonce,body,created_at,read_at) VALUES(?,?,?,?,?,?,NULL)');
    for (let i = 1; i <= 55; i++) insertMessage.run(randomUUID(), conversationId, tutorAccountId, randomUUID(), `Older ${i}`, new Date(Date.now() - i * 1000).toISOString());
    const firstPage = await req('/api/conversations/a/messages?limit=50', { cookie: a });
    assert.equal(firstPage.body.messages.length, 50);
    assert.ok(firstPage.body.nextCursor);
    const secondPage = await req(`/api/conversations/a/messages?limit=50&before=${firstPage.body.nextCursor}`, { cookie: a });
    assert.equal(secondPage.body.messages.length, 6);
    const announced = await req('/api/announcements', { method: 'POST', cookie: tutor, body: { title: 'Exam', body: 'Friday', studentIds: ['a'] } });
    assert.equal(announced.status, 200);
    assert.equal((await req('/api/announcements', { method: 'POST', cookie: a, body: { title: 'Fake', body: 'Fake', studentIds: ['b'] } })).status, 403);
    assert.equal((await req('/api/announcements', { cookie: b })).body.length, 0);
    assert.equal((await req('/api/announcements', { cookie: a })).body.length, 1);
    assert.equal((await req(`/api/announcements/${announced.body.id}/read`, { method: 'POST', cookie: b })).body.read, false);
    assert.equal((await req(`/api/announcements/${announced.body.id}/read`, { method: 'POST', cookie: a })).body.read, true);
    assert.equal((await req(`/api/announcements/${announced.body.id}/readership`, { cookie: tutor })).body[0].studentId, 'a');
    assert.equal((await req(`/api/announcements/${announced.body.id}`, { method: 'PATCH', cookie: tutor, body: { title: 'Exam moved', body: 'Saturday', studentIds: ['b'] } })).status, 200);
    assert.equal((await req('/api/announcements', { cookie: a })).body.length, 0);
    assert.equal((await req('/api/announcements', { cookie: b })).body.length, 1);
    assert.equal((await req('/api/notifications', { cookie: a })).body.filter(item => item.type === 'ANNOUNCEMENT').length, 0);
    const homework = await req('/api/homework', { method: 'POST', cookie: tutor, body: { title: 'Chapter 5', description: 'Complete exercises', studentIds: ['a'] } });
    assert.equal(homework.status, 200);
    assert.equal((await req('/api/homework', { method: 'POST', cookie: a, body: { title: 'Fake', description: 'Fake', studentIds: ['b'] } })).status, 403);
    assert.equal((await req('/api/homework', { cookie: b })).body.length, 0);
    const bytes = Buffer.from('%PDF-1.4\nexample');
    const fileNonce = randomUUID();
    const upload = await req(`/api/homework/${homework.body.id}/attachments`, { method: 'POST', cookie: tutor, body: { name: 'sheet.pdf', mime: 'application/pdf', base64: bytes.toString('base64'), clientNonce: fileNonce } });
    assert.equal(upload.status, 200);
    assert.equal((await req(`/api/homework/${homework.body.id}/attachments`, { method: 'POST', cookie: tutor, body: { name: 'sheet.pdf', mime: 'application/pdf', base64: bytes.toString('base64'), clientNonce: fileNonce } })).body.id, upload.body.id);
    assert.equal((await req(`/api/homework/${homework.body.id}/attachments`, { method: 'POST', cookie: a, body: { name: 'sheet.pdf', mime: 'application/pdf', base64: bytes.toString('base64'), clientNonce: randomUUID() } })).status, 403);
    assert.equal((await req(`/api/homework/${homework.body.id}/attachments`, { method: 'POST', cookie: tutor, body: { name: 'bad.pdf', mime: 'application/pdf', base64: Buffer.from('not a PDF').toString('base64'), clientNonce: randomUUID() } })).status, 400);
    assert.equal((await req(`/api/homework/attachments/${upload.body.id}`, { cookie: b })).status, 403);
    const downloaded = await req(`/api/homework/attachments/${upload.body.id}`, { cookie: a });
    assert.equal(downloaded.status, 200);
    assert.ok(Buffer.from(downloaded.body).equals(bytes));
    assert.equal((await req(`/api/homework/${homework.body.id}/complete`, { method: 'POST', cookie: a })).status, 200);
    assert.ok((await req(`/api/homework/${homework.body.id}/completion`, { cookie: tutor })).body[0].completedAt);
    const startAt = new Date(Date.now() + 15 * 60_000).toISOString();
    const scheduled = await req('/api/scheduled-classes', { method: 'POST', cookie: tutor, body: { studentId: 'a', subject: 'Math', startAt, reminderMinutes: 30 } });
    assert.equal(scheduled.status, 200);
    assert.equal((await req('/api/tutor/data', { method: 'PUT', cookie: tutor, body: backup })).status, 200);
    assert.equal((await req('/api/scheduled-classes', { cookie: a })).body[0].id, scheduled.body.id);
    assert.equal(runReminderCheck(), 1);
    assert.equal(runReminderCheck(), 0);
    assert.equal((await req('/api/notifications', { cookie: b })).body.filter(item => item.type === 'CLASS_REMINDER').length, 0);
    assert.equal((await req('/api/notifications', { cookie: a })).body.filter(item => item.type === 'CLASS_REMINDER').length, 1);
    const later = new Date(Date.now() + 60 * 60_000).toISOString();
    assert.equal((await req(`/api/scheduled-classes/${scheduled.body.id}`, { method: 'PATCH', cookie: tutor, body: { startAt: later } })).status, 200);
    assert.equal((await req('/api/notifications', { cookie: a })).body.filter(item => item.type === 'CLASS_REMINDER').length, 0);
    assert.equal(runReminderCheck(), 0);
    assert.equal((await req(`/api/scheduled-classes/${scheduled.body.id}`, { method: 'DELETE', cookie: tutor })).status, 200);
    assert.equal(runReminderCheck(), 0);
    const accountB = db.prepare("SELECT id FROM access_account WHERE student_id='b'").get();
    const disabledStream = await fetch(base + '/api/events', { headers: { origin: base, cookie: b } });
    const disabledReader = disabledStream.body.getReader();
    await disabledReader.read();
    assert.equal((await req(`/api/tutor/accounts/${accountB.id}/disable`, { method: 'POST', cookie: tutor })).status, 200);
    assert.equal((await disabledReader.read()).done, true);
  } finally {
    await new Promise(resolve => server.close(resolve)); db.close(); rmSync(dir, { recursive: true, force: true });
  }
});
