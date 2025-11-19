import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import type { Student, HistoryItem } from '../types';
import {
  getStudentById,
  getClassesByStudent,
  getPaymentsByStudent,
  addClassSession,
  addPayment,
  deleteStudent,
  getStudentBalance,
} from '../services/storage';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import {
  Plus,
  DollarSign,
  Trash2,
  Phone,
  Clock,
  Calendar,
  BookOpen,
  ArrowLeft,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

export const StudentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [student, setStudent] = useState<Student | undefined>();
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [totalClasses, setTotalClasses] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);

  const [showClassModal, setShowClassModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [classDuration, setClassDuration] = useState<string>('');
  const [classTopic, setClassTopic] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentNote, setPaymentNote] = useState<string>('');

  // Load student + stats
  useEffect(() => {
    if (!id) return;

    const s = getStudentById(id);
    if (!s) {
      navigate('/students');
      return;
    }
    setStudent(s);

    const classes = getClassesByStudent(id);
    const payments = getPaymentsByStudent(id);

    setBalance(getStudentBalance(id));

    setTotalClasses(classes.length);
    setTotalMinutes(
      classes.reduce((sum: number, c: any) => sum + (c.durationMinutes || 0), 0)
    );
    setTotalPaid(
      payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
    );

    // Build combined history
    const classItems: HistoryItem[] = classes.map((c: any) => ({
      id: c.id,
      type: 'CLASS',
      date: c.date,
      description: c.topic
        ? `Class: ${c.topic}`
        : `Class (${c.durationMinutes} min)`,
      value: c.durationMinutes,
    }));

    const paymentItems: HistoryItem[] = payments.map((p: any) => ({
      id: p.id,
      type: 'PAYMENT',
      date: p.date,
      description: p.note ? p.note : 'Payment received',
      value: p.amount,
    }));

    const combined = [...classItems, ...paymentItems].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    setHistory(combined);
  }, [id, navigate]);

  const formattedTotalHours = useMemo(() => {
    if (!totalMinutes) return '0 min';
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (mins === 0) return `${hours} hr${hours > 1 ? 's' : ''}`;
    return `${hours} hr ${mins} min`;
  }, [totalMinutes]);

  if (!student) {
    return (
      <Layout title="Student" showBack onBack={() => navigate('/students')}>
        <div className="flex items-center justify-center h-full text-slate-400 text-sm">
          Student not found.
        </div>
      </Layout>
    );
  }

  const handleAddClass = () => {
    const minutes = Number(classDuration);

    if (!minutes || minutes <= 0) return;

    addClassSession({
      id: uuidv4(),
      studentId: student.id,
      date: new Date().toISOString(),
      durationMinutes: minutes,
      topic: classTopic.trim() || undefined,
    });

    // Refresh
    setShowClassModal(false);
    setClassDuration('');
    setClassTopic('');
    // Force reload by re-running effect logic:
    const classes = getClassesByStudent(student.id);
    const payments = getPaymentsByStudent(student.id);

    setTotalClasses(classes.length);
    setTotalMinutes(
      classes.reduce((sum: number, c: any) => sum + (c.durationMinutes || 0), 0)
    );
    setTotalPaid(
      payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
    );
    setBalance(getStudentBalance(student.id));

    const classItems: HistoryItem[] = classes.map((c: any) => ({
      id: c.id,
      type: 'CLASS',
      date: c.date,
      description: c.topic
        ? `Class: ${c.topic}`
        : `Class (${c.durationMinutes} min)`,
      value: c.durationMinutes,
    }));

    const paymentItems: HistoryItem[] = payments.map((p: any) => ({
      id: p.id,
      type: 'PAYMENT',
      date: p.date,
      description: p.note ? p.note : 'Payment received',
      value: p.amount,
    }));

    const combined = [...classItems, ...paymentItems].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    setHistory(combined);
  };

  const handleAddPayment = () => {
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) return;

    addPayment({
      id: uuidv4(),
      studentId: student.id,
      date: new Date().toISOString(),
      amount,
      note: paymentNote.trim() || undefined,
    });

    // Refresh
    setShowPaymentModal(false);
    setPaymentAmount('');
    setPaymentNote('');

    const classes = getClassesByStudent(student.id);
    const payments = getPaymentsByStudent(student.id);

    setTotalClasses(classes.length);
    setTotalMinutes(
      classes.reduce((sum: number, c: any) => sum + (c.durationMinutes || 0), 0)
    );
    setTotalPaid(
      payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
    );
    setBalance(getStudentBalance(student.id));

    const classItems: HistoryItem[] = classes.map((c: any) => ({
      id: c.id,
      type: 'CLASS',
      date: c.date,
      description: c.topic
        ? `Class: ${c.topic}`
        : `Class (${c.durationMinutes} min)`,
      value: c.durationMinutes,
    }));

    const paymentItems: HistoryItem[] = payments.map((p: any) => ({
      id: p.id,
      type: 'PAYMENT',
      date: p.date,
      description: p.note ? p.note : 'Payment received',
      value: p.amount,
    }));

    const combined = [...classItems, ...paymentItems].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    setHistory(combined);
  };

  const handleDeleteStudent = () => {
    const ok = window.confirm(
      `Delete ${student.name}? All classes and payments for this student will be removed from this device.`
    );
    if (!ok) return;

    deleteStudent(student.id);
    navigate('/students');
  };

  const chipText =
    balance === 0
      ? 'No due'
      : balance > 0
      ? `Due ৳${balance}`
      : `Advance ৳${Math.abs(balance)}`;

  const chipClasses =
    balance === 0
      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-400/60'
      : balance > 0
      ? 'bg-amber-500/10 text-amber-300 border border-amber-400/70'
      : 'bg-sky-500/10 text-sky-300 border border-sky-400/70';

  return (
    <Layout
      title={student.name}
      showBack
      onBack={() => navigate('/students')}
    >
      <div className="space-y-4">
        {/* Student Info Card */}
        <section className="bg-slate-900/85 border border-slate-700 rounded-2xl p-4 shadow-lg shadow-black/40">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-2xl bg-blue-500/20 border border-blue-400/60 flex items-center justify-center text-sm font-semibold text-blue-100">
                {student.name
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-50">
                    {student.name}
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-600 text-slate-300">
                    {student.subject}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-300">
                  <DollarSign size={14} className="text-emerald-300" />
                  <span>Rate: ৳{student.ratePerClass} per class</span>
                </div>

                {student.phone && (
                  <a
                    href={`tel:${student.phone}`}
                    className="inline-flex items-center gap-1.5 text-[11px] text-sky-300 mt-1 hover:underline"
                  >
                    <Phone size={13} />
                    <span>{student.phone}</span>
                  </a>
                )}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteStudent}
              className="px-2 py-1 h-8 text-[11px] border-rose-500/60 text-rose-300 hover:bg-rose-500/10"
            >
              <Trash2 size={13} className="mr-1" />
              Delete
            </Button>
          </div>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span
              className={`text-[11px] px-3 py-1 rounded-full ${chipClasses}`}
            >
              {chipText}
            </span>
            <span className="text-[10px] text-slate-500">
              All data stored locally on this device.
            </span>
          </div>
        </section>

        {/* Stats row */}
        <section className="grid grid-cols-3 gap-2">
          <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-3 flex flex-col gap-1 shadow-md shadow-black/40">
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <BookOpen size={12} />
              Classes
            </span>
            <span className="text-lg font-semibold text-slate-50">
              {totalClasses}
            </span>
            <span className="text-[10px] text-slate-500">
              Logged for this student
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-3 flex flex-col gap-1 shadow-md shadow-black/40">
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <Clock size={12} />
              Time
            </span>
            <span className="text-lg font-semibold text-slate-50">
              {formattedTotalHours}
            </span>
            <span className="text-[10px] text-slate-500">
              Total class duration
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-3 flex flex-col gap-1 shadow-md shadow-black/40">
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <DollarSign size={12} />
              Paid
            </span>
            <span className="text-lg font-semibold text-emerald-300">
              ৳{totalPaid.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500">
              Total received
            </span>
          </div>
        </section>

        {/* Actions */}
        <section className="flex gap-2">
          <Button
            fullWidth
            size="md"
            onClick={() => setShowClassModal(true)}
            className="flex items-center justify-center gap-1.5"
          >
            <Plus size={16} />
            <span className="text-xs">Add class</span>
          </Button>
          <Button
            fullWidth
            size="md"
            variant="secondary"
            onClick={() => setShowPaymentModal(true)}
            className="flex items-center justify-center gap-1.5"
          >
            <DollarSign size={16} />
            <span className="text-xs">Add payment</span>
          </Button>
          <Button
            fullWidth
            size="md"
            variant="outline"
            onClick={() => navigate(`/student/${id}/tests`)}
            className="flex items-center justify-center gap-1.5"
          >
            <BookOpen size={16} />
            <span className="text-xs">Test results</span>
          </Button>
        </section>

        {/* History */}
        <section className="mt-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-slate-200 tracking-wide">
              HISTORY
            </h3>
            <span className="text-[10px] text-slate-500">
              {history.length} record{history.length !== 1 ? 's' : ''}
            </span>
          </div>

          {history.length === 0 ? (
            <div className="mt-4 text-center text-slate-500 text-sm">
              No history yet. Add a class or payment to start tracking.
            </div>
          ) : (
            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 no-scrollbar">
              {history.map((item) => {
                const isClass = item.type === 'CLASS';
                const dateLabel = format(
                  new Date(item.date),
                  'dd MMM yyyy, h:mm a'
                );

                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="flex gap-2 items-start"
                  >
                    {/* Timeline bullet */}
                    <div className="flex flex-col items-center mt-1">
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${
                          isClass
                            ? 'bg-sky-400 shadow-[0_0_0_3px] shadow-sky-500/30'
                            : 'bg-emerald-400 shadow-[0_0_0_3px] shadow-emerald-500/30'
                        }`}
                      />
                      <div className="flex-1 w-px bg-slate-700/80 mt-1" />
                    </div>

                    <div className="flex-1 bg-slate-900/80 border border-slate-800 rounded-2xl px-3 py-2.5 shadow-sm shadow-black/50">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {isClass ? (
                            <BookOpen
                              size={14}
                              className="text-sky-300 flex-shrink-0"
                            />
                          ) : (
                            <DollarSign
                              size={14}
                              className="text-emerald-300 flex-shrink-0"
                            />
                          )}
                          <span className="text-xs font-semibold text-slate-50">
                            {item.description}
                          </span>
                        </div>
                        <span
                          className={`text-[11px] font-semibold ${
                            isClass ? 'text-sky-300' : 'text-emerald-300'
                          }`}
                        >
                          {isClass
                            ? `${item.value} min`
                            : `৳${item.value.toLocaleString()}`}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                        <Calendar size={11} />
                        <span>{dateLabel}</span>
                        <span className="mx-1 text-slate-700">•</span>
                        <span>{isClass ? 'Class' : 'Payment'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* CLASS MODAL */}
      {showClassModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60">
          <div className="bg-slate-950 border border-slate-700 rounded-2xl px-4 py-4 w-full max-w-xs shadow-2xl shadow-black/70">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-100">
                Add class
              </h3>
              <button
                onClick={() => setShowClassModal(false)}
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
              >
                <ArrowLeft size={12} />
                Close
              </button>
            </div>

            <p className="text-[11px] text-slate-400 mb-3">
              Enter class duration and topic (optional).
            </p>

            <div className="space-y-3 mb-3">
              <Input
                label="Duration (minutes)"
                type="number"
                value={classDuration}
                onChange={(e) => setClassDuration(e.target.value)}
                placeholder="e.g. 60"
              />
              <Input
                label="Topic (optional)"
                value={classTopic}
                onChange={(e) => setClassTopic(e.target.value)}
                placeholder="e.g. Chapter 5: Trigonometry"
              />
            </div>

            <div className="flex gap-2 mt-2">
              <Button
                fullWidth
                variant="outline"
                size="sm"
                onClick={() => setShowClassModal(false)}
              >
                Cancel
              </Button>
              <Button fullWidth size="sm" onClick={handleAddClass}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60">
          <div className="bg-slate-950 border border-slate-700 rounded-2xl px-4 py-4 w-full max-w-xs shadow-2xl shadow-black/70">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-100">
                Add payment
              </h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
              >
                <ArrowLeft size={12} />
                Close
              </button>
            </div>

            <p className="text-[11px] text-slate-400 mb-3">
              Enter how much you received from this student.
            </p>

            <div className="space-y-3 mb-3">
              <Input
                label="Amount (৳)"
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="e.g. 1500"
              />
              <Input
                label="Note (optional)"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="e.g. October 2nd week payment"
              />
            </div>

            <div className="flex gap-2 mt-2">
              <Button
                fullWidth
                variant="outline"
                size="sm"
                onClick={() => setShowPaymentModal(false)}
              >
                Cancel
              </Button>
              <Button fullWidth size="sm" onClick={handleAddPayment}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
