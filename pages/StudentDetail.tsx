import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { BookOpen, Calendar, DollarSign, Pencil, Trash2 } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import type { ClassSession, Payment, Student } from '../types';
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
      const record: ClassSession = { id: editingClass?.id ?? uuidv4(), studentId: student.id, date: dateToIso(classForm.date), durationMinutes: duration, rateCharged: editingClass?.rateCharged ?? student.ratePerClass, topic: classForm.topic.trim() || undefined };
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
      <div className="space-y-4 pb-4">
        <section className="rounded-2xl border border-slate-700 bg-slate-900/85 p-4">
          <div className="flex justify-between gap-2"><div><h2 className="text-lg font-semibold">{student.name}</h2><p className="text-xs text-slate-300">{student.subject} · ৳{student.ratePerClass} per class</p><p className="text-xs text-slate-400">{student.phone}</p></div>
            <button aria-label="Edit student" onClick={() => { setStudentForm({ name: student.name, subject: student.subject, rate: String(student.ratePerClass), phone: student.phone }); setEditStudentOpen(true); setError(''); }}><Pencil size={18} /></button></div>
          <p className={`mt-3 text-sm font-semibold ${balance > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>{balance > 0 ? `Due ৳${balance.toLocaleString()}` : balance < 0 ? `Advance ৳${Math.abs(balance).toLocaleString()}` : 'No due'}</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-xl bg-slate-800 p-2">{classes.length}<br />Classes</div><div className="rounded-xl bg-slate-800 p-2">{totalMinutes}<br />Minutes</div><div className="rounded-xl bg-slate-800 p-2">৳{totalPaid}<br />Paid</div></div>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => { setEditingClass(undefined); setClassForm({ date: today(), duration: '', topic: '' }); setClassOpen(true); setError(''); }}>Add class</Button>
          <Button variant="secondary" onClick={() => { setEditingPayment(undefined); setPaymentForm({ date: today(), amount: '', note: '' }); setPaymentOpen(true); setError(''); }}>Add payment</Button>
          <Button variant="outline" onClick={() => navigate(`/student/${id}/tests`)}>Test results</Button>
          <Button variant="outline" onClick={() => navigate(`/student/${id}/statement`)}>Monthly statement</Button>
          <Button variant="outline" onClick={() => navigate(`/student/${id}/parents`)}>Parents</Button>
          <Button variant="outline" onClick={() => navigate(`/student/${id}/messages`)}>Messages</Button>
          <Button variant="outline" onClick={() => navigate(`/student-accounts?student=${encodeURIComponent(id || '')}`)}>Enable student login</Button>
          <Button variant="outline" onClick={() => navigate(`/connect?tab=Messages&student=${encodeURIComponent(id || '')}`)}>Student chat</Button>
          <Button variant="outline" onClick={() => navigate('/connect?tab=Classes')}>Schedule class</Button>
        </div>

        {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
        {deletedRecord && <div role="status" className="flex items-center justify-between rounded-xl bg-amber-500/10 p-3 text-xs"><span>Record deleted.</span><button className="font-semibold text-amber-200" onClick={undoRecord}>Undo</button></div>}

        <section><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">History · {history.length} records</h3>
          <div className="space-y-2">{history.length === 0 && <p className="text-sm text-slate-400">No classes or payments yet.</p>}
            {history.map(({ kind, record }) => <div key={record.id} className="rounded-xl border border-slate-700 bg-slate-900/80 p-3">
              <div className="flex items-start justify-between gap-2"><div className="flex items-center gap-2 text-sm font-semibold">{kind === 'class' ? <BookOpen size={15} /> : <DollarSign size={15} />}{kind === 'class' ? (record as ClassSession).topic || 'Class' : (record as Payment).note || 'Payment'}</div><span className="text-sm">{kind === 'class' ? `${(record as ClassSession).durationMinutes} min` : `৳${(record as Payment).amount}`}</span></div>
              <div className="mt-2 flex items-center justify-between"><span className="flex items-center gap-1 text-xs text-slate-400"><Calendar size={12} />{format(new Date(record.date), 'dd MMM yyyy')}</span><div className="flex gap-3"><button aria-label={`Edit ${kind}`} className="text-blue-300" onClick={() => { setError(''); if (kind === 'class') { const item = record as ClassSession; setEditingClass(item); setClassForm({ date: item.date.slice(0, 10), duration: String(item.durationMinutes), topic: item.topic || '' }); setClassOpen(true); } else { const item = record as Payment; setEditingPayment(item); setPaymentForm({ date: item.date.slice(0, 10), amount: String(item.amount), note: item.note || '' }); setPaymentOpen(true); } }}><Pencil size={16} /></button><button aria-label={`Delete ${kind}`} className="text-rose-300" onClick={() => removeRecord(record, kind)}><Trash2 size={16} /></button></div></div>
            </div>)}</div>
        </section>
        <Button variant="danger" fullWidth onClick={removeStudent}>Delete student</Button>
      </div>

      {editStudentOpen && <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4"><form onSubmit={saveStudent} className="w-full max-w-sm space-y-3 rounded-2xl border border-slate-700 bg-slate-950 p-4"><h3 className="font-semibold">Edit student</h3><Input label="Name" value={studentForm.name} onChange={event => setStudentForm({ ...studentForm, name: event.target.value })} /><Input label="Subject" value={studentForm.subject} onChange={event => setStudentForm({ ...studentForm, subject: event.target.value })} /><Input label="Rate per class" type="number" min="0.01" step="any" value={studentForm.rate} onChange={event => setStudentForm({ ...studentForm, rate: event.target.value })} /><Input label="Phone" value={studentForm.phone} onChange={event => setStudentForm({ ...studentForm, phone: event.target.value })} />{error && <p role="alert" className="text-xs text-rose-300">{error}</p>}<div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setEditStudentOpen(false)}>Cancel</Button><Button type="submit">Save</Button></div></form></div>}

      {classOpen && <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4"><form onSubmit={saveClass} className="w-full max-w-sm space-y-3 rounded-2xl border border-slate-700 bg-slate-950 p-4"><h3 className="font-semibold">{editingClass ? 'Edit class' : 'Add class'}</h3><Input label="Date" type="date" value={classForm.date} onChange={event => setClassForm({ ...classForm, date: event.target.value })} /><Input label="Duration (minutes)" type="number" min="1" step="1" value={classForm.duration} onChange={event => setClassForm({ ...classForm, duration: event.target.value })} /><Input label="Topic (optional)" value={classForm.topic} onChange={event => setClassForm({ ...classForm, topic: event.target.value })} />{error && <p role="alert" className="text-xs text-rose-300">{error}</p>}<div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setClassOpen(false)}>Cancel</Button><Button type="submit">Save</Button></div></form></div>}

      {paymentOpen && <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4"><form onSubmit={savePayment} className="w-full max-w-sm space-y-3 rounded-2xl border border-slate-700 bg-slate-950 p-4"><h3 className="font-semibold">{editingPayment ? 'Edit payment' : 'Add payment'}</h3><Input label="Date" type="date" value={paymentForm.date} onChange={event => setPaymentForm({ ...paymentForm, date: event.target.value })} /><Input label="Amount (৳)" type="number" min="0.01" step="any" value={paymentForm.amount} onChange={event => setPaymentForm({ ...paymentForm, amount: event.target.value })} /><Input label="Note (optional)" value={paymentForm.note} onChange={event => setPaymentForm({ ...paymentForm, note: event.target.value })} />{error && <p role="alert" className="text-xs text-rose-300">{error}</p>}<div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button><Button type="submit">Save</Button></div></form></div>}
    </Layout>
  );
};
