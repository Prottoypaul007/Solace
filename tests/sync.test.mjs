import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const bundled = await build({ entryPoints: ['services/sync.ts'], bundle: true, write: false, platform: 'browser', format: 'esm', define: { 'import.meta.env.VITE_API_URL': '"http://test.local"' } });
const sync = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const values = new Map();
globalThis.window = { dispatchEvent() {} };
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key),
};
const student = { id: 'phone-student', name: 'Phone student', subject: 'Math', phone: '', ratePerClass: 100, createdAt: '2026-01-01' };
const backup = students => ({ app: 'solace', version: 1, exportedAt: new Date().toISOString(), data: { students, classes: [], payments: [], testResults: [], parentContacts: [], communications: [] } });

test('a server conflict leaves the phone records untouched', async () => {
  values.clear();
  values.set('tt_students', JSON.stringify([student]));
  values.set('solace_pending_sync', '1');
  const remote = backup([{ ...student, id: 'server-student', name: 'Server student' }]);
  const previousFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, method: options.method || 'GET' });
    return new Response(JSON.stringify(remote), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    await assert.rejects(sync.loadTutorData(), error => error instanceof sync.DataConflictError);
    assert.deepEqual(JSON.parse(values.get('tt_students')), [student]);
    assert.equal(values.get('solace_pending_sync'), '1');
    assert.deepEqual(requests.map(item => item.method), ['GET']);
  } finally { globalThis.fetch = previousFetch; }
});

test('repair keeps the new student and the imported test result while saving', async () => {
  values.clear();
  values.set('tt_students', JSON.stringify([student]));
  const result = { id: 'test-1', studentId: 'missing-1', testName: 'Quiz', subject: 'Math', date: '2026-01-02', maxMarks: 10, obtainedMarks: 8, percentage: 80, sentToParent: false };
  values.set('test_results', JSON.stringify([result]));
  const previousFetch = globalThis.fetch;
  let saved;
  globalThis.fetch = async (_url, options = {}) => {
    saved = JSON.parse(options.body);
    return new Response(JSON.stringify({ saved: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    assert.equal(await sync.repairImportedRecords(), 1);
    assert.deepEqual(saved.data.testResults, [result]);
    assert.deepEqual(new Set(saved.data.students.map(item => item.id)), new Set(['phone-student', 'missing-1']));
    assert.equal(values.get('solace_pending_sync'), undefined);
  } finally { globalThis.fetch = previousFetch; }
});
