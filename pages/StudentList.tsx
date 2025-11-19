import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Student } from '../types';
import { getStudents, getStudentBalance } from '../services/storage';
import { Button } from '../components/Button';
import { Plus, Search, ChevronRight } from 'lucide-react';

export const StudentList: React.FC = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setStudents(getStudents());
  }, []);

  const filtered = students.filter((s) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return (
      s.name.toLowerCase().includes(term) ||
      s.subject.toLowerCase().includes(term) ||
      s.phone.toLowerCase().includes(term)
    );
  });

  return (
    <Layout title="Students">
      <div className="space-y-4">
        {/* Top bar: search + add */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              size={18}
            />
            <input
              type="text"
              placeholder="Search by name, subject or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-3 rounded-xl border border-slate-700 bg-slate-900/70 text-sm text-slate-50 placeholder:text-slate-500 shadow-inner shadow-black/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button
            size="md"
            onClick={() => navigate('/add-student')}
            className="h-11 px-3 flex items-center gap-1.5"
          >
            <Plus size={16} />
            <span className="text-xs">Add</span>
          </Button>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="mt-6 flex flex-col items-center justify-center text-center text-slate-400 text-sm">
            <p>No students yet.</p>
            <p className="text-[11px] mt-1">
              Tap <span className="font-semibold">Add</span> to create your first
              student.
            </p>
          </div>
        ) : (
          <div className="space-y-3 mt-1">
            {filtered.map((s) => {
              const balance = getStudentBalance(s.id);

              return (
                <button
                  key={s.id}
                  onClick={() => navigate(`/student/${s.id}`)}
                  className="w-full text-left bg-slate-900/80 border border-slate-700 rounded-2xl px-3.5 py-3 shadow-md shadow-black/40 hover:border-blue-500/60 hover:bg-slate-900 flex items-center gap-3 transition-colors"
                >
                  <div className="h-10 w-10 rounded-2xl bg-blue-500/15 border border-blue-400/50 flex items-center justify-center text-xs font-semibold text-blue-100">
                    {s.name
                      .split(' ')
                      .map((p) => p[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-slate-50">
                        {s.name}
                      </span>
                      <ChevronRight size={18} className="text-slate-500" />
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-[11px] text-slate-400">
                          {s.subject}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Rate: ৳{s.ratePerClass}/class
                        </span>
                      </div>

                      {balance !== 0 && (
                        <span
                          className={`text-[11px] font-semibold px-3 py-1 rounded-full shadow-sm ${
                            balance > 0
                              ? 'bg-amber-500/10 text-amber-300 border border-amber-400/60'
                              : 'bg-emerald-500/10 text-emerald-300 border border-emerald-400/60'
                          }`}
                        >
                          {balance > 0 ? 'Due: ' : 'Advance: '}
                          ৳{Math.abs(balance)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};
