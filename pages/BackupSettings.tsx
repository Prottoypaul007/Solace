import React, { useRef, useState } from 'react';
import { Download, FileUp, ShieldCheck } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { AppBackup, backupCounts, createBackup, missingStudentReferences, parseBackup, restoreBackup } from '../services/backup';
import { saveBackupFile } from '../services/backupShare';
import { useNavigate } from 'react-router-dom';
import { hasPendingChanges, recordChanged, repairImportedRecords, retrySync } from '../services/sync';

const labels: Record<string, string> = {
  students: 'Students',
  classes: 'Classes',
  payments: 'Payments',
  testResults: 'Test results',
  parentContacts: 'Parent contacts',
  communications: 'Message history',
};

export const BackupSettings: React.FC = () => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<AppBackup | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const missing = missingStudentReferences(createBackup());

  const repair = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const count = await repairImportedRecords();
      setNotice(`${count} missing student record${count === 1 ? '' : 's'} restored. Open Students to update each recovered student's name and class rate.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save repaired records. The records remain on this device.');
    } finally { setBusy(false); }
  };

  const exportData = async () => {
    setError('');
    setNotice('');
    try {
      const backup = createBackup();
      const filename = `solace-backup-${backup.exportedAt.slice(0, 10)}.json`;
      const result = await saveBackupFile(filename, JSON.stringify(backup, null, 2));
      setNotice(result === 'shared' ? 'Choose where to save or share the backup file.' : 'Backup download started. Check that the file was saved.');
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setError(cause instanceof Error ? cause.message : 'Could not create a backup.');
    }
  };

  const selectFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelected(null);
    setError('');
    setNotice('');
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      setSelected(backup);
      setFileName(file.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read this backup.');
    }
    event.target.value = '';
  };

  const restore = () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      restoreBackup(selected);
      recordChanged();
      setSelected(null);
      setNotice('Backup restored. Your students and records are ready to use.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not restore this backup.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout title="Backup & Restore">
      <div className="space-y-5 pb-4">
        {missing.length > 0 && <section className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 space-y-3">
          <h2 className="text-lg font-semibold text-amber-100">Repair imported records</h2>
          <p className="text-sm text-amber-100/90">Some imported records refer to students missing from the student list. This prevents new changes from saving to the server. Repair adds a clearly marked student for each missing ID and keeps every linked record.</p>
          {missing.map(({ studentId, counts }) => <p key={studentId} className="break-all rounded-xl bg-slate-900/70 p-3 text-xs text-slate-200">ID {studentId} · {Object.entries(counts).map(([collection, count]) => `${count} ${labels[collection] || collection}`).join(', ')}</p>)}
          <p className="text-xs text-amber-100/80">Save a backup first if you want a copy of the imported data before repair. Review recovered names and rates afterward.</p>
          <Button variant="secondary" fullWidth onClick={exportData}>Save backup</Button>
          <Button fullWidth disabled={busy} onClick={() => void repair()}>{busy ? 'Repairing…' : 'Restore missing students and retry save'}</Button>
        </section>}
        <section className="rounded-2xl border border-white/10 bg-slate-800/60 p-4 space-y-3">
          <h2 className="font-semibold">Account and student access</h2>
          <button className="block text-blue-300 text-sm" onClick={() => navigate('/account')}>My account and password</button>
          <button className="block text-blue-300 text-sm" onClick={() => navigate('/student-accounts')}>Manage student accounts</button>
          {hasPendingChanges() && <button className="block text-amber-300 text-sm" onClick={() => void retrySync().then(() => setNotice('Changes saved to the server.')).catch(e => setError(e.message))}>Retry saving device changes</button>}
        </section>
        <section className="rounded-2xl border border-blue-400/30 bg-blue-500/10 p-4">
          <ShieldCheck className="text-blue-300" size={25} />
          <h2 className="mt-2 text-lg font-semibold">Keep a copy of your data</h2>
          <p className="mt-1 text-xs leading-5 text-slate-300">
            Solace saves records on this device. Export a backup regularly and store it somewhere you can find it if you change phones or clear app data.
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-800/60 p-4">
          <div className="flex items-center gap-2"><Download size={19} className="text-blue-300" /><h2 className="font-semibold">Export backup</h2></div>
          <p className="mt-2 text-xs leading-5 text-slate-400">Includes students, classes, payments, test results, parent contacts, and message history. The file contains personal information, so keep it private.</p>
          <Button className="mt-4" fullWidth onClick={exportData}>Save or share backup</Button>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-800/60 p-4">
          <div className="flex items-center gap-2"><FileUp size={19} className="text-blue-300" /><h2 className="font-semibold">Restore backup</h2></div>
          <p className="mt-2 text-xs leading-5 text-slate-400">Choose a Solace JSON backup. You can review its contents before it replaces all records currently on this device.</p>
          <input ref={inputRef} type="file" accept=".json,application/json" className="hidden" onChange={selectFile} aria-label="Choose backup file" />
          <Button className="mt-4" variant="secondary" fullWidth onClick={() => inputRef.current?.click()}>Choose backup file</Button>

          {selected && (
            <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
              <p className="text-sm font-semibold break-all">{fileName}</p>
              <p className="mt-1 text-xs text-slate-300">Created {new Date(selected.exportedAt).toLocaleString()}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-200">
                {backupCounts(selected).map(({ collection, count }) => <p key={collection}>{labels[collection]}: {count}</p>)}
              </div>
              <p className="mt-3 text-xs leading-5 text-amber-200">Restoring replaces all current records. Save a backup of this device first if you want to keep them.</p>
              <Button className="mt-3" variant="danger" fullWidth disabled={busy} onClick={restore}>Replace current data</Button>
            </div>
          )}
        </section>

        {error && <p role="alert" className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
        {notice && <p role="status" className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</p>}
      </div>
    </Layout>
  );
};
