import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { BookOpen, Calendar, ChevronRight, DollarSign, MessageCircle, Pencil, Trash2, Users } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import type { ClassSession, Payment, Student } from '../types';
import { isRecoveredStudent } from '../services/recoveredStudents';
import {
  addClassSession, addPayment, deleteClassSession, deletePayment, deleteStudent,
  getClassesByStudent, getPaymentsByStudent, getStudentBalance, getStudentById,
  restoreStudent, StudentSnapshot, updateClassSession, updatePayment, updateStudent,
} from '../services/storage';

const today = () => new Date().toISOString().slice(0, 10);
const dateToIso = (date: string) => new Date(`${date}T12:00:00`).toISOString();
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Could not save this change.';

export const StudentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student>();
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState('');
  const [deletedStudent, setDeletedStudent] = useState<StudentSnapshot>();
  const [deletedRecord, setDeletedRecord] = useState<ClassSession | Payment>();
  const [editStudentOpen, setEditStudentOpen] = useState(false);
  const [studentForm, setStudentForm] = useState({ name: '', subject: '', rate: '', phone: '' });
  const [classOpen, setClassOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassSession>();
  const [classForm, setClassForm] = useState({ date: today(), duration: '', topic: '' });
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment>();
  const [paymentForm, setPaymentForm] = useState({ date: today(), amount: '', note: '' });

  const refresh = useCallback(() => {
    if (!id) return;
    const current = getStudentById(id);
    setStudent(current);
    if (current) {
      setClasses(getClassesByStudent(id));
      setPayments(getPaymentsByStudent(id));
      setBalance(getStudentBalance(id));
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  const saveStudent = (event: React.FormEvent) => {
    event.preventDefault();
    if (!student) return;
    const rate = Number(studentForm.rate);
    if (!studentForm.name.trim() || !studentForm.subject.trim() || !Number.isFinite(rate) || rate <= 0) {
      setError('Enter a name, subject, and rate greater than zero.'); return;
    }
    try {
      updateStudent({ ...student, name: studentForm.name.trim(), subject: studentForm.subject.trim(), ratePerClass: rate, phone: studentForm.phone.trim() });
      setEditStudentOpen(false); setError(''); refresh();
    } catch (cause) { setError(errorMessage(cause)); }
  };

  const saveClass = (event: React.FormEvent) => {
    event.preventDefault();
    if (!student) return;
    const duration = Number(classForm.duration);
    if (!classForm.date || !Number.isFinite(duration) || duration <= 0) {
      setError('Enter a date and a duration greater than zero.'); return;
    }
    try {
      const record: ClassSession = { id: editingClass?.id ?? uuidv4(), studentId: student.id, date: dateToIso(classForm.date), createdAt: editingClass?.createdAt ?? new Date().toISOString(), durationMinutes: duration, rateCharged: editingClass?.rateCharged ?? student.ratePerClass, topic: classForm.topic.trim() || undefined };
      if (editingClass) updateClassSession(record); else addClassSession(record);
      setClassOpen(false); setEditingClass(undefined); setError(''); refresh();
    } catch (cause) { setError(errorMessage(cause)); }
  };

  const savePayment = (event: React.FormEvent) => {
    event.preventDefault();
    if (!student) return;
    const amount = Number(paymentForm.amount);
    if (!paymentForm.date || !Number.isFinite(amount) || amount <= 0) {
      setError('Enter a date and an amount greater than zero.'); return;
    }
    try {
      const record: Payment = { id: editingPayment?.id ?? uuidv4(), studentId: student.id, date: dateToIso(paymentForm.date), amount, note: paymentForm.note.trim() || undefined };
      if (editingPayment) updatePayment(record); else addPayment(record);
      setPaymentOpen(false); setEditingPayment(undefined); setError(''); refresh();
    } catch (cause) { setError(errorMessage(cause)); }
  };

  const removeRecord = (record: ClassSession | Payment, kind: 'class' | 'payment') => {
    if (!window.confirm(`Delete this ${kind}? You can undo it until you leave this page.`)) return;
    try {
      if (kind === 'class') deleteClassSession(record.id); else deletePayment(record.id);
      setDeletedRecord(record); setError(''); refresh();
    } catch (cause) { setError(errorMessage(cause)); }
  };

  const undoRecord = () => {
    if (!deletedRecord) return;
    try {
      if ('durationMinutes' in deletedRecord) addClassSession(deletedRecord); else addPayment(deletedRecord);
      setDeletedRecord(undefined); setError(''); refresh();
    } catch (cause) { setError(errorMessage(cause)); }
  };

  const removeStudent = () => {
    if (!student || !window.confirm(`Delete ${student.name} and all related records? You can undo it until you leave this page.`)) return;
    try {
      setDeletedStudent(deleteStudent(student.id)); setStudent(undefined); setError('');
    } catch (cause) { setError(errorMessage(cause)); }
  };

  const undoStudent = () => {
    if (!deletedStudent) return;
    try {
      restoreStudent(deletedStudent); setDeletedStudent(undefined); setError(''); refresh();
    } catch (cause) { setError(errorMessage(cause)); }
  };

  if (deletedStudent) return (
    <Layout title="Student deleted" showBack onBack={() => navigate('/students')}>
      <div className="space-y-4 py-8 text-center">
        <p>{deletedStudent.student.name} and their records were deleted.</p>
        {error && <p role="alert" className="text-rose-300 text-sm">{error}</p>}
        <Button fullWidth onClick={undoStudent}>Undo deletion</Button>
        <Button fullWidth variant="outline" onClick={() => navigate('/students')}>Done</Button>
      </div>
    </Layout>
  );

  if (!student) return <Layout title="Student" showBack onBack={() => navigate('/students')}><p className="py-8 text-center text-slate-400">Student not found.</p></Layout>;

  const history = [
    ...classes.map(record => ({ kind: 'class' as const, record })),
    ...payments.map(record => ({ kind: 'payment' as const, record })),
  ].sort((a, b) => new Date(b.record.date).getTime() - new Date(a.record.date).getTime());
  const totalPaid = payments.reduce((sum, record) => sum + record.amount, 0);
  const totalMinutes = classes.reduce((sum, record) => sum + record.durationMinutes, 0);

  return (
    <Layout title={student.name} showBack onBack={() => navigate('/students')}>
      <div className="space-y-6 pb-4">
        {isRecoveredStudent(student) && <div role="status" className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm leading-5 text-amber-100">These imported records are safe. Tap the pencil to enter the student's correct name, subject, and rate. The linked records will remain with this student.</div>}
        <section className="rounded-3xl border border-white/10 bg-slate-900 p-5">
          <div className="flex items-start gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 text-lg font-bold text-blue-200">{student.name.trim().slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><h2 className="truncate text-lg font-bold">{student.name}</h2><p className="text-sm text-slate-300">{student.subject} · ৳{student.ratePerClass.toLocaleString('en-BD')} per class</p>{student.phone && <p className="mt-1 text-sm text-slate-400">{student.phone}</p>}</div>
            <button aria-label="Edit student" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-blue-300" onClick={() => { setStudentForm({ name: student.name, subject: student.subject, rate: String(student.ratePerClass), phone: student.phone }); setEditStudentOpen(true); setError(''); }}><Pencil size={18} /></button></div>
          <div className={`mt-5 rounded-2xl p-4 ${balance > 0 ? 'bg-amber-500/10 text-amber-200' : 'bg-emerald-500/10 text-emerald-200'}`}><p className="text-xs font-semibold uppercase tracking-wide opacity-75">Current balance</p><p className="mt-1 text-xl font-bold">{balance > 0 ? `Due ৳${balance.toLocaleString('en-BD')}` : balance < 0 ? `Advance ৳${Math.abs(balance).toLocaleString('en-BD')}` : 'No due'}</p></div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-slate-800 p-3"><strong className="block text-base">{classes.length}</strong><span className="text-xs text-slate-400">Classes</span></div><div className="rounded-xl bg-slate-800 p-3"><strong className="block text-base">{totalMinutes}</strong><span className="text-xs text-slate-400">Minutes</span></div><div className="rounded-xl bg-slate-800 p-3"><strong className="block text-base">৳{totalPaid.toLocaleString('en-BD')}</strong><span className="text-xs text-slate-400">Paid</span></div></div>
        </section>

        <section><h3 className="mb-3 text-lg font-bold">Quick actions</h3><div className="grid grid-cols-2 gap-3">
          <Button className="gap-2" onClick={() => { setEditingClass(undefined); setClassForm({ date: today(), duration: '', topic: '' }); setClassOpen(true); setError(''); }}><BookOpen size={18} /> Add class</Button>
          <Button className="gap-2" variant="secondary" onClick={() => { setEditingPayment(undefined); setPaymentForm({ date: today(), amount: '', note: '' }); setPaymentOpen(true); setError(''); }}><DollarSign size={18} /> Add payment</Button>
        </div></section>

        <section><h3 className="mb-3 text-lg font-bold">Progress & records</h3><div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900 divide-y divide-white/10">
          {[[`/student/${id}/tests`, 'Test results'], [`/student/${id}/statement`, 'Monthly statement'], ['/connect?tab=Classes', 'Schedule class']].map(([path, label]) => <button key={label} onClick={() => navigate(path)} className="flex min-h-14 w-full items-center justify-between px-4 text-left text-sm font-semibold active:bg-slate-800"><span>{label}</span><ChevronRight size={18} className="text-slate-500" /></button>)}
        </div></section>

        <section><h3 className="mb-3 text-lg font-bold">Communication</h3><div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate(`/connect?tab=Messages&student=${encodeURIComponent(id || '')}`)} className="flex min-h-16 items-center gap-2 rounded-2xl border border-white/10 bg-slate-900 p-4 text-left text-sm font-semibold active:bg-slate-800"><MessageCircle size={19} className="shrink-0 text-blue-300" /> Student chat</button>
          <button onClick={() => navigate(`/student/${id}/parents`)} className="flex min-h-16 items-center gap-2 rounded-2xl border border-white/10 bg-slate-900 p-4 text-left text-sm font-semibold active:bg-slate-800"><Users size={19} className="shrink-0 text-blue-300" /> Parents</button>
        </div><div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 divide-y divide-white/10">
          {[[`/student/${id}/messages`, 'Message history'], [`/student-accounts?student=${encodeURIComponent(id || '')}`, 'Enable student login']].map(([path, label]) => <button key={label} onClick={() => navigate(path)} className="flex min-h-14 w-full items-center justify-between px-4 text-left text-sm font-semibold active:bg-slate-800"><span>{label}</span><ChevronRight size={18} className="text-slate-500" /></button>)}
        </div></section>

        {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
        {deletedRecord && <div role="status" className="flex items-center justify-between rounded-xl bg-amber-500/10 p-3 text-xs"><span>Record deleted.</span><button className="font-semibold text-amber-200" onClick={undoRecord}>Undo</button></div>}

        <section><h3 className="mb-3 text-lg font-bold">History <span className="text-sm font-normal text-slate-400">· {history.length} records</span></h3>
          <div className="space-y-2">{history.length === 0 && <p className="text-sm text-slate-400">No classes or payments yet.</p>}
            {history.map(({ kind, record }) => <div key={record.id} className="rounded-xl border border-slate-700 bg-slate-900/80 p-3">
              <div className="flex items-start justify-between gap-2"><div className="flex items-center gap-2 text-sm font-semibold">{kind === 'class' ? <BookOpen size={15} /> : <DollarSign size={15} />}{kind === 'class' ? (record as ClassSession).topic || 'Class' : (record as Payment).note || 'Payment'}</div><span className="text-sm">{kind === 'class' ? `${(record as ClassSession).durationMinutes} min` : `৳${(record as Payment).amount}`}</span></div>
              <div className="mt-2 flex items-center justify-between"><span className="flex items-center gap-1 text-xs text-slate-400"><Calendar size={12} />{format(new Date(record.date), 'dd MMM yyyy')}</span><div className="flex gap-1"><button aria-label={`Edit ${kind}`} className="flex h-11 w-11 items-center justify-center rounded-xl text-blue-300 active:bg-slate-800" onClick={() => { setError(''); if (kind === 'class') { const item = record as ClassSession; setEditingClass(item); setClassForm({ date: item.date.slice(0, 10), duration: String(item.durationMinutes), topic: item.topic || '' }); setClassOpen(true); } else { const item = record as Payment; setEditingPayment(item); setPaymentForm({ date: item.date.slice(0, 10), amount: String(item.amount), note: item.note || '' }); setPaymentOpen(true); } }}><Pencil size={18} /></button><button aria-label={`Delete ${kind}`} className="flex h-11 w-11 items-center justify-center rounded-xl text-rose-300 active:bg-slate-800" onClick={() => removeRecord(record, kind)}><Trash2 size={18} /></button></div></div>
            </div>)}</div>
        </section>
        {!isRecoveredStudent(student) && <Button variant="danger" fullWidth onClick={removeStudent}>Delete student</Button>}
      </div>

      {editStudentOpen && <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"><form onSubmit={saveStudent} className="max-h-[90dvh] w-full max-w-sm space-y-3 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-4"><h3 className="font-semibold">Edit student</h3><Input label="Name" value={studentForm.name} onChange={event => setStudentForm({ ...studentForm, name: event.target.value })} /><Input label="Subject" value={studentForm.subject} onChange={event => setStudentForm({ ...studentForm, subject: event.target.value })} /><Input label="Rate per class" type="number" min="0.01" step="any" value={studentForm.rate} onChange={event => setStudentForm({ ...studentForm, rate: event.target.value })} /><Input label="Phone" value={studentForm.phone} onChange={event => setStudentForm({ ...studentForm, phone: event.target.value })} />{error && <p role="alert" className="text-xs text-rose-300">{error}</p>}<div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setEditStudentOpen(false)}>Cancel</Button><Button type="submit">Save</Button></div></form></div>}

      {classOpen && <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"><form onSubmit={saveClass} className="max-h-[90dvh] w-full max-w-sm space-y-3 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-4"><h3 className="font-semibold">{editingClass ? 'Edit class' : 'Add class'}</h3><Input label="Date" type="date" value={classForm.date} onChange={event => setClassForm({ ...classForm, date: event.target.value })} /><Input label="Duration (minutes)" type="number" min="1" step="1" value={classForm.duration} onChange={event => setClassForm({ ...classForm, duration: event.target.value })} /><Input label="Topic (optional)" value={classForm.topic} onChange={event => setClassForm({ ...classForm, topic: event.target.value })} />{error && <p role="alert" className="text-xs text-rose-300">{error}</p>}<div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setClassOpen(false)}>Cancel</Button><Button type="submit">Save</Button></div></form></div>}

      {paymentOpen && <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"><form onSubmit={savePayment} className="max-h-[90dvh] w-full max-w-sm space-y-3 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-4"><h3 className="font-semibold">{editingPayment ? 'Edit payment' : 'Add payment'}</h3><Input label="Date" type="date" value={paymentForm.date} onChange={event => setPaymentForm({ ...paymentForm, date: event.target.value })} /><Input label="Amount (৳)" type="number" min="0.01" step="any" value={paymentForm.amount} onChange={event => setPaymentForm({ ...paymentForm, amount: event.target.value })} /><Input label="Note (optional)" value={paymentForm.note} onChange={event => setPaymentForm({ ...paymentForm, note: event.target.value })} />{error && <p role="alert" className="text-xs text-rose-300">{error}</p>}<div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button><Button type="submit">Save</Button></div></form></div>}
    </Layout>
  );
};
