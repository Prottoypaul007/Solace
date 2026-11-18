const STORAGE_KEYS = {
  students: 'tt_students',
  classes: 'tt_classes',
  payments: 'tt_payments',
  testResults: 'test_results',
  parentContacts: 'parent_contacts',
  communications: 'communications',
} as const;

type Collection = keyof typeof STORAGE_KEYS;
type RecordData = Record<string, unknown>;
type BackupData = Record<Collection, RecordData[]>;

export interface AppBackup {
  app: 'solace';
  version: 1;
  exportedAt: string;
  data: BackupData;
}

const collections = Object.keys(STORAGE_KEYS) as Collection[];
const isObject = (value: unknown): value is RecordData =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const hasString = (record: RecordData, key: string) => typeof record[key] === 'string';
const hasNumber = (record: RecordData, key: string) =>
  typeof record[key] === 'number' && Number.isFinite(record[key]);

const validRecord = (collection: Collection, record: RecordData): boolean => {
  if (!hasString(record, 'id')) return false;
  switch (collection) {
    case 'students':
      return hasString(record, 'name') && hasString(record, 'subject') &&
        hasString(record, 'phone') && hasString(record, 'createdAt') && hasNumber(record, 'ratePerClass');
    case 'classes':
      return hasString(record, 'studentId') && hasString(record, 'date') && hasNumber(record, 'durationMinutes');
    case 'payments':
      return hasString(record, 'studentId') && hasString(record, 'date') && hasNumber(record, 'amount');
    case 'testResults':
      return hasString(record, 'studentId') && hasString(record, 'testName') &&
        hasString(record, 'subject') && hasString(record, 'date') &&
        hasNumber(record, 'maxMarks') && hasNumber(record, 'obtainedMarks') &&
        hasNumber(record, 'percentage') && typeof record.sentToParent === 'boolean';
    case 'parentContacts':
      return hasString(record, 'studentId') && hasString(record, 'parentName') &&
        hasString(record, 'relationship') && typeof record.isPrimary === 'boolean';
    case 'communications':
      return hasString(record, 'studentId') && hasString(record, 'parentContactId') &&
        hasString(record, 'subject') && hasString(record, 'message') &&
        hasString(record, 'sentDate') && hasString(record, 'method') && hasString(record, 'status');
  }
};

const validateData = (value: unknown): BackupData => {
  if (!isObject(value)) throw new Error('The backup data is missing.');
  for (const collection of collections) {
    const records = value[collection];
    if (!Array.isArray(records) || !records.every(record => isObject(record) && validRecord(collection, record))) {
      throw new Error(`The ${collection} records are invalid.`);
    }
  }
  return value as BackupData;
};

export const createBackup = (): AppBackup => {
  const data = {} as BackupData;
  for (const collection of collections) {
    const raw = localStorage.getItem(STORAGE_KEYS[collection]);
    try {
      data[collection] = raw === null ? [] : JSON.parse(raw);
    } catch {
      throw new Error(`Saved ${collection} records could not be read. No backup was created.`);
    }
  }
  validateData(data);
  return { app: 'solace', version: 1, exportedAt: new Date().toISOString(), data };
};

export const parseBackup = (text: string): AppBackup => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (!isObject(value) || value.app !== 'solace' || value.version !== 1 ||
      typeof value.exportedAt !== 'string' || Number.isNaN(Date.parse(value.exportedAt))) {
    throw new Error('This is not a supported Solace backup.');
  }
  validateData(value.data);
  return value as unknown as AppBackup;
};

export const restoreBackup = (backup: AppBackup): void => {
  validateData(backup.data);
  const previous = collections.map(collection => [STORAGE_KEYS[collection], localStorage.getItem(STORAGE_KEYS[collection])] as const);
  try {
    for (const collection of collections) {
      const encoded = JSON.stringify(backup.data[collection]);
      localStorage.setItem(STORAGE_KEYS[collection], encoded);
      if (localStorage.getItem(STORAGE_KEYS[collection]) !== encoded) {
        throw new Error('Write verification failed');
      }
    }
  } catch {
    let rolledBack = true;
    for (const [key, value] of previous) {
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch {
        rolledBack = false;
      }
    }
    throw new Error(rolledBack
      ? 'Restore failed. Your existing data was kept.'
      : 'Restore failed, and some records may have changed. Restore a saved backup before using the app.');
  }
};

export const backupCounts = (backup: AppBackup) =>
  collections.map(collection => ({ collection, count: backup.data[collection].length }));

export const missingStudentReferences = (backup: AppBackup) => {
  const known = new Set(backup.data.students.map(student => student.id));
  const missing = new Map<string, Record<string, number>>();
  for (const collection of collections) {
    if (collection === 'students') continue;
    for (const record of backup.data[collection]) {
      const studentId = record.studentId;
      if (typeof studentId !== 'string' || known.has(studentId)) continue;
      const counts = missing.get(studentId) ?? {};
      counts[collection] = (counts[collection] || 0) + 1;
      missing.set(studentId, counts);
    }
  }
  return [...missing].map(([studentId, counts]) => ({ studentId, counts }));
};

export const recoverMissingStudents = (backup: AppBackup): AppBackup => {
  const missing = missingStudentReferences(backup);
  if (missing.length === 0) return backup;
  const createdAt = new Date().toISOString();
  return {
    ...backup,
    data: {
      ...backup.data,
      students: [...backup.data.students, ...missing.map(({ studentId }) => ({
        id: studentId,
        name: `Recovered student ${studentId.slice(0, 8)}`,
        subject: 'Review imported record',
        ratePerClass: 0,
        phone: '',
        createdAt,
      }))],
    },
  };
};

export const sameBackupData = (left: AppBackup, right: AppBackup): boolean =>
  collections.every(collection => {
    const a = left.data[collection], b = right.data[collection];
    if (a.length !== b.length) return false;
    const byId = new Map(b.map(record => [record.id, JSON.stringify(record)]));
    return a.every(record => byId.get(record.id) === JSON.stringify(record));
  });
