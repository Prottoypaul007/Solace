import { Student, ClassSession, Payment } from '../types';

const KEYS = {
  STUDENTS: 'tt_students',
  CLASSES: 'tt_classes',
  PAYMENTS: 'tt_payments'
};

// Helpers
const getList = <T>(key: string): T[] => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error(`Error reading ${key}`, e);
    return [];
  }
};

const saveList = <T>(key: string, list: T[]): void => {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch (e) {
    console.error(`Error saving ${key}`, e);
  }
};

// Student Operations
export const getStudents = (): Student[] => getList<Student>(KEYS.STUDENTS);

export const addStudent = (student: Student): void => {
  const list = getStudents();
  list.push(student);
  saveList(KEYS.STUDENTS, list);
};

export const deleteStudent = (id: string): void => {
  const students = getStudents().filter(s => s.id !== id);
  saveList(KEYS.STUDENTS, students);
  
  // Cleanup related data
  const classes = getClasses().filter(c => c.studentId !== id);
  saveList(KEYS.CLASSES, classes);
  
  const payments = getPayments().filter(p => p.studentId !== id);
  saveList(KEYS.PAYMENTS, payments);
};

export const getStudentById = (id: string): Student | undefined => {
  return getStudents().find(s => s.id === id);
};

// Class Operations
export const getClasses = (): ClassSession[] => getList<ClassSession>(KEYS.CLASSES);

export const getClassesByStudent = (studentId: string): ClassSession[] => {
  return getClasses().filter(c => c.studentId === studentId);
};

export const addClassSession = (session: ClassSession): void => {
  const list = getClasses();
  list.push(session);
  saveList(KEYS.CLASSES, list);
};

// Payment Operations
export const getPayments = (): Payment[] => getList<Payment>(KEYS.PAYMENTS);

export const getPaymentsByStudent = (studentId: string): Payment[] => {
  return getPayments().filter(p => p.studentId === studentId);
};

export const addPayment = (payment: Payment): void => {
  const list = getPayments();
  list.push(payment);
  saveList(KEYS.PAYMENTS, list);
};

// Statistics
export const getStudentBalance = (studentId: string): number => {
  const student = getStudentById(studentId);
  if (!student) return 0;

  const classes = getClassesByStudent(studentId);
  const payments = getPaymentsByStudent(studentId);

  const totalEarned = classes.length * student.ratePerClass;
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  return totalEarned - totalPaid;
};