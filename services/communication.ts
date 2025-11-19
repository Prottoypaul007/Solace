import { TestResult, ParentContact, Communication } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { smsService } from './sms';

// Storage keys
const TEST_RESULTS_KEY = 'test_results';
const PARENT_CONTACTS_KEY = 'parent_contacts';
const COMMUNICATIONS_KEY = 'communications';

// Test Results Management
export const addTestResult = (testResult: Omit<TestResult, 'id' | 'percentage'>): TestResult => {
  const percentage = Math.round((testResult.obtainedMarks / testResult.maxMarks) * 100);
  const newTestResult: TestResult = {
    ...testResult,
    id: uuidv4(),
    percentage,
  };
  
  const results = getTestResults();
  results.push(newTestResult);
  localStorage.setItem(TEST_RESULTS_KEY, JSON.stringify(results));
  return newTestResult;
};

export const getTestResults = (): TestResult[] => {
  const data = localStorage.getItem(TEST_RESULTS_KEY);
  return data ? JSON.parse(data) : [];
};

export const getTestResultsByStudent = (studentId: string): TestResult[] => {
  return getTestResults().filter(result => result.studentId === studentId);
};

export const updateTestResult = (testResult: TestResult): void => {
  const results = getTestResults();
  const index = results.findIndex(r => r.id === testResult.id);
  if (index !== -1) {
    results[index] = testResult;
    localStorage.setItem(TEST_RESULTS_KEY, JSON.stringify(results));
  }
};

export const deleteTestResult = (id: string): void => {
  const results = getTestResults().filter(r => r.id !== id);
  localStorage.setItem(TEST_RESULTS_KEY, JSON.stringify(results));
};

// Parent Contacts Management
export const addParentContact = (contact: Omit<ParentContact, 'id'>): ParentContact => {
  const newContact: ParentContact = {
    ...contact,
    id: uuidv4(),
  };
  
  const contacts = getParentContacts();
  contacts.push(newContact);
  localStorage.setItem(PARENT_CONTACTS_KEY, JSON.stringify(contacts));
  return newContact;
};

export const getParentContacts = (): ParentContact[] => {
  const data = localStorage.getItem(PARENT_CONTACTS_KEY);
  return data ? JSON.parse(data) : [];
};

export const getParentContactsByStudent = (studentId: string): ParentContact[] => {
  return getParentContacts().filter(contact => contact.studentId === studentId);
};

export const updateParentContact = (contact: ParentContact): void => {
  const contacts = getParentContacts();
  const index = contacts.findIndex(c => c.id === contact.id);
  if (index !== -1) {
    contacts[index] = contact;
    localStorage.setItem(PARENT_CONTACTS_KEY, JSON.stringify(contacts));
  }
};

export const deleteParentContact = (id: string): void => {
  const contacts = getParentContacts().filter(c => c.id !== id);
  localStorage.setItem(PARENT_CONTACTS_KEY, JSON.stringify(contacts));
};

// Communication Management
export const sendTestResultToParent = async (
  testResult: TestResult, 
  parentContact: ParentContact, 
  customMessage?: string
): Promise<Communication> => {
  // Get student info for the message
  const { getStudentById } = await import('./storage');
  const student = getStudentById(testResult.studentId);
  
  // Create formatted message
  const message = customMessage || smsService.formatTestResultMessage({
    studentName: student?.name || 'Student',
    testName: testResult.testName,
    subject: testResult.subject,
    obtainedMarks: testResult.obtainedMarks,
    maxMarks: testResult.maxMarks,
    percentage: testResult.percentage,
    date: testResult.date,
    notes: testResult.notes
  });

  const communication: Communication = {
    id: uuidv4(),
    studentId: testResult.studentId,
    parentContactId: parentContact.id,
    type: 'test_result',
    subject: `Test Result: ${testResult.testName}`,
    message,
    testResultId: testResult.id,
    sentDate: new Date().toISOString(),
    method: 'sms',
    status: 'pending'
  };

  try {
    // Check SMS permissions first
    const hasPermission = await smsService.checkSmsPermission();
    if (!hasPermission) {
      const permissionGranted = await smsService.requestSmsPermission();
      if (!permissionGranted) {
        throw new Error('SMS permission denied');
      }
    }

    // Send SMS if phone number is available
    if (parentContact.phone) {
      const smsResult = await smsService.sendSms({
        phone: parentContact.phone,
        message
      });

      if (smsResult.success) {
        communication.status = 'sent';
        communication.messageId = smsResult.messageId;
      } else {
        communication.status = 'failed';
        communication.error = smsResult.error;
      }
    } else {
      throw new Error('No phone number available for this contact');
    }

  } catch (error) {
    console.error('Error sending SMS:', error);
    communication.status = 'failed';
    communication.error = error instanceof Error ? error.message : 'Unknown error';
  }

  // Save communication
  const communications = getCommunications();
  communications.push(communication);
  localStorage.setItem(COMMUNICATIONS_KEY, JSON.stringify(communications));

  // Update test result as sent only if SMS was successful
  if (communication.status === 'sent') {
    updateTestResult({ ...testResult, sentToParent: true, sentDate: communication.sentDate });
  }

  return communication;
};

export const getCommunications = (): Communication[] => {
  const data = localStorage.getItem(COMMUNICATIONS_KEY);
  return data ? JSON.parse(data) : [];
};

export const getCommunicationsByStudent = (studentId: string): Communication[] => {
  return getCommunications().filter(comm => comm.studentId === studentId);
};

export const getUnsentTestResults = (): TestResult[] => {
  return getTestResults().filter(result => !result.sentToParent);
};
