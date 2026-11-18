import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateMonthlyStatement, statementCsv } from '../services/statement.ts';

const student = { id: 's', name: 'A, B', subject: 'Math', phone: '', ratePerClass: 500, createdAt: '2026-01-01' };
const classes = [
  { id: 'a', studentId: 's', date: '2026-09-15T12:00:00Z', durationMinutes: 60 },
  { id: 'b', studentId: 's', date: '2026-10-01T12:00:00Z', durationMinutes: 60, topic: 'Algebra' },
  { id: 'c', studentId: 's', date: '2026-10-20T12:00:00Z', durationMinutes: 90 },
];
const payments = [
  { id: 'p', studentId: 's', date: '2026-09-30T12:00:00Z', amount: 200 },
  { id: 'q', studentId: 's', date: '2026-10-25T12:00:00Z', amount: 600 },
];

test('monthly balance includes earlier balance and current month activity', () => {
  const statement = calculateMonthlyStatement(student, classes, payments, '2026-10');
  assert.equal(statement.openingBalance, 300);
  assert.equal(statement.earned, 1000);
  assert.equal(statement.paid, 600);
  assert.equal(statement.closingBalance, 700);
  const csv = statementCsv(student, '2026-10', statement);
  assert.match(csv, /"A, B"/);
  assert.match(csv, /"Closing balance","700"/);
});

test('CSV treats user-entered formulas as text', () => {
  const unsafeStudent = { ...student, name: '=HYPERLINK("x")' };
  const csv = statementCsv(unsafeStudent, '2026-10', calculateMonthlyStatement(unsafeStudent, classes, payments, '2026-10'));
  assert.match(csv, /"'=HYPERLINK\(""x""\)"/);
});
