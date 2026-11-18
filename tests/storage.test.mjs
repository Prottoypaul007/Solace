import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const bundled = await build({ entryPoints: ['services/storage.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const storage = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const values = new Map();
globalThis.localStorage = {
  getItem: key => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key),
};

test('balance survives a rate change and a deleted student can be restored', () => {
  values.clear();
  const student = { id: 's', name: 'Student', subject: 'Math', ratePerClass: 500, phone: '', createdAt: '2026-01-01' };
  storage.addStudent(student);
  storage.addClassSession({ id: 'c', studentId: 's', date: '2026-10-01', durationMinutes: 60 });
  storage.addPayment({ id: 'p', studentId: 's', date: '2026-10-02', amount: 200 });
  assert.equal(storage.getStudentBalance('s'), 300);
  storage.updateStudent({ ...student, ratePerClass: 700 });
  assert.equal(storage.getClassesByStudent('s')[0].rateCharged, 500);
  assert.equal(storage.getStudentBalance('s'), 300);
  const snapshot = storage.deleteStudent('s');
  assert.equal(storage.getStudents().length, 0);
  assert.equal(storage.getClasses().length, 0);
  storage.restoreStudent(snapshot);
  assert.equal(storage.getStudentBalance('s'), 300);
});
