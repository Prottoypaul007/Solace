import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { missingStudentReferences, parseBackup } from '../services/backup.ts';

const [input, sourceId, targetId] = process.argv.slice(2);
if (!input || !sourceId || !targetId || sourceId === targetId) {
  console.error('Usage: node --experimental-strip-types scripts/merge-recovered-student.mjs <backup.json> <recovered-student-id> <existing-student-id>');
  process.exitCode = 1;
} else {
  try {
    const source = resolve(input);
    const backup = parseBackup(await readFile(source, 'utf8'));
    const oldStudent = backup.data.students.find(student => student.id === sourceId);
    const currentStudent = backup.data.students.find(student => student.id === targetId);
    if (!oldStudent?.name?.startsWith('Recovered student ')) throw new Error('The source ID is not a recovered student.');
    if (!currentStudent || currentStudent.name.startsWith('Recovered student ')) throw new Error('The target ID must be an existing named student.');

    const data = { ...backup.data, students: backup.data.students.filter(student => student.id !== sourceId) };
    const moved = {};
    for (const collection of ['classes', 'payments', 'testResults', 'parentContacts', 'communications']) {
      moved[collection] = backup.data[collection].filter(record => record.studentId === sourceId).length;
      data[collection] = backup.data[collection].map(record => record.studentId === sourceId ? { ...record, studentId: targetId } : record);
    }
    const merged = parseBackup(JSON.stringify({ ...backup, data }));
    if (missingStudentReferences(merged).length > 0) throw new Error('The merged backup still has missing student references.');
    const output = join(dirname(source), `${basename(source, extname(source))}.merged.json`);
    await writeFile(output, JSON.stringify(merged, null, 2), { encoding: 'utf8', flag: 'wx' });
    console.log(`Merged ${oldStudent.name} into ${currentStudent.name}.`);
    console.log(`Moved records: ${Object.entries(moved).map(([name, count]) => `${name}=${count}`).join(', ')}.`);
    console.log(`Merged backup: ${output}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Could not merge student records.');
    process.exitCode = 1;
  }
}
