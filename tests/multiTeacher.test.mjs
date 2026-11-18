import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const dir = mkdtempSync(join(tmpdir(), 'solace-multi-teacher-'));
const port = 3118, base = `http://127.0.0.1:${port}`;
process.env.SOLACE_DATABASE_PATH = join(dir, 'test.sqlite');
process.env.BETTER_AUTH_SECRET = 'test-secret-only-for-automated-tests-123456789';
process.env.BETTER_AUTH_URL = base;
process.env.SOLACE_ALLOWED_ORIGINS = base;
process.env.SOLACE_APP_URL = base;
const { app } = await import('../server/app.mjs');
const { db } = await import('../server/db.mjs');
const server = app.listen(port);
const request = async (path, { method = 'GET', body, cookie } = {}) => {
  const response = await fetch(base + path, { method, headers: { origin: base, ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
};
const signIn = async (email, password) => (await request('/api/auth/sign-in/email', { method: 'POST', body: { email, password } })).cookie;
const tokenFrom = link => new URL(link.split('#')[1], base).searchParams.get('token');
const backup = (id, subject) => ({ app: 'solace', version: 1, exportedAt: new Date().toISOString(), data: {
  students: [{ id, name: 'Shared Student', subject, phone: '', ratePerClass: 10, createdAt: new Date().toISOString() }],
  classes: [{ id: `class-${id}`, studentId: id, date: new Date().toISOString(), durationMinutes: 60, topic: subject }],
  payments: [], testResults: [], parentContacts: [], communications: [],
} });

test('two teachers share one student login but keep records private', async () => {
  try {
    const setup = spawnSync(process.execPath, ['--experimental-strip-types', 'server/setup-tutor.mjs'], {
      cwd: process.cwd(), env: { ...process.env, SOLACE_SETUP_EMAIL: 'first@example.test', SOLACE_SETUP_PASSWORD: 'first-tutor-password-123' }, encoding: 'utf8',
    });
    assert.equal(setup.status, 0, setup.stderr);
    const first = await signIn('first@example.test', 'first-tutor-password-123');
    assert.equal((await request('/api/tutor/import', { method: 'POST', body: backup('first-student', 'Math'), cookie: first })).status, 200);
    const firstInvite = await request('/api/tutor/students/first-student/invite', { method: 'POST', body: { email: 'student@example.test' }, cookie: first });
    assert.equal(firstInvite.status, 200);
    assert.equal((await request('/api/public/activate', { method: 'POST', body: { token: tokenFrom(firstInvite.body.activationLink), password: 'student-password-123' } })).status, 200);
    const student = await signIn('student@example.test', 'student-password-123');

    const teacherInvite = await request('/api/tutor/teachers/invite', { method: 'POST', body: { email: 'second@example.test' }, cookie: first });
    assert.equal(teacherInvite.status, 200);
    assert.equal((await request('/api/public/activate-teacher', { method: 'POST', body: { token: tokenFrom(teacherInvite.body.activationLink), name: 'Second Teacher', password: 'second-tutor-password-123' } })).status, 200);
    const second = await signIn('second@example.test', 'second-tutor-password-123');
    assert.equal((await request('/api/tutor/import', { method: 'POST', body: backup('second-student', 'English'), cookie: second })).status, 200);
    const linkInvite = await request('/api/tutor/students/second-student/invite', { method: 'POST', body: { email: 'student@example.test' }, cookie: second });
    assert.equal(linkInvite.status, 200);
    const token = tokenFrom(linkInvite.body.activationLink);
    assert.equal((await request('/api/public/invitations/' + token)).body.kind, 'existing-student');
    assert.equal((await request('/api/student/invitations/' + token + '/accept', { method: 'POST', cookie: first })).status, 403);
    assert.equal((await request('/api/student/invitations/' + token + '/accept', { method: 'POST', cookie: student })).status, 200);

    const dashboard = await request('/api/student/dashboard', { cookie: student });
    assert.equal(dashboard.body.enrollments.length, 2);
    assert.deepEqual(new Set(dashboard.body.completedClasses.map(item => item.topic)), new Set(['Math', 'English']));
    assert.deepEqual((await request('/api/tutor/data', { cookie: first })).body.data.students.map(item => item.id), ['first-student']);
    assert.deepEqual((await request('/api/tutor/data', { cookie: second })).body.data.students.map(item => item.id), ['second-student']);
    assert.equal((await request('/api/students/second-student', { cookie: first })).status, 403);
    assert.equal((await request('/api/conversations/first-student/messages', { cookie: second })).status, 403);
    assert.deepEqual(new Set((await request('/api/conversations', { cookie: student })).body.map(item => item.teacherName)), new Set(['Tutor', 'Second Teacher']));
    assert.equal((await request('/api/conversations/second-student/messages', { method: 'POST', body: { body: 'Hello English teacher', clientNonce: randomUUID() }, cookie: student })).status, 200);
    assert.equal((await request('/api/conversations/second-student/messages', { cookie: second })).body.messages.length, 1);
    assert.equal((await request('/api/conversations/first-student/messages', { cookie: first })).body.messages.length, 0);
    assert.equal((await request('/api/scheduled-classes', { method: 'POST', body: { studentId: 'first-student', subject: 'Wrong', startAt: new Date(Date.now() + 86400000).toISOString() }, cookie: second })).status, 400);
    assert.equal((await request('/api/announcements', { method: 'POST', body: { title: 'Wrong', body: 'Wrong', studentIds: ['first-student'] }, cookie: second })).status, 400);
    assert.equal((await request('/api/homework', { method: 'POST', body: { title: 'Wrong', description: 'Wrong', studentIds: ['first-student'] }, cookie: second })).status, 400);
    const firstAnnouncement = await request('/api/announcements', { method: 'POST', body: { title: 'Math exam', body: 'Friday', studentIds: ['first-student'] }, cookie: first });
    const secondAnnouncement = await request('/api/announcements', { method: 'POST', body: { title: 'English exam', body: 'Monday', studentIds: ['second-student'] }, cookie: second });
    assert.equal(firstAnnouncement.status, 200);
    assert.equal(secondAnnouncement.status, 200);
    assert.deepEqual((await request('/api/announcements', { cookie: first })).body.map(item => item.title), ['Math exam']);
    assert.deepEqual((await request('/api/announcements', { cookie: second })).body.map(item => item.title), ['English exam']);
    assert.deepEqual(new Set((await request('/api/announcements', { cookie: student })).body.map(item => item.teacherName)), new Set(['Tutor', 'Second Teacher']));
    assert.equal((await request(`/api/announcements/${firstAnnouncement.body.id}`, { method: 'DELETE', cookie: second })).status, 404);
    const firstHomework = await request('/api/homework', { method: 'POST', body: { title: 'Math work', description: 'Solve', studentIds: ['first-student'] }, cookie: first });
    const secondHomework = await request('/api/homework', { method: 'POST', body: { title: 'English work', description: 'Read', studentIds: ['second-student'] }, cookie: second });
    assert.equal(firstHomework.status, 200);
    assert.equal(secondHomework.status, 200);
    assert.deepEqual((await request('/api/homework', { cookie: first })).body.map(item => item.title), ['Math work']);
    assert.deepEqual((await request('/api/homework', { cookie: second })).body.map(item => item.title), ['English work']);
    assert.equal((await request(`/api/homework/${firstHomework.body.id}`, { method: 'DELETE', cookie: second })).status, 404);
    assert.equal((await request('/api/notifications', { cookie: student })).body.filter(item => item.type === 'ANNOUNCEMENT').length, 2);
    const firstData = (await request('/api/tutor/data', { cookie: first })).body;
    firstData.data.students[0].subject = 'Advanced Math';
    assert.equal((await request('/api/tutor/data', { method: 'PUT', body: firstData, cookie: second })).status, 409);
    assert.equal((await request('/api/tutor/data', { cookie: first })).body.data.students[0].subject, 'Math');
    const secondData = (await request('/api/tutor/data', { cookie: second })).body;
    secondData.data.students[0].subject = 'Literature';
    assert.equal((await request('/api/tutor/data', { method: 'PUT', body: secondData, cookie: second })).status, 200);
    assert.equal((await request('/api/tutor/data', { cookie: first })).body.data.students[0].subject, 'Math');
    const secondAccount = db.prepare("SELECT id FROM access_account WHERE email='student@example.test'").get().id;
    assert.equal((await request(`/api/tutor/accounts/${secondAccount}/disable`, { method: 'POST', cookie: second })).status, 200);
    assert.equal((await request('/api/student/dashboard', { cookie: student })).body.enrollments.length, 1);
    assert.equal((await request('/api/conversations/second-student/messages', { cookie: student })).status, 403);
    assert.deepEqual((await request('/api/homework', { cookie: student })).body.map(item => item.title), ['Math work']);
    assert.deepEqual((await request('/api/announcements', { cookie: student })).body.map(item => item.title), ['Math exam']);
    assert.deepEqual((await request('/api/notifications', { cookie: student })).body.filter(item => item.type === 'ANNOUNCEMENT').map(item => item.teacherName), ['Tutor']);
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); db.close(); rmSync(dir, { recursive: true, force: true });
  }
});
