import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = mkdtempSync(join(tmpdir(), 'solace-auth-'));
process.env.SOLACE_DATABASE_PATH = join(dir, 'test.sqlite');
process.env.BETTER_AUTH_SECRET = 'test-secret-only-for-automated-tests-123456789';
process.env.BETTER_AUTH_URL = 'http://127.0.0.1:3106';
process.env.SOLACE_ALLOWED_ORIGINS = 'http://127.0.0.1:3106';
process.env.SOLACE_APP_URL = 'http://127.0.0.1:3106';

const { app } = await import('../server/app.mjs');
const { db } = await import('../server/db.mjs');
const server = app.listen(3106);
const base = 'http://127.0.0.1:3106';
const request = async (path, { method = 'GET', body, cookie } = {}) => {
  const response = await fetch(base + path, { method, headers: {
    origin: base, ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}),
  }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json().catch(() => ({})), cookie: response.headers.get('set-cookie')?.split(';')[0] };
};
const signIn = async (email, password) => request('/api/auth/sign-in/email', { method: 'POST', body: { email, password } });

test('tutor setup, sessions, invitations, student isolation and revocation', async () => {
  try {
    const tutorEmail = 'tutor@example.test';
    const tutorPassword = 'safe-test-tutor-password';
    const now = new Date().toISOString();
    const setup = () => spawnSync(process.execPath, ['--experimental-strip-types', 'server/setup-tutor.mjs'], {
      cwd: process.cwd(), env: { ...process.env, SOLACE_SETUP_EMAIL: tutorEmail, SOLACE_SETUP_PASSWORD: tutorPassword }, encoding: 'utf8',
    });
    assert.equal(setup().status, 0);
    assert.notEqual(setup().status, 0);
    assert.equal((await request('/api/tutor/data')).status, 401);
    if (existsSync('dist/index.html')) {
      const landing = await fetch(base + '/');
      assert.equal(landing.status, 200);
      assert.match(await landing.text(), /<html/i);
    }
    assert.notEqual((await signIn(tutorEmail, 'wrong-password')).status, 200);
    const tutor = await signIn(tutorEmail, tutorPassword);
    assert.equal(tutor.status, 200);
    assert.ok(tutor.cookie);
    assert.equal((await request('/api/me', { cookie: tutor.cookie })).body.role, 'TUTOR');
    const backup = { app: 'solace', version: 1, exportedAt: now, data: {
      students: [
        { id: 'a', name: 'Student A', subject: 'Math', phone: '', ratePerClass: 10, createdAt: now },
        { id: 'b', name: 'Student B', subject: 'Science', phone: '', ratePerClass: 12, createdAt: now },
      ], classes: [{ id: 'class-a', studentId: 'a', date: now, durationMinutes: 60 }],
      payments: [], testResults: [], parentContacts: [], communications: [],
    } };
    assert.equal((await request('/api/tutor/import', { method: 'POST', body: backup, cookie: tutor.cookie })).status, 200);
    assert.equal((await request('/api/tutor/import', { method: 'POST', body: backup, cookie: tutor.cookie })).status, 409);
    assert.equal((await request('/api/tutor/data', { method: 'PUT', body: backup, cookie: tutor.cookie })).status, 200);
    const inviteA = await request('/api/tutor/students/a/invite', { method: 'POST', body: { email: 'a@example.test' }, cookie: tutor.cookie });
    assert.equal(inviteA.status, 200);
    const tokenA = new URL(inviteA.body.activationLink.split('#')[1], base).searchParams.get('token');
    assert.ok(tokenA);
    assert.equal((await request(`/api/public/invitations/${tokenA}`)).status, 200);
    const activation = await request('/api/public/activate', { method: 'POST', body: { token: tokenA, password: 'safe-test-student-password' } });
    assert.equal(activation.status, 200);
    assert.equal((await request('/api/public/activate', { method: 'POST', body: { token: tokenA, password: 'safe-test-student-password' } })).status, 400);
    const student = await signIn('a@example.test', 'safe-test-student-password');
    assert.equal(student.status, 200);
    assert.equal((await request('/api/student/dashboard', { cookie: student.cookie })).body.profile.id, 'a');
    assert.equal((await request('/api/students/b', { cookie: student.cookie })).status, 403);
    assert.equal((await request('/api/tutor/data', { cookie: student.cookie })).status, 403);
    assert.equal((await request('/api/tutor/data', { method: 'PUT', body: backup, cookie: student.cookie })).status, 403);
    const missingLinkedStudent = structuredClone(backup);
    missingLinkedStudent.data.students = missingLinkedStudent.data.students.filter(item => item.id !== 'a');
    missingLinkedStudent.data.classes = [];
    assert.equal((await request('/api/tutor/data', { method: 'PUT', body: missingLinkedStudent, cookie: tutor.cookie })).status, 409);
    const inviteB = await request('/api/tutor/students/b/invite', { method: 'POST', body: { email: 'b@example.test' }, cookie: tutor.cookie });
    const tokenB = new URL(inviteB.body.activationLink.split('#')[1], base).searchParams.get('token');
    const hash = db.prepare('SELECT token_hash FROM invitation WHERE used_at IS NULL').get().token_hash;
    db.prepare('UPDATE invitation SET expires_at = ? WHERE token_hash = ?').run('2000-01-01T00:00:00.000Z', hash);
    assert.equal((await request('/api/public/activate', { method: 'POST', body: { token: tokenB, password: 'safe-test-student-password' } })).status, 400);
    const account = db.prepare("SELECT id FROM access_account WHERE student_id = 'a'").get();
    assert.equal((await request(`/api/tutor/accounts/${account.id}/disable`, { method: 'POST', cookie: tutor.cookie })).status, 200);
    assert.equal((await request('/api/student/dashboard', { cookie: student.cookie })).status, 401);
    assert.equal((await request(`/api/tutor/accounts/${account.id}/reactivate`, { method: 'POST', cookie: tutor.cookie })).status, 200);
    const studentAgain = await signIn('a@example.test', 'safe-test-student-password');
    assert.equal(studentAgain.status, 200);
    assert.equal((await request('/api/auth/change-password', { method: 'POST', body: { currentPassword: 'safe-test-student-password', newPassword: 'new-safe-student-password' }, cookie: studentAgain.cookie })).status, 200);
    const changed = await signIn('a@example.test', 'new-safe-student-password');
    assert.equal(changed.status, 200);
    assert.equal((await request(`/api/tutor/accounts/${account.id}`, { method: 'PATCH', body: { email: 'a-new@example.test' }, cookie: tutor.cookie })).status, 200);
    assert.equal((await request('/api/student/dashboard', { cookie: changed.cookie })).status, 401);
    assert.equal((await request('/api/auth/sign-out', { method: 'POST', cookie: tutor.cookie })).status, 200);
    assert.equal((await request('/api/tutor/data', { cookie: tutor.cookie })).status, 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
