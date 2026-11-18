import React, { useEffect, useState } from 'react';
import { backupCounts, AppBackup } from '../services/backup';
import { saveBackupFile } from '../services/backupShare';
import { DataConflictError, loadTutorData, recordChanged, retrySync, useDeviceRecords, useServerRecords } from '../services/sync';

const countSummary = (backup: AppBackup) => backupCounts(backup).map(({ collection, count }) => `${collection}: ${count}`).join(' · ');

export const TutorDataGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState<DataConflictError | null>(null);
  const [notice, setNotice] = useState('');
  const [savedCopy, setSavedCopy] = useState(false);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [loadServerConfirmed, setLoadServerConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = () => {
    setError(''); setConflict(null);
    void loadTutorData().then(() => setReady(true)).catch(cause => {
      if (cause instanceof DataConflictError) setConflict(cause);
      else setError(cause instanceof Error ? cause.message : 'Could not load tutor records.');
    });
  };
  useEffect(() => {
    load();
    const listener = (event: Event) => setNotice((event as CustomEvent<string>).detail);
    window.addEventListener('solace-sync', listener);
    window.addEventListener('solace-record-changed', recordChanged);
    return () => {
      window.removeEventListener('solace-sync', listener);
      window.removeEventListener('solace-record-changed', recordChanged);
    };
  }, []);
  const save = async (backup: AppBackup, label: 'device' | 'server') => {
    setError('');
    try {
      await saveBackupFile(`solace-${label}-backup-${backup.exportedAt.slice(0, 10)}.json`, JSON.stringify(backup, null, 2));
      setNotice(`Choose a private location for the ${label} backup, then check that the file exists.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not share the backup.'); }
  };
  const migrate = async () => {
    if (!conflict || !savedCopy || !replaceConfirmed) return;
    setBusy(true); setError('');
    try { await useDeviceRecords(conflict.device); setConflict(null); setReady(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not copy device records.'); }
    finally { setBusy(false); }
  };
  const loadServer = () => {
    if (!conflict || !savedCopy || !loadServerConfirmed) return;
    setError('');
    try { useServerRecords(conflict.server); setConflict(null); setReady(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load server records.'); }
  };
  if (!ready) return <main className="min-h-screen bg-slate-950 text-white grid place-items-center p-5"><div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-white/10 p-5 space-y-4">
    {conflict ? <>
      <h1 className="text-xl font-semibold">Choose which records to keep</h1>
      <p className="text-sm text-amber-200">This device has different records from the server. Nothing has been replaced.</p>
      <div className="rounded-xl bg-slate-800 p-3"><h2 className="font-semibold">This device</h2><p className="text-sm text-slate-300 mt-1">{countSummary(conflict.device)}</p><button className="text-blue-300 text-sm mt-2" onClick={() => void save(conflict.device, 'device')}>Save device backup</button></div>
      <div className="rounded-xl bg-slate-800 p-3"><h2 className="font-semibold">Server</h2><p className="text-sm text-slate-300 mt-1">{countSummary(conflict.server)}</p><button className="text-blue-300 text-sm mt-2" onClick={() => void save(conflict.server, 'server')}>Save server backup</button></div>
      <p className="text-sm text-slate-300">Copying this device's records will replace the six record collections on the server. Any server-only records in those collections will be lost.</p>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={savedCopy} onChange={event => setSavedCopy(event.target.checked)} />I saved and checked a separate copy of this device's records.</label>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={replaceConfirmed} onChange={event => setReplaceConfirmed(event.target.checked)} />I reviewed the counts and want this device's records on the server.</label>
      <button disabled={busy || !savedCopy || !replaceConfirmed} className="w-full rounded-xl bg-blue-600 p-3 font-semibold disabled:opacity-50" onClick={() => void migrate()}>{busy ? 'Copying…' : 'Use this device’s records on the server'}</button>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={loadServerConfirmed} onChange={event => setLoadServerConfirmed(event.target.checked)} />I reviewed the counts and want the server's records on this device.</label>
      <button disabled={busy || !savedCopy || !loadServerConfirmed} className="w-full rounded-xl border border-blue-400/60 p-3 font-semibold disabled:opacity-50" onClick={loadServer}>Use server records on this device</button>
    </> : <><h1 className="text-lg font-semibold">Loading tutor records…</h1><p className="text-sm text-rose-300">{error}</p>{error && <button className="rounded-xl bg-blue-600 p-3" onClick={load}>Try again</button>}</>}
    {notice && <p role="status" className="text-sm text-blue-200">{notice}</p>}
    {error && conflict && <p role="alert" className="text-sm text-rose-300">{error}</p>}
  </div></main>;
  return <>{notice && <div role="status" className="fixed top-1 right-1 z-50 bg-slate-800 border border-blue-400/40 rounded-xl p-2 text-xs max-w-xs" onClick={() => setNotice('')}>{notice}</div>}{children}<button className="sr-only" onClick={() => void retrySync()}>Retry saving changes</button></>;
};
