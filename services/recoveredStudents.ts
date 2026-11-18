import type { Communication, Student } from '../types';

const normalize = (name: string) => name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();

export const isRecoveredStudent = (student: Student): boolean =>
  student.recovered === true || (student.name.startsWith('Recovered student ') &&
    student.subject === 'Review imported record' && student.ratePerClass === 0);

export const inferredRecoveredName = (student: Student, messages: Communication[]): string | null => {
  if (!isRecoveredStudent(student)) return null;
  if (!student.name.startsWith('Recovered student ')) return student.name.trim() || null;
  const labels = new Map<string, string>();
  for (const message of messages) {
    if (message.studentId !== student.id) continue;
    const firstLine = message.message.split(/\r?\n/, 1)[0].trim();
    const match = firstLine.match(/^(?:📚\s*)?Test Result\s*-\s*(.+)$/iu);
    if (!match) continue;
    const label = match[1].trim();
    if (label) labels.set(normalize(label), label);
  }
  return labels.size === 1 ? [...labels.values()][0] : null;
};

export const matchingRecoveredStudents = (name: string, students: Student[], messages: Communication[]): Student[] => {
  const key = normalize(name);
  if (!key || students.some(student => !isRecoveredStudent(student) && normalize(student.name) === key)) return [];
  return students.filter(student => isRecoveredStudent(student) &&
    normalize(inferredRecoveredName(student, messages) || '') === key);
};
