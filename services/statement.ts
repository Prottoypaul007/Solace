import type { ClassSession, Payment, Student } from '../types';

export const calculateMonthlyStatement = (
  student: Student, classes: ClassSession[], payments: Payment[], month: string
) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Choose a valid month.');
  const monthClasses = classes.filter(item => item.date.slice(0, 7) === month);
  const monthPayments = payments.filter(item => item.date.slice(0, 7) === month);
  const previousClasses = classes.filter(item => item.date.slice(0, 7) < month);
  const previousPayments = payments.filter(item => item.date.slice(0, 7) < month);
  const openingBalance = previousClasses.reduce((sum, item) => sum + (item.rateCharged ?? student.ratePerClass), 0) - previousPayments.reduce((sum, item) => sum + item.amount, 0);
  const earned = monthClasses.reduce((sum, item) => sum + (item.rateCharged ?? student.ratePerClass), 0);
  const paid = monthPayments.reduce((sum, item) => sum + item.amount, 0);
  return { monthClasses, monthPayments, openingBalance, earned, paid, closingBalance: openingBalance + earned - paid };
};

const csvCell = (value: string | number) => {
  const safe = typeof value === 'string' && /^[=+@\-]/.test(value) ? `'${value}` : String(value);
  return `"${safe.replace(/"/g, '""')}"`;
};

export const statementCsv = (
  student: Student, month: string, statement: ReturnType<typeof calculateMonthlyStatement>
): string => {
  const rows: (string | number)[][] = [
    ['Student', student.name], ['Month', month], ['Rate per class', student.ratePerClass],
    ['Opening balance', statement.openingBalance], ['Classes', statement.monthClasses.length],
    ['Earned', statement.earned], ['Paid', statement.paid], ['Closing balance', statement.closingBalance],
    [], ['Date', 'Type', 'Details', 'Amount'],
    ...statement.monthClasses.map(item => [item.date.slice(0, 10), 'Class', item.topic || `${item.durationMinutes} minutes`, item.rateCharged ?? student.ratePerClass]),
    ...statement.monthPayments.map(item => [item.date.slice(0, 10), 'Payment', item.note || '', -item.amount]),
  ];
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
};
