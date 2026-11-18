import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundled = await build({ entryPoints: ['services/importReview.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { applyImportCorrections } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);

const raw = () => ({ app: 'solace', version: 1, exportedAt: '2026-11-19T00:00:00.000Z', data: {
  students: [], classes: [], payments: [],
  testResults: [{ id: 'test-1', studentId: 'old-id', testName: 'Quiz', subject: 'Physics', date: '2026-01-02', maxMarks: 10, obtainedMarks: 8, percentage: 80, sentToParent: false }],
  parentContacts: [], communications: [],
} });

test('backup import retains unmatched records for later review', () => {
  const source = raw();
  const prepared = applyImportCorrections(source, {});
  assert.equal(prepared.data.students.length, 1);
  assert.equal(prepared.data.students[0].id, 'old-id');
  assert.equal(prepared.data.students[0].recovered, true);
  assert.deepEqual(prepared.data.testResults, source.data.testResults);
  assert.equal(source.data.students.length, 0);
});

test('edited imported profile keeps its original ID and every linked record', () => {
  const source = raw();
  const prepared = applyImportCorrections(source, { 'old-id': { name: 'Rafi Hasan', subject: 'Physics', rate: '500', phone: '' } });
  assert.equal(prepared.data.students[0].id, 'old-id');
  assert.equal(prepared.data.students[0].name, 'Rafi Hasan');
  assert.equal(prepared.data.students[0].recovered, false);
  assert.deepEqual(prepared.data.testResults, source.data.testResults);
  assert.throws(() => applyImportCorrections(source, { 'old-id': { name: '', subject: 'Physics', rate: '500', phone: '' } }), /enter a name/);
  assert.equal(source.data.students.length, 0);
});
