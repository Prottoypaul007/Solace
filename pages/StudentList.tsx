import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, Search, Users } from 'lucide-react';
import { Layout } from '../components/Layout';
import { getClasses, getStudentBalance, getStudents, sortStudentsByRecentClass } from '../services/storage';
import { getCommunications } from '../services/communication';
import { inferredRecoveredName, isRecoveredStudent } from '../services/recoveredStudents';

export const StudentList: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showRecovered, setShowRecovered] = useState(false);
  const allStudents = getStudents();
  const recovered = allStudents.filter(isRecoveredStudent);
  const students = allStudents.filter(student => showRecovered ? isRecoveredStudent(student) : !isRecoveredStudent(student));
  const messages = getCommunications();
  const classes = getClasses();
  const ordered = sortStudentsByRecentClass(students, classes);
  const term = search.trim().toLowerCase();
  const filtered = ordered.filter(student => !term || [student.name, student.subject, student.phone, inferredRecoveredName(student, messages) || ''].some(value => value.toLowerCase().includes(term)));
  const classCount = new Map<string, number>();
  for (const item of classes) classCount.set(item.studentId, (classCount.get(item.studentId) || 0) + 1);

  return <Layout title="Students">
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input aria-label="Search students" type="search" placeholder="Search students" value={search} onChange={event => setSearch(event.target.value)} className="h-12 w-full rounded-2xl border border-white/10 bg-slate-900 pl-12 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/25" />
        </div>
        <button aria-label="Add student" onClick={() => navigate('/add-student')} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-500/20 active:bg-blue-600"><Plus size={23} /></button>
      </div>

      {recovered.length > 0 && <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-900 p-1" aria-label="Student groups">
        <button type="button" aria-pressed={!showRecovered} onClick={() => setShowRecovered(false)} className={`min-h-11 rounded-xl px-3 text-sm font-semibold ${!showRecovered ? 'bg-blue-600 text-white' : 'text-slate-300'}`}>Students ({allStudents.length - recovered.length})</button>
        <button type="button" aria-pressed={showRecovered} onClick={() => setShowRecovered(true)} className={`min-h-11 rounded-xl px-3 text-sm font-semibold ${showRecovered ? 'bg-blue-600 text-white' : 'text-slate-300'}`}>Imported records ({recovered.length})</button>
      </div>}
      {showRecovered && <p className="text-sm leading-5 text-slate-400">These records are preserved. Add a student with a unique matching name to link them automatically. If the name is unknown, open the imported entry and edit its details.</p>}
      <div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-300">{filtered.length} {showRecovered ? 'imported record' : 'student'}{filtered.length === 1 ? '' : 's'}</p><p className="text-xs text-slate-500">Recently logged first</p></div>

      {filtered.length === 0 ? <div className="flex flex-col items-center rounded-3xl border border-dashed border-white/15 bg-slate-900/60 p-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300"><Users size={27} /></span>
        <h2 className="mt-4 text-lg font-semibold">{term ? 'No matching students' : showRecovered ? 'No imported records' : 'Add your first student'}</h2>
        <p className="mt-2 text-sm leading-5 text-slate-400">{term ? 'Try a different name, subject, or phone number.' : showRecovered ? 'Imported records with missing student profiles will appear here.' : 'Students, classes, payments, and progress will appear here.'}</p>
        {!term && !showRecovered && <button onClick={() => navigate('/add-student')} className="mt-5 min-h-11 rounded-xl bg-blue-500 px-5 text-sm font-semibold">Add student</button>}
      </div> : <div className="space-y-3">
        {filtered.map((student, index) => {
          const balance = getStudentBalance(student.id);
          const count = classCount.get(student.id) || 0;
          return <button key={student.id} onClick={() => navigate(`/student/${student.id}`)} className="w-full rounded-2xl border border-white/10 bg-slate-900 p-4 text-left shadow-sm shadow-black/15 transition-colors active:border-blue-400/50 active:bg-slate-800">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 text-base font-bold text-blue-200">{student.name.trim().slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-base font-semibold">{student.name}</span><span className="mt-0.5 block truncate text-sm text-slate-400">{showRecovered ? `Possible name: ${inferredRecoveredName(student, messages) || 'Unknown'}` : student.subject}</span></span>
              {showRecovered ? <span className="shrink-0 text-xs font-semibold text-blue-300">Review & edit</span> : <ArrowRight size={18} className="shrink-0 text-slate-500" />}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3 text-xs">
              <span className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-slate-300">{count} class{count === 1 ? '' : 'es'}</span>
              {index === 0 && !term && count > 0 && <span className="rounded-lg bg-blue-500/15 px-2.5 py-1.5 font-semibold text-blue-300">Recent</span>}
              <span className={`ml-auto rounded-lg px-2.5 py-1.5 font-semibold ${balance > 0 ? 'bg-amber-500/15 text-amber-200' : balance < 0 ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-800 text-slate-400'}`}>
                {balance > 0 ? `Due ৳${balance.toLocaleString('en-BD')}` : balance < 0 ? `Advance ৳${Math.abs(balance).toLocaleString('en-BD')}` : 'No due'}
              </span>
            </div>
          </button>;
        })}
      </div>}
    </div>
  </Layout>;
};
