import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import {
  getStudents,
  getClasses,
  getPayments,
  getStudentBalance,
} from '../services/storage';
import { getUnsentTestResults } from '../services/communication';
import { DollarSign, BookOpen, Users, Send } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalClasses: 0,
    totalEarnings: 0,
    pendingBalance: 0,
    unsentResults: 0,
  });

  useEffect(() => {
    const students = getStudents();
    const classes = getClasses();
    const payments = getPayments();
    const unsentResults = getUnsentTestResults();

    const totalEarnings = payments.reduce((sum, p) => sum + p.amount, 0);
    const pendingBalance = students.reduce(
      (sum, s) => sum + getStudentBalance(s.id),
      0
    );

    setStats({
      totalStudents: students.length,
      totalClasses: classes.length,
      totalEarnings,
      pendingBalance,
      unsentResults: unsentResults.length,
    });
  }, []);

  return (
    <Layout title="Overview">
      <div className="space-y-5">
        {/* Greeting / hero */}
        <section className="bg-gradient-to-r from-blue-600/80 via-blue-500/80 to-sky-400/80 rounded-2xl px-4 py-4 shadow-lg shadow-blue-500/30 border border-white/20 text-white">
          <p className="text-xs uppercase tracking-[0.15em] font-semibold opacity-90">
            Today&apos;s snapshot
          </p>
          <h2 className="mt-1 text-lg font-semibold">Your tutoring at a glance</h2>
          <p className="mt-1 text-[11px] opacity-90">
            See how many students, classes and payments you&apos;ve managed so far.
          </p>
        </section>

        {/* Main stats */}
        <section className="grid grid-cols-2 gap-3">
          {/* Students */}
          <div className="bg-slate-900/90 border border-slate-700 rounded-2xl p-3 shadow-md shadow-black/40 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Students</span>
              <span className="h-7 w-7 rounded-xl bg-blue-500/20 border border-blue-400/60 flex items-center justify-center">
                <Users size={16} className="text-blue-300" />
              </span>
            </div>
            <div className="text-2xl font-semibold">
              {stats.totalStudents.toString()}
            </div>
            <p className="text-[11px] text-slate-400">
              Active student profiles saved.
            </p>
          </div>

          {/* Classes */}
          <div className="bg-slate-900/90 border border-slate-700 rounded-2xl p-3 shadow-md shadow-black/40 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Classes</span>
              <span className="h-7 w-7 rounded-xl bg-emerald-500/15 border border-emerald-400/60 flex items-center justify-center">
                <BookOpen size={16} className="text-emerald-300" />
              </span>
            </div>
            <div className="text-2xl font-semibold">
              {stats.totalClasses.toString()}
            </div>
            <p className="text-[11px] text-slate-400">
              Total classes logged across students.
            </p>
          </div>

          {/* Total earnings */}
          <div className="bg-slate-900/90 border border-slate-700 rounded-2xl p-3 shadow-md shadow-black/40 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Total received</span>
              <span className="h-7 w-7 rounded-xl bg-emerald-500/20 border border-emerald-400/70 flex items-center justify-center">
                <DollarSign size={16} className="text-emerald-200" />
              </span>
            </div>
            <div className="text-xl font-semibold">
              ৳{stats.totalEarnings.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400">
              Payments you have already collected.
            </p>
          </div>

          {/* Pending */}
          <div className="bg-slate-900/90 border border-slate-700 rounded-2xl p-3 shadow-md shadow-black/40 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Pending</span>
              <span className="h-7 w-7 rounded-xl bg-amber-500/15 border border-amber-400/70 flex items-center justify-center">
                <DollarSign size={16} className="text-amber-200" />
              </span>
            </div>
            <div
              className={`text-xl font-semibold ${
                stats.pendingBalance > 0 ? 'text-amber-300' : 'text-emerald-300'
              }`}
            >
              ৳{stats.pendingBalance.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400">
              Amount to collect from all students.
            </p>
          </div>

          {/* Unsent test results */}
          <div className="bg-slate-900/90 border border-slate-700 rounded-2xl p-3 shadow-md shadow-black/40 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Unsent Results</span>
              <span className="h-7 w-7 rounded-xl bg-red-500/20 border border-red-400/60 flex items-center justify-center">
                <Send size={16} className="text-red-300" />
              </span>
            </div>
            <div className="text-2xl font-semibold">
              {stats.unsentResults.toString()}
            </div>
            <p className="text-[11px] text-slate-400">
              Test results yet to be sent to students.
            </p>
          </div>
        </section>

        <p className="text-center text-[10px] text-slate-500">
          All data is stored locally on this device. No internet required.
        </p>
      </div>
    </Layout>
  );
};
