import { TestResult, ParentContact, Communication } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { smsService } from './sms';
import { DATA_KEYS, readList, writeBatch, writeList } from './dataStore';
import { validateTestMarks } from './validation';

// Storage keys
const TEST_RESULTS_KEY = 'test_results';
const PARENT_CONTACTS_KEY = 'parent_contacts';
const COMMUNICATIONS_KEY = 'communications';

// Test Results Management
export const addTestResult = (testResult: Omit<TestResult, 'id' | 'percentage'>): TestResult => {
  validateTestMarks(testResult.maxMarks, testResult.obtainedMarks);
  const percentage = Math.round((testResult.obtainedMarks / testResult.maxMarks) * 100);
  const newTestResult: TestResult = {
    ...testResult,
    id: uuidv4(),
    percentage,
  };
  
  const results = getTestResults();
  results.push(newTestResult);
  writeList(TEST_RESULTS_KEY, results);
  return newTestResult;
};

export const getTestResults = (): TestResult[] => readList<TestResult>(TEST_RESULTS_KEY);

export const getTestResultsByStudent = (studentId: string): TestResult[] => {
  return getTestResults().filter(result => result.studentId === studentId);
};

export const updateTestResult = (testResult: TestResult): void => {
  const results = getTestResults();
  const index = results.findIndex(r => r.id === testResult.id);
  if (index !== -1) {
    results[index] = testResult;
    writeList(TEST_RESULTS_KEY, results);
  }
};

export const deleteTestResult = (id: string): void => {
  const results = getTestResults().filter(r => r.id !== id);
  writeList(TEST_RESULTS_KEY, results);
};

// Parent Contacts Management
export const addParentContact = (contact: Omit<ParentContact, 'id'>): ParentContact => {
  const newContact: ParentContact = {
    ...contact,
    id: uuidv4(),
  };
  
  const contacts = getParentContacts();
  contacts.push(newContact);
  writeList(PARENT_CONTACTS_KEY, contacts);
  return newContact;
};

export const getParentContacts = (): ParentContact[] => readList<ParentContact>(PARENT_CONTACTS_KEY);

export const getParentContactsByStudent = (studentId: string): ParentContact[] => {
  return getParentContacts().filter(contact => contact.studentId === studentId);
};

export const updateParentContact = (contact: ParentContact): void => {
  const contacts = getParentContacts();
  const index = contacts.findIndex(c => c.id === contact.id);
  if (index !== -1) {
    contacts[index] = contact;
    writeList(PARENT_CONTACTS_KEY, contacts);
  }
};

export const deleteParentContact = (id: string): void => {
  const contacts = getParentContacts().filter(c => c.id !== id);
  writeList(PARENT_CONTACTS_KEY, contacts);
};

export const setPrimaryParentContact = (studentId: string, contactId: string): void => {
  writeList(PARENT_CONTACTS_KEY, getParentContacts().map(contact =>
    contact.studentId === studentId ? { ...contact, isPrimary: contact.id === contactId } : contact
  ));
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
  try {
    if (communication.status === 'sent') {
      writeBatch({
        [COMMUNICATIONS_KEY]: communications,
        [TEST_RESULTS_KEY]: getTestResults().map(result => result.id === testResult.id
          ? { ...result, sentToParent: true, sentDate: communication.sentDate } : result),
      });
    } else {
      writeList(COMMUNICATIONS_KEY, communications);
    }
  } catch (error) {
    if (communication.status === 'sent') {
      throw new Error('Android accepted the SMS, but Solace could not save its history. Check the recipient before trying again.');
    }
    throw error;
  }

  return communication;
};

export const getCommunications = (): Communication[] => readList<Communication>(COMMUNICATIONS_KEY);

export const getCommunicationsByStudent = (studentId: string): Communication[] => {
  return getCommunications().filter(comm => comm.studentId === studentId);
};

export const deleteStudentCommunicationData = (studentId: string): void => {
  writeBatch({
    [DATA_KEYS.testResults]: getTestResults().filter(result => result.studentId !== studentId),
    [DATA_KEYS.parentContacts]: getParentContacts().filter(contact => contact.studentId !== studentId),
    [DATA_KEYS.communications]: getCommunications().filter(comm => comm.studentId !== studentId),
  });
};

export const getUnsentTestResults = (): TestResult[] => {
  return getTestResults().filter(result => !result.sentToParent);
};
