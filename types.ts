export interface Student {
  id: string;
  name: string;
  subject: string;
  ratePerClass: number;
  phone: string;
  createdAt: string;
  recovered?: boolean;
}

export interface ClassSession {
  id: string;
  studentId: string;
  date: string; // ISO string
  createdAt?: string; // When the class was logged; historical records may not have this.
  durationMinutes: number;
  rateCharged?: number; // Set for new classes; old records use the student's original rate until edited.
  topic?: string;
}

export interface Payment {
  id: string;
  studentId: string;
  date: string; // ISO string
  amount: number;
  note?: string;
}

export type TransactionType = 'CLASS' | 'PAYMENT';

export interface HistoryItem {
  id: string;
  type: TransactionType;
  date: string;
  description: string;
  value: number; // Duration for class, Amount for payment
}

export interface TestResult {
  id: string;
  studentId: string;
  testName: string;
  subject: string;
  maxMarks: number;
  obtainedMarks: number;
  percentage: number;
  date: string;
  notes?: string;
  sentToParent: boolean;
  sentDate?: string;
}

export interface ParentContact {
  id: string;
  studentId: string;
  parentName: string;
  relationship: string; // 'father', 'mother', 'guardian'
  phone?: string;
  email?: string;
  isPrimary: boolean;
}

export interface Communication {
  id: string;
  studentId: string;
  parentContactId: string;
  type: 'test_result' | 'announcement' | 'reminder';
  subject: string;
  message: string;
  testResultId?: string;
  sentDate: string;
  method: 'sms' | 'email' | 'both';
  status: 'sent' | 'delivered' | 'failed' | 'pending';
  messageId?: string; // SMS/Email service message ID
  error?: string; // Error message if sending failed
}
