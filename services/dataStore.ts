export const DATA_KEYS = {
  students: 'tt_students',
  classes: 'tt_classes',
  payments: 'tt_payments',
  testResults: 'test_results',
  parentContacts: 'parent_contacts',
  communications: 'communications',
} as const;

export const readList = <T>(key: string): T[] => {
  const raw = localStorage.getItem(key);
  if (raw === null) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (Array.isArray(value)) return value as T[];
  } catch {
    // Preserve the original value so it can be recovered from a backup.
  }
  throw new Error(`Saved data in ${key} could not be read. Export a backup before changing records.`);
};

export const writeBatch = (changes: Record<string, unknown[]>): void => {
  const previous = Object.keys(changes).map(key => [key, localStorage.getItem(key)] as const);
  try {
    for (const [key, value] of Object.entries(changes)) {
      const encoded = JSON.stringify(value);
      localStorage.setItem(key, encoded);
      if (localStorage.getItem(key) !== encoded) throw new Error('Write verification failed');
    }
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('solace-record-changed'));
  } catch {
    let restored = true;
    for (const [key, value] of previous) {
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch {
        restored = false;
      }
    }
    throw new Error(restored
      ? 'Could not save. Your previous records were kept. Check available storage and try again.'
      : 'Could not save, and rollback failed. Stop editing and restore your latest backup.');
  }
};

export const writeList = <T>(key: string, records: T[]): void => writeBatch({ [key]: records });
