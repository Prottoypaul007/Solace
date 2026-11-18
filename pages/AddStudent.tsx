import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { addStudent } from '../services/storage';
import { v4 as uuidv4 } from 'uuid';

export const AddStudent: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    rate: '',
    phone: '',
  });
  const [errors, setErrors] = useState({
    name: '',
    subject: '',
    rate: '',
  });
  const [saveError, setSaveError] = useState('');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: keyof typeof formData
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors = {
      name: formData.name.trim() ? '' : 'Student name is required',
      subject: formData.subject.trim() ? '' : 'Subject is required',
      rate: Number.isFinite(Number(formData.rate)) && Number(formData.rate) > 0 ? '' : 'Enter a rate greater than zero',
    };
    setErrors(newErrors);

    if (newErrors.name || newErrors.subject || newErrors.rate) return;

    try {
      addStudent({
        id: uuidv4(),
        name: formData.name.trim(),
        subject: formData.subject.trim(),
        ratePerClass: Number(formData.rate),
        phone: formData.phone.trim(),
        createdAt: new Date().toISOString(),
      });
      navigate('/students');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save student.');
    }
  };

  return (
    <Layout title="Add student" showBack onBack={() => navigate(-1)}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4 space-y-4 shadow-md shadow-black/40">
          <Input
            label="Student name"
            value={formData.name}
            error={errors.name}
            onChange={(e) => handleChange(e, 'name')}
            placeholder="e.g. Rafi Hasan"
          />
          <Input
            label="Subject"
            value={formData.subject}
            error={errors.subject}
            onChange={(e) => handleChange(e, 'subject')}
            placeholder="e.g. Physics, Chemistry"
          />
          <Input
            label="Rate per class (৳)"
            type="number"
            value={formData.rate}
            error={errors.rate}
            onChange={(e) => handleChange(e, 'rate')}
            placeholder="e.g. 500"
          />
          <Input
            label="Phone (optional)"
            value={formData.phone}
            onChange={(e) => handleChange(e, 'phone')}
            placeholder="01XXXXXXXXX"
          />
        </div>

        <div className="space-y-2">
          {saveError && <p role="alert" className="text-sm text-rose-300">{saveError}</p>}
          <Button type="submit" fullWidth size="md">
            Save student
          </Button>
          <Button
            type="button"
            variant="outline"
            fullWidth
            size="md"
            onClick={() => navigate('/students')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Layout>
  );
};
