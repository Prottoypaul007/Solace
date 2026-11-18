import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackup, missingStudentReferences, parseBackup, recoverMissingStudents, restoreBackup, sameBackupData } from '../services/backup.ts';

const values = new Map();
globalThis.localStorage = {
  getItem: key => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key),
};

test('exports and restores every collection', () => {
  values.clear();
  values.set('tt_students', JSON.stringify([{ id: 's1', name: 'A', subject: 'Math', phone: '123', createdAt: '2026-01-01', ratePerClass: 500 }]));
  values.set('tt_classes', '[]');
  values.set('tt_payments', '[]');
  values.set('test_results', '[]');
  values.set('parent_contacts', '[]');
  values.set('communications', '[]');
  const backup = parseBackup(JSON.stringify(createBackup()));
  values.set('tt_students', '[]');
  restoreBackup(backup);
  assert.equal(JSON.parse(values.get('tt_students'))[0].name, 'A');
  assert.equal(backup.data.communications.length, 0);
});

test('rejects malformed backups before changing storage', () => {
  const before = new Map(values);
  assert.throws(() => parseBackup('{bad json'), /valid JSON/);
  assert.throws(() => parseBackup(JSON.stringify({ ...createBackup(), data: { students: [] } })), /classes records/);
  assert.deepEqual(values, before);
});

test('rolls back all collections if a write fails', () => {
  const backup = createBackup();
  const before = new Map(values);
  const originalSetItem = localStorage.setItem;
  let failed = false;
  localStorage.setItem = (key, value) => {
    if (key === 'tt_payments' && !failed) {
      failed = true;
      throw new Error('quota');
    }
    originalSetItem(key, value);
  };
  try {
    assert.throws(() => restoreBackup(backup), /existing data was kept/);
    assert.deepEqual(values, before);
  } finally {
    localStorage.setItem = originalSetItem;
  }
});

test('detects different device and server records before migration', () => {
  const phone = createBackup();
  const same = parseBackup(JSON.stringify(phone));
  assert.equal(sameBackupData(phone, same), true);
  const server = parseBackup(JSON.stringify({ ...phone, data: { ...phone.data, students: [] } }));
  assert.equal(sameBackupData(phone, server), false);
});

test('recovers missing student references without changing linked records', () => {
  const original = createBackup();
  const result = { id: 'test-1', studentId: 'missing-1', testName: 'Quiz', subject: 'Math', date: '2026-01-02', maxMarks: 10, obtainedMarks: 8, percentage: 80, sentToParent: false };
  original.data.testResults = [result];
  const missing = missingStudentReferences(original);
  assert.deepEqual(missing, [{ studentId: 'missing-1', counts: { testResults: 1 } }]);
  const repaired = recoverMissingStudents(original);
  assert.equal(repaired.data.students.length, original.data.students.length + 1);
  assert.equal(repaired.data.students.at(-1).id, 'missing-1');
  assert.equal(repaired.data.students.at(-1).ratePerClass, 0);
  assert.equal(repaired.data.students.at(-1).recovered, true);
  assert.deepEqual(repaired.data.testResults, [result]);
  assert.equal(original.data.students.some(item => item.id === 'missing-1'), false);
  assert.equal(recoverMissingStudents(repaired), repaired);
});
