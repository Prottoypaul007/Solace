import { api, post } from './api';
import { AppBackup, createBackup, missingStudentReferences, recoverMissingStudents, restoreBackup, sameBackupData } from './backup';
const recordKeys = ['tt_students', 'tt_classes', 'tt_payments', 'test_results', 'parent_contacts', 'communications'];

const pendingKey = 'solace_pending_sync';
const cacheOwnerKey = 'solace_tutor_cache_owner';
let enabled = false;
let generation = 0;
let running: Promise<void> | null = null;
const counts = (backup: AppBackup) => Object.values(backup.data).reduce((sum, records) => sum + records.length, 0);
const report = (message: string) => window.dispatchEvent(new CustomEvent('solace-sync', { detail: message }));

export class DataConflictError extends Error {
  constructor(public readonly device: AppBackup, public readonly server: AppBackup) {
    super('This device has records that differ from the server. No records were changed.');
  }
}


export async function loadTutorData(accountId?: string): Promise<void> {
  enabled = false;
  const remote = await api<AppBackup>('/api/tutor/data');
  const local = createBackup();
  const previousOwner = localStorage.getItem(cacheOwnerKey);
  if (accountId && previousOwner && previousOwner !== accountId && counts(local) > 0) {
    throw new DataConflictError(local, remote);
  }
  if (accountId && !previousOwner && counts(remote) === 0 && counts(local) > 0) {
    throw new DataConflictError(local, remote);
  }
  if (counts(remote) === 0) {
    if (counts(local) > 0) {
      const recovered = recoverMissingStudents(local);
      await post('/api/tutor/import', recovered);
      if (recovered !== local) restoreBackup(recovered);
      report('Existing device records imported to your tutor account.');
    }
  } else if (counts(local) > 0 && !sameBackupData(local, remote)) {
    throw new DataConflictError(local, remote);
  } else {
    restoreBackup(remote);
  }
  localStorage.removeItem(pendingKey);
  if (accountId) localStorage.setItem(cacheOwnerKey, accountId);
  enabled = true;
}

export async function useDeviceRecords(backup: AppBackup, accountId?: string): Promise<void> {
  const recovered = recoverMissingStudents(backup);
  await api('/api/tutor/data', { method: 'PUT', body: JSON.stringify(recovered) });
  if (recovered !== backup) restoreBackup(recovered);
  localStorage.removeItem(pendingKey);
  if (accountId) localStorage.setItem(cacheOwnerKey, accountId);
  enabled = true;
  report('Device records copied to the server. Verify all counts before inviting students.');
}

export async function repairImportedRecords(): Promise<number> {
  const current = createBackup();
  const missing = missingStudentReferences(current);
  if (missing.length === 0) return 0;
  const repaired = recoverMissingStudents(current);
  restoreBackup(repaired);
  generation += 1;
  localStorage.setItem(pendingKey, '1');
  if (running) await running.catch(() => {});
  await flushPending();
  report(`${missing.length} missing student record${missing.length === 1 ? '' : 's'} restored. Review their names and rates.`);
  return missing.length;
}

export function useServerRecords(backup: AppBackup, accountId?: string): void {
  restoreBackup(backup);
  localStorage.removeItem(pendingKey);
  if (accountId) localStorage.setItem(cacheOwnerKey, accountId);
  enabled = true;
  report('Server records loaded on this device. Verify the record counts.');
}

async function flushPending(): Promise<void> {
  if (running) return running;
  running = (async () => {
    while (localStorage.getItem(pendingKey) === '1') {
      const current = generation;
      const backup = createBackup();
      try {
        await api('/api/tutor/data', { method: 'PUT', body: JSON.stringify(backup) });
        if (generation === current) localStorage.removeItem(pendingKey);
        report('All changes saved to your account.');
      } catch (error) {
        report(`Changes remain on this device. Server save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
    }
  })().finally(() => { running = null; });
  return running;
}

export function recordChanged(): void {
  if (!enabled) return;
  generation += 1;
  localStorage.setItem(pendingKey, '1');
  void flushPending().catch(() => {});
}

export const hasPendingChanges = () => localStorage.getItem(pendingKey) === '1';
export const retrySync = () => flushPending();
export async function clearTutorCache(): Promise<void> {
  if (hasPendingChanges()) await flushPending();
  enabled = false;
  for (const key of recordKeys) localStorage.removeItem(key);
  localStorage.removeItem(cacheOwnerKey);
}
