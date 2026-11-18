import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { getStudentById } from '../services/storage';
import { 
  getTestResultsByStudent, 
  addTestResult, 
  deleteTestResult,
  getParentContactsByStudent,
  sendTestResultToParent
} from '../services/communication';
import { TestResult, Student, ParentContact } from '../types';
import { Plus, Send, Trash2, Award, Users, MessageCircle } from 'lucide-react';
import { smsService } from '../services/sms';
import { Capacitor } from '@capacitor/core';

export const TestResults: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [parentContacts, setParentContacts] = useState<ParentContact[]>([]);  const [showAddTest, setShowAddTest] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedTest, setSelectedTest] = useState<TestResult | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [formError, setFormError] = useState('');

  // Form data for new test
  const [formData, setFormData] = useState({
    testName: '',
    subject: '',
    maxMarks: '',
    obtainedMarks: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    if (studentId) {
      const studentData = getStudentById(studentId);
      if (studentData) {
        setStudent(studentData);
        setTestResults(getTestResultsByStudent(studentId));
        setParentContacts(getParentContactsByStudent(studentId));
      } else {
        navigate('/students');
      }
    }
  }, [studentId, navigate]);

  const handleAddTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) return;
    const maximum = Number(formData.maxMarks);
    const obtained = Number(formData.obtainedMarks);
    if (!formData.testName.trim() || !formData.date || !formData.maxMarks || !formData.obtainedMarks ||
        !Number.isFinite(maximum) || maximum <= 0 || !Number.isFinite(obtained) || obtained < 0 || obtained > maximum) {
      setFormError('Enter a name, date, maximum above zero, and a score between zero and the maximum.');
      return;
    }
    try {
      const newTest = addTestResult({
        studentId, testName: formData.testName.trim(), subject: formData.subject.trim() || student?.subject || '',
        maxMarks: maximum, obtainedMarks: obtained, date: new Date(`${formData.date}T12:00:00`).toISOString(),
        notes: formData.notes.trim(), sentToParent: false
      });
      setTestResults(prev => [...prev, newTest]);
      setFormData({ testName: '', subject: '', maxMarks: '', obtainedMarks: '', date: new Date().toISOString().split('T')[0], notes: '' });
      setFormError(''); setShowAddTest(false);
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Could not save test result.'); }
  };
  const handleSendToParent = async (testResult: TestResult, parentContact: ParentContact) => {
    setSendingMessage(true);
    try {
      const communication = await sendTestResultToParent(testResult, parentContact);
      
      if (communication.status === 'sent') {
        // Update UI to show as sent
        setTestResults(prev => 
          prev.map(test => 
            test.id === testResult.id 
              ? { ...test, sentToParent: true, sentDate: communication.sentDate }
              : test
          )
        );
        
        // Show success message
        alert(`✅ SMS sent successfully to ${parentContact.parentName}!`);
      } else {
        // Show error message
        alert(`❌ Failed to send SMS: ${communication.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
      alert(error instanceof Error ? error.message : 'Could not finish sending SMS.');
    } finally {
      setSendingMessage(false);
      setShowSendModal(false);
      setSelectedTest(null);
    }
  };

  const handleDeleteTest = (testId: string) => {
    try {
      deleteTestResult(testId);
      setTestResults(prev => prev.filter(test => test.id !== testId));
      setFormError('');
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Could not delete test result.'); }
  };
  const getGradeColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-green-500/20 border-green-400/60 text-green-300';
    if (percentage >= 80) return 'bg-blue-500/20 border-blue-400/60 text-blue-300';
    if (percentage >= 70) return 'bg-yellow-500/20 border-yellow-400/60 text-yellow-300';
    if (percentage >= 60) return 'bg-orange-500/20 border-orange-400/60 text-orange-300';
    return 'bg-red-500/20 border-red-400/60 text-red-300';
  };

  if (!student) return null;
  return (
    <Layout title={`Test Results - ${student.name}`}>
      <div className="space-y-5">
        {formError && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200">{formError}</p>}
        {/* Hero Section */}
        <section className="bg-gradient-to-r from-purple-600/80 via-purple-500/80 to-indigo-400/80 rounded-2xl px-4 py-4 shadow-lg shadow-purple-500/30 border border-white/20 text-white">
          <p className="text-xs uppercase tracking-[0.15em] font-semibold opacity-90">
            Academic Performance
          </p>
          <h2 className="mt-1 text-lg font-semibold">{student.name}'s Test Results</h2>
          <p className="mt-1 text-[11px] opacity-90">
            Track academic progress and share results with parents.
          </p>
        </section>        {/* Header Actions */}
        <div className="flex gap-3">
          <Button 
            onClick={() => setShowAddTest(true)} 
            className="flex-1 flex items-center justify-center gap-2 h-12 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
          >
            <Plus size={20} />
            Add Test Result
          </Button>
          <Button 
            variant="outline"
            onClick={() => navigate(`/student/${studentId}/parents`)}
            className="flex items-center gap-2 h-12 px-4 border-purple-600 text-purple-600 hover:bg-purple-50"
          >
            <Users size={20} />
            <span className="hidden sm:inline">Parents</span>
          </Button>
          <Button 
            variant="outline"
            onClick={() => navigate(`/student/${studentId}/messages`)}
            className="flex items-center gap-2 h-12 px-4 border-purple-600 text-purple-600 hover:bg-purple-50"
          >
            <MessageCircle size={20} />
            <span className="hidden sm:inline">Messages</span>
          </Button>
        </div>
        
        {parentContacts.length === 0 && (
          <div className="p-3 bg-amber-500/20 border border-amber-400/60 rounded-xl">
            <p className="text-xs text-amber-200 text-center">
              💡 Add parent contacts to send test results via SMS/Email
            </p>
          </div>
        )}        {/* Test Results List */}
        <div className="space-y-3">
          {testResults.length === 0 ? (
            <div className="bg-slate-900/90 border border-slate-700 rounded-2xl p-12 shadow-md shadow-black/40 text-center">
              <Award size={48} className="mx-auto mb-4 text-slate-400" />
              <p className="text-lg font-semibold text-white mb-2">No test results yet</p>
              <p className="text-sm text-slate-400">Add test results to track {student.name}'s academic progress.</p>
            </div>
          ) : (
            testResults.map((test) => (
              <div key={test.id} className="bg-slate-900/90 border border-slate-700 rounded-2xl p-4 shadow-md shadow-black/40">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-8 w-8 rounded-xl bg-purple-500/20 border border-purple-400/60 flex items-center justify-center">
                        <Award size={16} className="text-purple-300" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{test.testName}</h3>
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <span className="bg-purple-500/20 border border-purple-400/60 text-purple-300 px-2 py-1 rounded-lg">
                            {test.subject}
                          </span>
                          <span>
                            📅 {new Date(test.date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className={`inline-flex items-center px-3 py-1 rounded-xl text-base font-bold border ${getGradeColor(test.percentage)}`}>
                      {test.percentage}%
                    </div>
                    <p className="text-sm text-slate-400 mt-1">
                      {test.obtainedMarks}/{test.maxMarks} marks
                    </p>
                  </div>
                </div>

                {test.notes && (
                  <div className="mb-4 p-3 bg-purple-500/10 border border-purple-400/30 rounded-xl">
                    <p className="text-xs text-purple-300 font-medium">📝 Notes:</p>
                    <p className="text-sm text-purple-200 mt-1">{test.notes}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  {!test.sentToParent ? (
                    <button
                      onClick={() => {
                        setSelectedTest(test);
                        setShowSendModal(true);
                      }}
                      disabled={parentContacts.length === 0}
                      className="flex-1 flex items-center justify-center gap-2 h-10 bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 rounded-xl hover:bg-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send size={16} />
                      Send to Parent
                    </button>
                  ) : (
                    <div className="flex-1 text-center bg-emerald-500/20 border border-emerald-400/60 rounded-xl py-2">
                      <p className="text-xs font-medium text-emerald-300">
                        ✅ Sent on {new Date(test.sentDate!).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => handleDeleteTest(test.id)}
                    className="h-10 w-10 rounded-xl bg-red-500/20 border border-red-400/60 flex items-center justify-center hover:bg-red-500/30 transition-colors"
                  >
                    <Trash2 size={16} className="text-red-300" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>        {/* Add Test Modal */}
        {showAddTest && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-slate-900/95 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl shadow-black/60 max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-700">
                <h3 className="text-xl font-bold text-white text-center">Add Test Result</h3>
                <p className="text-sm text-slate-400 text-center mt-1">Record a new test score for {student.name}</p>
              </div>
              
              <form onSubmit={handleAddTest} className="p-6 space-y-5">
                {formError && <p role="alert" className="text-sm text-rose-300">{formError}</p>}
                <div>
                  <Input
                    label="Test/Exam Name"
                    placeholder="e.g. Mid-term Algebra Test"
                    value={formData.testName}
                    onChange={(e) => setFormData({...formData, testName: e.target.value})}
                    required
                    className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400 focus:border-purple-500"
                  />
                </div>
                
                <div>
                  <Input
                    label="Subject"
                    placeholder={student?.subject || "e.g. Mathematics"}
                    value={formData.subject}
                    onChange={(e) => setFormData({...formData, subject: e.target.value})}
                    className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400 focus:border-purple-500"
                  />
                </div>

                <div className="bg-purple-500/10 border border-purple-400/30 p-4 rounded-xl">
                  <h4 className="font-semibold text-purple-300 mb-3 text-center">Test Scores</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Input
                        label="Max Marks"
                        type="number"
                        min="0.01"
                        step="any"
                        placeholder="100"
                        value={formData.maxMarks}
                        onChange={(e) => setFormData({...formData, maxMarks: e.target.value})}
                        required
                        className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400 focus:border-purple-500"
                      />
                    </div>
                      <div>
                      <Input
                        label="Obtained Marks"
                        type="number"
                        min="0"
                        step="any"
                        placeholder="85"
                        value={formData.obtainedMarks}
                        onChange={(e) => {
                          const value = e.target.value;
                          const maxMarks = parseInt(formData.maxMarks);
                          const obtainedMarks = parseInt(value);
                          
                          // Prevent entering marks higher than maximum
                          if (value && maxMarks && obtainedMarks > maxMarks) {
                            return; // Don't update if obtained > max
                          }
                          setFormData({...formData, obtainedMarks: value});
                        }}
                        required
                        max={formData.maxMarks || undefined}
                        className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400 focus:border-purple-500"
                      />
                      {formData.maxMarks && formData.obtainedMarks && 
                       parseInt(formData.obtainedMarks) > parseInt(formData.maxMarks) && (
                        <p className="text-xs text-red-400 mt-1 pl-1">
                          ⚠️ Cannot be higher than maximum marks
                        </p>
                      )}
                    </div>
                  </div>
                    {/* Real-time percentage calculation with color coding */}
                  {Number(formData.maxMarks) > 0 && formData.obtainedMarks !== '' && (() => {
                    const percentage = Math.round((parseInt(formData.obtainedMarks) / parseInt(formData.maxMarks)) * 100);
                    const getPercentageStyle = (pct: number) => {
                      if (pct >= 90) return 'bg-green-500/20 border-green-400/60 text-green-300';
                      if (pct >= 80) return 'bg-blue-500/20 border-blue-400/60 text-blue-300';
                      if (pct >= 70) return 'bg-yellow-500/20 border-yellow-400/60 text-yellow-300';
                      if (pct >= 60) return 'bg-orange-500/20 border-orange-400/60 text-orange-300';
                      return 'bg-red-500/20 border-red-400/60 text-red-300';
                    };
                    
                    return (
                      <div className="mt-3 text-center">
                        <div className={`inline-flex items-center px-4 py-2 rounded-xl border ${getPercentageStyle(percentage)}`}>
                          <span className="text-sm mr-2">Score:</span>
                          <span className="text-lg font-bold">
                            {percentage}%
                          </span>
                          <span className="text-xs ml-2">
                            {percentage >= 90 ? '🌟 Excellent!' : 
                             percentage >= 80 ? '👍 Good' : 
                             percentage >= 70 ? '📚 Fair' : 
                             percentage >= 60 ? '⚠️ Needs work' : '📉 Poor'}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <Input
                    label="Test Date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    required
                    className="bg-slate-800 border-slate-600 text-white focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-300 mb-2 pl-1 block">Notes (Optional)</label>
                  <textarea
                    placeholder="Additional comments about performance, areas to improve, etc."
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="flex w-full rounded-xl border border-slate-600 bg-slate-800 text-white px-4 py-3 text-base placeholder:text-slate-400 focus:outline-none focus:ring-0 focus:border-purple-500 transition-colors resize-none"
                    rows={3}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddTest(false)}
                    className="flex-1 h-12 border-slate-600 text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 h-12 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                  >
                    Add Test
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}        {/* Send to Parent Modal */}
        {showSendModal && selectedTest && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-slate-900/95 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl shadow-black/60">
              <div className="p-6 border-b border-slate-700">
                <h3 className="text-xl font-bold text-white text-center">Send Test Result</h3>
                <p className="text-sm text-slate-400 text-center mt-1">Choose a parent to notify</p>
              </div>
              
              {parentContacts.length === 0 ? (
                <div className="p-6 text-center">
                  <Users size={48} className="mx-auto mb-4 text-slate-400" />
                  <p className="text-lg font-semibold text-white mb-2">No parent contacts</p>
                  <p className="text-sm text-slate-400 mb-6">Add a parent contact first to send test results</p>
                  <Button 
                    onClick={() => navigate(`/student/${studentId}/parents`)}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700"
                  >
                    Add Parent Contact
                  </Button>
                </div>
              ) : (
                <div className="p-6 space-y-5">
                  <div className="bg-purple-500/10 border border-purple-400/30 p-4 rounded-xl">
                    <div className="text-center">
                      <h4 className="font-bold text-purple-300 text-lg mb-1">{selectedTest.testName}</h4>
                      <p className="text-sm text-purple-400 mb-3">{selectedTest.subject}</p>
                      <div className="inline-flex items-center gap-4">
                        <div className={`px-3 py-1 rounded-xl font-bold border ${getGradeColor(selectedTest.percentage)}`}>
                          {selectedTest.percentage}%
                        </div>
                        <span className="text-purple-300 font-medium">
                          {selectedTest.obtainedMarks}/{selectedTest.maxMarks} marks
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs text-slate-300">Message preview</p>
                    <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-200">{smsService.formatTestResultMessage({ studentName: student.name, testName: selectedTest.testName, subject: selectedTest.subject, obtainedMarks: selectedTest.obtainedMarks, maxMarks: selectedTest.maxMarks, percentage: selectedTest.percentage, date: selectedTest.date, notes: selectedTest.notes })}</pre>
                    {!Capacitor.isNativePlatform() && <p className="text-xs text-amber-300">SMS sending is available only in the Android app.</p>}
                    <p className="font-semibold text-slate-300 text-center">Send to:</p>                    {parentContacts.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => handleSendToParent(selectedTest, contact)}
                        disabled={sendingMessage || !Capacitor.isNativePlatform()}
                        className="w-full p-4 bg-emerald-500/20 border border-emerald-400/60 hover:bg-emerald-500/30 rounded-xl text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-emerald-500/30 rounded-xl flex items-center justify-center">
                            {sendingMessage ? (
                              <div className="animate-spin h-4 w-4 border-2 border-emerald-300 border-t-transparent rounded-full"></div>
                            ) : (
                              <Users size={18} className="text-emerald-300" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-emerald-200 text-base">{contact.parentName}</p>
                            <p className="text-sm text-emerald-400 capitalize">{contact.relationship}</p>
                            <p className="text-xs text-emerald-500">
                              {contact.phone && `📱 ${contact.phone}`}
                              {contact.phone && contact.email && ' • '}
                              {contact.email && `📧 ${contact.email}`}
                            </p>
                          </div>
                          {sendingMessage ? (
                            <div className="text-emerald-300 text-xs">Sending...</div>
                          ) : (
                            <Send size={18} className="text-emerald-300" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>                  <Button
                    variant="outline"
                    onClick={() => setShowSendModal(false)}
                    disabled={sendingMessage}
                    className="w-full h-12 border-slate-600 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
};
