import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { getCommunicationsByStudent, getParentContactsByStudent } from '../services/communication';
import { getStudentById } from '../services/storage';
import { Communication, Student, ParentContact } from '../types';
import { MessageCircle, Phone, Mail, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export const CommunicationHistory: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [parentContacts, setParentContacts] = useState<ParentContact[]>([]);

  useEffect(() => {
    if (studentId) {
      const studentData = getStudentById(studentId);
      if (studentData) {
        setStudent(studentData);
        setCommunications(getCommunicationsByStudent(studentId));
        setParentContacts(getParentContactsByStudent(studentId));
      } else {
        navigate('/students');
      }
    }
  }, [studentId, navigate]);

  const getParentName = (parentContactId: string) => {
    const contact = parentContacts.find(c => c.id === parentContactId);
    return contact?.parentName || 'Unknown Contact';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle size={16} className="text-green-400" />;
      case 'pending':
        return <Clock size={16} className="text-yellow-400" />;
      case 'failed':
        return <XCircle size={16} className="text-red-400" />;
      default:
        return <AlertCircle size={16} className="text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-500/20 border-green-400/60 text-green-300';
      case 'pending':
        return 'bg-yellow-500/20 border-yellow-400/60 text-yellow-300';
      case 'failed':
        return 'bg-red-500/20 border-red-400/60 text-red-300';
      default:
        return 'bg-gray-500/20 border-gray-400/60 text-gray-300';
    }
  };

  if (!student) return null;

  return (
    <Layout title={`Messages - ${student.name}`}>
      <div className="space-y-5">
        {/* Hero Section */}
        <section className="bg-gradient-to-r from-blue-600/80 via-blue-500/80 to-cyan-400/80 rounded-2xl px-4 py-4 shadow-lg shadow-blue-500/30 border border-white/20 text-white">
          <p className="text-xs uppercase tracking-[0.15em] font-semibold opacity-90">
            Communication History
          </p>
          <h2 className="mt-1 text-lg font-semibold">{student.name}'s Messages</h2>
          <p className="mt-1 text-[11px] opacity-90">
            View SMS attempts. Sent means Android accepted the send request; delivery is not confirmed.
          </p>
        </section>

        {/* Back Button */}
        <Button 
          variant="outline"
          onClick={() => navigate(`/student/${studentId}/tests`)}
          className="border-blue-600 text-blue-600 hover:bg-blue-50"
        >
          ← Back to Test Results
        </Button>

        {/* Communications List */}
        <div className="space-y-3">
          {communications.length === 0 ? (
            <div className="bg-slate-900/90 border border-slate-700 rounded-2xl p-8 shadow-md shadow-black/40 text-center">
              <MessageCircle size={48} className="mx-auto mb-4 text-slate-400" />
              <p className="text-lg font-semibold text-white mb-2">No messages sent yet</p>
              <p className="text-sm text-slate-400">Send test results to parents to see communication history.</p>
            </div>
          ) : (
            communications.map((comm) => (
              <div key={comm.id} className="bg-slate-900/90 border border-slate-700 rounded-2xl p-4 shadow-md shadow-black/40">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="h-10 w-10 bg-blue-500/20 border border-blue-400/60 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MessageCircle size={18} className="text-blue-300" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-white font-semibold">{comm.subject}</h3>
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border ${getStatusColor(comm.status)}`}>
                        {getStatusIcon(comm.status)}
                        {comm.status}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex items-center gap-4 text-sm text-slate-400 mb-3">
                      <span className="flex items-center gap-1">
                        <Phone size={12} />
                        {getParentName(comm.parentContactId)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(comm.sentDate).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1 capitalize">
                        {comm.method === 'sms' ? <Phone size={12} /> : <Mail size={12} />}
                        {comm.method}
                      </span>
                    </div>

                    {/* Message Preview */}
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 mb-3">
                      <p className="text-slate-300 text-sm leading-relaxed">
                        {comm.message.length > 200 
                          ? `${comm.message.substring(0, 200)}...` 
                          : comm.message}
                      </p>
                    </div>

                    {/* Error Message */}
                    {comm.error && (
                      <div className="bg-red-500/10 border border-red-400/30 rounded-xl p-3">
                        <p className="text-red-300 text-sm">
                          <strong>Error:</strong> {comm.error}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 pt-4">
          {communications.length > 0 && (
            <p>Showing {communications.length} message{communications.length !== 1 ? 's' : ''}</p>
          )}
        </div>
      </div>
    </Layout>
  );
};
