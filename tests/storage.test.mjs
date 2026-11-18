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

test('the student whose class was just logged moves to the top even for an older class date', () => {
  values.clear();
  const students = [
    { id: 'a', name: 'Ada', subject: 'Math', ratePerClass: 500, phone: '', createdAt: '2026-01-01' },
    { id: 'b', name: 'Bina', subject: 'Math', ratePerClass: 500, phone: '', createdAt: '2026-01-01' },
  ];
  students.forEach(storage.addStudent);
  values.set('tt_classes', JSON.stringify([{ id: 'old', studentId: 'a', date: '2026-11-18T12:00:00.000Z', durationMinutes: 60 }]));
  storage.addClassSession({ id: 'new', studentId: 'b', date: '2026-09-01T12:00:00.000Z', durationMinutes: 60 });
  assert.equal(storage.sortStudentsByRecentClass(storage.getStudents(), storage.getClasses())[0].id, 'b');
  storage.deleteClassSession('new');
  assert.equal(storage.sortStudentsByRecentClass(storage.getStudents(), storage.getClasses())[0].id, 'a');
});

test('editing a recovered student rate restores the value of imported classes', () => {
  values.clear();
  const student = { id: 'missing-1', name: 'Recovered student missing-', subject: 'Review imported record', phone: '', createdAt: '2026-01-01', ratePerClass: 0 };
  storage.addStudent(student);
  storage.addClassSession({ id: 'class-1', studentId: student.id, date: '2026-01-02', durationMinutes: 60 });
  storage.updateStudent({ ...student, name: 'Actual student', subject: 'Math', ratePerClass: 500 });
  assert.equal(storage.getStudentBalance(student.id), 500);
});

test('adding a uniquely matching student adopts imported records without changing their IDs', () => {
  values.clear();
  const recovered = { id: 'old-id', name: 'Recovered student old-id', subject: 'Review imported record', ratePerClass: 0, phone: '', createdAt: '2026-01-01', recovered: true };
  values.set('tt_students', JSON.stringify([recovered]));
  values.set('communications', JSON.stringify([{ id: 'message-1', studentId: 'old-id', message: '📚 Test Result - Rafi Hasan\nScore: 8/10' }]));
  values.set('test_results', JSON.stringify([{ id: 'test-1', studentId: 'old-id', testName: 'Quiz', subject: 'Math', date: '2026-01-02', maxMarks: 10, obtainedMarks: 8, percentage: 80, sentToParent: false }]));
  assert.equal(storage.getRecoveredMatches('  rafi   HASAN ').length, 1);
  const saved = storage.addStudent({ id: 'new-id', name: 'Rafi Hasan', subject: 'Math', ratePerClass: 500, phone: '', createdAt: '2026-11-19' });
  assert.equal(saved.merged, true);
  assert.equal(saved.student.id, 'old-id');
  assert.equal(storage.getStudents().length, 1);
  assert.equal(storage.getStudents()[0].recovered, false);
  assert.equal(JSON.parse(values.get('test_results'))[0].studentId, 'old-id');
  assert.equal(JSON.parse(values.get('communications'))[0].studentId, 'old-id');
});

test('ambiguous imported names stay separate when a student is added', () => {
  values.clear();
  const placeholders = ['old-a', 'old-b'].map(id => ({ id, name: `Recovered student ${id}`, subject: 'Review imported record', ratePerClass: 0, phone: '', createdAt: '2026-01-01', recovered: true }));
  values.set('tt_students', JSON.stringify(placeholders));
  values.set('communications', JSON.stringify(placeholders.map(student => ({ id: `message-${student.id}`, studentId: student.id, message: '📚 Test Result - Rafi Hasan\nScore: 8/10' }))));
  assert.equal(storage.getRecoveredMatches('Rafi Hasan').length, 2);
  const saved = storage.addStudent({ id: 'new-id', name: 'Rafi Hasan', subject: 'Math', ratePerClass: 500, phone: '', createdAt: '2026-11-19' });
  assert.equal(saved.merged, false);
  assert.equal(storage.getStudents().length, 3);
});
