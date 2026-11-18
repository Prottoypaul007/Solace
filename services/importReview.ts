import type { Student } from '../types';
import { AppBackup, parseBackup, recoverMissingStudents } from './backup';
import { isRecoveredStudent } from './recoveredStudents';

export interface ImportCorrection {
  name: string;
  subject: string;
  rate: string;
  phone: string;
}

export const applyImportCorrections = (backup: AppBackup, corrections: Record<string, ImportCorrection>): AppBackup => {
  const prepared = recoverMissingStudents(backup);
  const recovered = new Set(prepared.data.students.filter(record => isRecoveredStudent(record as unknown as Student)).map(record => record.id));
  for (const id of Object.keys(corrections)) {
    if (!recovered.has(id)) throw new Error('An imported student selection changed. Choose the backup file again.');
  }
  const students = prepared.data.students.map(record => {
    const correction = corrections[String(record.id)];
    if (!correction) return record;
    const name = correction.name.trim();
    const subject = correction.subject.trim();
    const ratePerClass = Number(correction.rate);
    if (!name || !subject || !correction.rate.trim() || !Number.isFinite(ratePerClass) || ratePerClass <= 0) {
      throw new Error('For each edited student, enter a name, subject, and rate greater than zero. Other imported records are still available.');
    }
    return { ...record, name, subject, ratePerClass, phone: correction.phone.trim(), recovered: false };
  });
  return parseBackup(JSON.stringify({ ...prepared, data: { ...prepared.data, students } }));
};
