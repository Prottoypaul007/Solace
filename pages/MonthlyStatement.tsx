import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { getClassesByStudent, getPaymentsByStudent, getStudentById } from '../services/storage';
import { calculateMonthlyStatement, statementCsv } from '../services/statement';
import { saveStatementFile } from '../services/backupShare';

export const MonthlyStatement: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [notice, setNotice] = useState('');
  const student = id ? getStudentById(id) : undefined;
  const classes = id ? getClassesByStudent(id) : [];
  const payments = id ? getPaymentsByStudent(id) : [];
  const statement = useMemo(() => student && calculateMonthlyStatement(student, classes, payments, month), [student, classes, payments, month]);

  if (!student || !statement) return <Layout title="Statement" showBack onBack={() => navigate('/students')}><p>Student not found.</p></Layout>;

  const exportCsv = async () => {
    try {
      const result = await saveStatementFile(`solace-statement-${month}.csv`, statementCsv(student, month, statement));
      setNotice(result === 'shared' ? 'Choose where to save the statement.' : 'CSV download started. Check that the file was saved.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not export the statement.'); }
  };

  const share = async () => {
    const message = `${student.name} · ${month}\nClasses: ${statement.monthClasses.length}\nEarned: ৳${statement.earned}\nPaid: ৳${statement.paid}\nPrevious balance: ৳${statement.openingBalance}\nClosing balance: ৳${statement.closingBalance}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Solace monthly statement', text: message });
      else { await navigator.clipboard.writeText(message); setNotice('Statement copied to clipboard.'); }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setNotice('Could not share this statement.');
    }
  };

  return <Layout title="Monthly statement" showBack onBack={() => navigate(`/student/${id}`)}>
    <div className="space-y-4 pb-4">
      <div><h2 className="text-lg font-semibold">{student.name}</h2><p className="text-xs text-slate-400">Current rate: ৳{student.ratePerClass} per class. Earlier classes keep their charged rate after a rate change.</p></div>
      <Input label="Month" type="month" value={month} onChange={event => { if (event.target.value) setMonth(event.target.value); }} />
      <section className="space-y-2 rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-sm">
        <div className="flex justify-between"><span>Opening balance</span><strong>৳{statement.openingBalance.toLocaleString()}</strong></div>
        <div className="flex justify-between"><span>Classes ({statement.monthClasses.length})</span><strong>+ ৳{statement.earned.toLocaleString()}</strong></div>
        <div className="flex justify-between"><span>Payments</span><strong>- ৳{statement.paid.toLocaleString()}</strong></div>
        <div className="flex justify-between border-t border-slate-600 pt-2 text-base"><span>Closing balance</span><strong>৳{statement.closingBalance.toLocaleString()}</strong></div>
      </section>
      <div className="grid grid-cols-2 gap-2"><Button onClick={share}>Share summary</Button><Button variant="secondary" onClick={exportCsv}>Export CSV</Button></div>
      {notice && <p role="status" className="text-xs text-blue-200">{notice}</p>}
      <section className="space-y-2"><h3 className="text-sm font-semibold">This month</h3>
        {[...statement.monthClasses.map(item => ({ date: item.date, text: item.topic || 'Class', amount: item.rateCharged ?? student.ratePerClass })), ...statement.monthPayments.map(item => ({ date: item.date, text: item.note || 'Payment', amount: -item.amount }))]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((item, index) => <div key={`${item.date}-${index}`} className="flex justify-between gap-2 rounded-xl border border-slate-700 p-3 text-xs"><span>{item.date.slice(0, 10)} · {item.text}</span><span>{item.amount < 0 ? '-' : '+'} ৳{Math.abs(item.amount)}</span></div>)}
        {statement.monthClasses.length + statement.monthPayments.length === 0 && <p className="text-xs text-slate-400">No records this month.</p>}
      </section>
    </div>
  </Layout>;
};
