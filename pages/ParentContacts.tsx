import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { getStudentById } from '../services/storage';
import { 
  getParentContactsByStudent, 
  addParentContact, 
  updateParentContact,
  deleteParentContact,
  setPrimaryParentContact
} from '../services/communication';
import { ParentContact, Student } from '../types';
import { Plus, Phone, Mail, Edit2, Trash2, Users, Star } from 'lucide-react';

export const ParentContacts: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [contacts, setContacts] = useState<ParentContact[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState<ParentContact | null>(null);
  const [saveError, setSaveError] = useState('');
  
  const [formData, setFormData] = useState({
    parentName: '',
    relationship: 'father',
    phone: '',
    email: '',
    isPrimary: false
  });

  useEffect(() => {
    if (studentId) {
      const studentData = getStudentById(studentId);
      if (studentData) {
        setStudent(studentData);
        setContacts(getParentContactsByStudent(studentId));
      } else {
        navigate('/students');
      }
    }
  }, [studentId, navigate]);

  const resetForm = () => {
    setFormData({
      parentName: '',
      relationship: 'father',
      phone: '',
      email: '',
      isPrimary: false
    });
    setEditingContact(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !formData.parentName) return;

    try {
    if (editingContact) {
      // Update existing contact
      const updatedContact: ParentContact = {
        ...editingContact,
        ...formData
      };
      updateParentContact(updatedContact);
      setContacts(prev => 
        prev.map(contact => 
          contact.id === editingContact.id ? updatedContact : contact
        )
      );
    } else {
      // Add new contact
      const newContact = addParentContact({
        studentId,
        ...formData
      });
      setContacts(prev => [...prev, newContact]);
    }

    resetForm();
    setShowAddModal(false);
    setSaveError('');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save contact.');
    }
  };

  const handleEdit = (contact: ParentContact) => {
    setFormData({
      parentName: contact.parentName,
      relationship: contact.relationship,
      phone: contact.phone || '',
      email: contact.email || '',
      isPrimary: contact.isPrimary
    });
    setEditingContact(contact);
    setShowAddModal(true);
  };

  const handleDelete = (contactId: string) => {
    if (confirm('Are you sure you want to delete this contact?')) {
      try {
        deleteParentContact(contactId);
        setContacts(prev => prev.filter(contact => contact.id !== contactId));
        setSaveError('');
      } catch (error) { setSaveError(error instanceof Error ? error.message : 'Could not delete contact.'); }
    }
  };

  const handleSetPrimary = (contactId: string) => {
    if (!studentId) return;
    try {
      setPrimaryParentContact(studentId, contactId);
      setContacts(getParentContactsByStudent(studentId));
      setSaveError('');
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Could not update contact.'); }
  };

  if (!student) return null;
  return (
    <Layout title={`Parent Contacts - ${student.name}`}>
      <div className="space-y-5">
        {saveError && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200">{saveError}</p>}
        
        {/* Hero Section */}
        <section className="bg-gradient-to-r from-emerald-600/80 via-emerald-500/80 to-teal-400/80 rounded-2xl px-4 py-4 shadow-lg shadow-emerald-500/30 border border-white/20 text-white">
          <p className="text-xs uppercase tracking-[0.15em] font-semibold opacity-90">
            Parent Management
          </p>
          <h2 className="mt-1 text-lg font-semibold">{student.name}'s Family Contacts</h2>
          <p className="mt-1 text-[11px] opacity-90">
            Manage parent and guardian information for easy communication.
          </p>
        </section>

        {/* Header Actions */}
        <div className="flex gap-3">
          <Button 
            onClick={() => setShowAddModal(true)} 
            className="flex-1 flex items-center justify-center gap-2 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            <Plus size={20} />
            Add Parent Contact
          </Button>
          <Button 
            variant="outline"
            onClick={() => navigate(`/student/${studentId}/tests`)}
            className="flex items-center gap-2 h-12 px-6 border-emerald-600 text-emerald-600 hover:bg-emerald-50"
          >
            Test Results
          </Button>
        </div>        {/* Contacts List */}
        <div className="space-y-3">
          {contacts.length === 0 ? (
            <div className="bg-slate-900/90 border border-slate-700 rounded-2xl p-8 shadow-md shadow-black/40 text-center">
              <Users size={48} className="mx-auto mb-4 text-slate-400" />
              <p className="text-lg font-semibold text-white mb-2">No parent contacts yet</p>
              <p className="text-sm text-slate-400">Add parent contacts to send test results and communications.</p>
            </div>
          ) : (
            contacts.map((contact) => (
              <div key={contact.id} className="bg-slate-900/90 border border-slate-700 rounded-2xl p-4 shadow-md shadow-black/40">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-8 w-8 rounded-xl bg-emerald-500/20 border border-emerald-400/60 flex items-center justify-center">
                        <Users size={16} className="text-emerald-300" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-white">{contact.parentName}</h3>
                          {contact.isPrimary && (
                            <span className="h-5 w-5 rounded-full bg-yellow-500/20 border border-yellow-400/60 flex items-center justify-center">
                              <Star size={12} className="text-yellow-300 fill-yellow-300" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 capitalize">
                          {contact.relationship}
                          {contact.isPrimary && ' • Primary Contact'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-1 ml-11">
                      {contact.phone && (
                        <a 
                          href={`tel:${contact.phone}`}
                          className="flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200 transition-colors"
                        >
                          <Phone size={14} />
                          {contact.phone}
                        </a>
                      )}
                      {contact.email && (
                        <a 
                          href={`mailto:${contact.email}`}
                          className="flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200 transition-colors"
                        >
                          <Mail size={14} />
                          {contact.email}
                        </a>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {!contact.isPrimary && (
                      <button
                        onClick={() => handleSetPrimary(contact.id)}
                        className="h-8 w-8 rounded-xl bg-yellow-500/20 border border-yellow-400/60 flex items-center justify-center hover:bg-yellow-500/30 transition-colors"
                        title="Set as primary contact"
                      >
                        <Star size={14} className="text-yellow-300" />
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(contact)}
                      className="h-8 w-8 rounded-xl bg-blue-500/20 border border-blue-400/60 flex items-center justify-center hover:bg-blue-500/30 transition-colors"
                    >
                      <Edit2 size={14} className="text-blue-300" />
                    </button>
                    <button
                      onClick={() => handleDelete(contact.id)}
                      className="h-8 w-8 rounded-xl bg-red-500/20 border border-red-400/60 flex items-center justify-center hover:bg-red-500/30 transition-colors"
                    >
                      <Trash2 size={14} className="text-red-300" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>        {/* Add/Edit Contact Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-slate-900/95 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl shadow-black/60 max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-700">
                <h3 className="text-xl font-bold text-white text-center">
                  {editingContact ? 'Edit Contact' : 'Add Parent Contact'}
                </h3>
                <p className="text-sm text-slate-400 text-center mt-1">
                  {editingContact ? 'Update contact information' : 'Add a new parent or guardian contact'}
                </p>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div>
                  <Input
                    label="Parent/Guardian Name"
                    placeholder="e.g. John Smith"
                    value={formData.parentName}
                    onChange={(e) => setFormData({...formData, parentName: e.target.value})}
                    required
                    className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400 focus:border-emerald-500"
                  />
                </div>
                
                <div className="flex flex-col space-y-1 w-full">
                  <label className="text-sm font-semibold text-slate-300 mb-2 pl-1">Relationship</label>
                  <select
                    value={formData.relationship}
                    onChange={(e) => setFormData({...formData, relationship: e.target.value})}
                    className="flex h-12 w-full rounded-xl border border-slate-600 bg-slate-800 text-white px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="father">Father</option>
                    <option value="mother">Mother</option>
                    <option value="guardian">Guardian</option>
                    <option value="uncle">Uncle</option>
                    <option value="aunt">Aunt</option>
                    <option value="grandparent">Grandparent</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <Input
                    label="Phone Number"
                    type="tel"
                    placeholder="+1 234 567 8900"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <Input
                    label="Email Address"
                    type="email"
                    placeholder="parent@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-400 focus:border-emerald-500"
                  />
                </div>

                <label className="flex items-center gap-3 p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
                  <input
                    type="checkbox"
                    checked={formData.isPrimary}
                    onChange={(e) => setFormData({...formData, isPrimary: e.target.checked})}
                    className="w-4 h-4 text-emerald-600 bg-slate-700 border-slate-600 rounded focus:ring-emerald-500 focus:ring-2"
                  />
                  <span className="text-sm font-medium text-slate-300">
                    Set as primary contact
                  </span>
                </label>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddModal(false);
                      resetForm();
                    }}
                    className="flex-1 h-12 border-slate-600 text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    {editingContact ? 'Update' : 'Add'} Contact
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
};
