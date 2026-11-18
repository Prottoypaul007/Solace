import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { missingStudentReferences, parseBackup, recoverMissingStudents } from '../services/backup.ts';

const input = process.argv[2];
if (!input) {
  console.error('Usage: node --experimental-strip-types scripts/repair-backup.mjs <backup.json>');
  process.exitCode = 1;
} else {
  try {
    const source = resolve(input);
    const backup = parseBackup(await readFile(source, 'utf8'));
    const missing = missingStudentReferences(backup);
    if (missing.length === 0) {
      console.log('No missing student references found. The input file was not changed.');
    } else {
      const output = join(dirname(source), `${basename(source, extname(source))}.repaired.json`);
      await writeFile(output, JSON.stringify(recoverMissingStudents(backup), null, 2), { encoding: 'utf8', flag: 'wx' });
      console.log(`Added ${missing.length} recovered student record(s), keeping all existing records.`);
      console.log(`Repaired backup: ${output}`);
      console.log('Keep the original backup. Import the repaired file, then review recovered student names and rates.');
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Could not repair the backup.');
    process.exitCode = 1;
  }
}
