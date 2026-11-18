import { Student, ClassSession, Payment, TestResult, ParentContact, Communication } from '../types';
import { DATA_KEYS, readList, writeBatch, writeList } from './dataStore';

export const getStudents = (): Student[] => readList<Student>(DATA_KEYS.students);
export const getStudentById = (id: string): Student | undefined => getStudents().find(student => student.id === id);
export const addStudent = (student: Student): void => writeList(DATA_KEYS.students, [...getStudents(), student]);
export const updateStudent = (student: Student): void => {
  const students = getStudents();
  const previous = students.find(item => item.id === student.id);
  if (!previous) throw new Error('Student not found.');
  const updatedStudents = students.map(item => item.id === student.id ? student : item);
  if (previous.ratePerClass !== student.ratePerClass) {
    const updatedClasses = getClasses().map(item => item.studentId === student.id && item.rateCharged === undefined
      ? { ...item, rateCharged: previous.ratePerClass } : item);
    writeBatch({ [DATA_KEYS.students]: updatedStudents, [DATA_KEYS.classes]: updatedClasses });
  } else {
    writeList(DATA_KEYS.students, updatedStudents);
  }
};

export interface StudentSnapshot {
  student: Student;
  classes: ClassSession[];
  payments: Payment[];
  testResults: TestResult[];
  parentContacts: ParentContact[];
  communications: Communication[];
}

export const getStudentSnapshot = (id: string): StudentSnapshot => {
  const student = getStudentById(id);
  if (!student) throw new Error('Student not found.');
  return {
    student,
    classes: getClassesByStudent(id),
    payments: getPaymentsByStudent(id),
    testResults: readList<TestResult>(DATA_KEYS.testResults).filter(item => item.studentId === id),
    parentContacts: readList<ParentContact>(DATA_KEYS.parentContacts).filter(item => item.studentId === id),
    communications: readList<Communication>(DATA_KEYS.communications).filter(item => item.studentId === id),
  };
};

export const deleteStudent = (id: string): StudentSnapshot => {
  const snapshot = getStudentSnapshot(id);
  writeBatch({
    [DATA_KEYS.students]: getStudents().filter(item => item.id !== id),
    [DATA_KEYS.classes]: getClasses().filter(item => item.studentId !== id),
    [DATA_KEYS.payments]: getPayments().filter(item => item.studentId !== id),
    [DATA_KEYS.testResults]: readList<TestResult>(DATA_KEYS.testResults).filter(item => item.studentId !== id),
    [DATA_KEYS.parentContacts]: readList<ParentContact>(DATA_KEYS.parentContacts).filter(item => item.studentId !== id),
    [DATA_KEYS.communications]: readList<Communication>(DATA_KEYS.communications).filter(item => item.studentId !== id),
  });
  return snapshot;
};

export const restoreStudent = (snapshot: StudentSnapshot): void => {
  const id = snapshot.student.id;
  if (getStudentById(id)) throw new Error('This student already exists.');
  writeBatch({
    [DATA_KEYS.students]: [...getStudents(), snapshot.student],
    [DATA_KEYS.classes]: [...getClasses(), ...snapshot.classes],
    [DATA_KEYS.payments]: [...getPayments(), ...snapshot.payments],
    [DATA_KEYS.testResults]: [...readList<TestResult>(DATA_KEYS.testResults), ...snapshot.testResults],
    [DATA_KEYS.parentContacts]: [...readList<ParentContact>(DATA_KEYS.parentContacts), ...snapshot.parentContacts],
    [DATA_KEYS.communications]: [...readList<Communication>(DATA_KEYS.communications), ...snapshot.communications],
  });
};

export const getClasses = (): ClassSession[] => readList<ClassSession>(DATA_KEYS.classes);
export const getClassesByStudent = (studentId: string): ClassSession[] => getClasses().filter(item => item.studentId === studentId);
export const addClassSession = (session: ClassSession): void =>
  writeList(DATA_KEYS.classes, [...getClasses(), { ...session, createdAt: session.createdAt ?? new Date().toISOString() }]);
export const sortStudentsByRecentClass = (students: Student[], classes: ClassSession[]): Student[] => {
  const recent = new Map<string, { loggedAt: number; classDate: number }>();
  for (const session of classes) {
    const previous = recent.get(session.studentId) ?? { loggedAt: 0, classDate: 0 };
    const loggedAt = Date.parse(session.createdAt || '') || 0;
    const classDate = Date.parse(session.date) || 0;
    recent.set(session.studentId, { loggedAt: Math.max(previous.loggedAt, loggedAt), classDate: Math.max(previous.classDate, classDate) });
  }
  return [...students].sort((a, b) => {
    const left = recent.get(a.id), right = recent.get(b.id);
    if (Boolean(left?.loggedAt) !== Boolean(right?.loggedAt)) return right?.loggedAt ? 1 : -1;
    const leftTime = left?.loggedAt || left?.classDate || Date.parse(a.createdAt) || 0;
    const rightTime = right?.loggedAt || right?.classDate || Date.parse(b.createdAt) || 0;
    return rightTime - leftTime || a.name.localeCompare(b.name);
  });
};
export const updateClassSession = (session: ClassSession): void => {
  const classes = getClasses();
  if (!classes.some(item => item.id === session.id)) throw new Error('Class not found.');
  writeList(DATA_KEYS.classes, classes.map(item => item.id === session.id ? session : item));
};
export const deleteClassSession = (id: string): void => writeList(DATA_KEYS.classes, getClasses().filter(item => item.id !== id));

export const getPayments = (): Payment[] => readList<Payment>(DATA_KEYS.payments);
export const getPaymentsByStudent = (studentId: string): Payment[] => getPayments().filter(item => item.studentId === studentId);
export const addPayment = (payment: Payment): void => writeList(DATA_KEYS.payments, [...getPayments(), payment]);
export const updatePayment = (payment: Payment): void => {
  const payments = getPayments();
  if (!payments.some(item => item.id === payment.id)) throw new Error('Payment not found.');
  writeList(DATA_KEYS.payments, payments.map(item => item.id === payment.id ? payment : item));
};
export const deletePayment = (id: string): void => writeList(DATA_KEYS.payments, getPayments().filter(item => item.id !== id));

export const getStudentBalance = (studentId: string): number => {
  const student = getStudentById(studentId);
  if (!student) return 0;
  return getClassesByStudent(studentId).reduce((sum, session) => sum + (session.rateCharged ?? student.ratePerClass), 0) -
    getPaymentsByStudent(studentId).reduce((sum, payment) => sum + payment.amount, 0);
};
