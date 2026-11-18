import test from 'node:test';
import assert from 'node:assert/strict';
import { inferredRecoveredName, matchingRecoveredStudents } from '../services/recoveredStudents.ts';

const student = { id: 'old', name: 'Recovered student old', subject: 'Review imported record', ratePerClass: 0, phone: '', createdAt: '2026-01-01' };

test('only an unambiguous message label supplies an automatic match', () => {
  const messages = [
    { studentId: 'old', message: 'Test Result for Physics:\nMarks: 8/10' },
    { studentId: 'old', message: '📚 Test Result - Rafi Hasan\nScore: 8/10' },
    { studentId: 'old', message: '📚 Test Result - Rafi Hasan\nScore: 9/10' },
  ];
  assert.equal(inferredRecoveredName(student, messages), 'Rafi Hasan');
  assert.deepEqual(matchingRecoveredStudents('rafi   HASAN', [student], messages), [student]);
  assert.deepEqual(matchingRecoveredStudents('Rafi Hasan', [student, { ...student, id: 'active', name: 'Rafi Hasan', subject: 'Math', ratePerClass: 500 }], messages), []);
  assert.equal(inferredRecoveredName(student, [...messages, { studentId: 'old', message: '📚 Test Result - Another Student' }]), null);
});
