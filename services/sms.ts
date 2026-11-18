import { SmsManager } from '@byteowls/capacitor-sms';
import { Capacitor } from '@capacitor/core';

export interface SmsOptions { phone: string; message: string; }
export interface SmsResult { success: boolean; error?: string; messageId?: string; }

export class SmsService {
  async sendSms(options: SmsOptions): Promise<SmsResult> {
    if (!Capacitor.isNativePlatform()) {
      return { success: false, error: 'SMS can only be sent from the Android app.' };
    }
    const cleaned = options.phone.replace(/[^\d+]/g, '');
    if (!/^(\+)?[1-9]\d{9,14}$/.test(cleaned)) {
      return { success: false, error: 'Invalid phone number format.' };
    }
    try {
      await SmsManager.send({ numbers: [cleaned], text: options.message });
      return { success: true, messageId: `sms_${Date.now()}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'SMS could not be sent.' };
    }
  }

  async checkSmsPermission(): Promise<boolean> { return true; }
  async requestSmsPermission(): Promise<boolean> { return true; }

  formatTestResultMessage(testData: {
    studentName: string; testName: string; subject: string; obtainedMarks: number;
    maxMarks: number; percentage: number; date: string; notes?: string;
  }): string {
    return `Test Result - ${testData.studentName}\n\nTest: ${testData.testName}\nSubject: ${testData.subject}\nScore: ${testData.obtainedMarks}/${testData.maxMarks} (${testData.percentage}%)\nDate: ${new Date(testData.date).toLocaleDateString()}${testData.notes ? `\nNotes: ${testData.notes}` : ''}\n\n- Prottoy Paul`;
  }
}

export const smsService = new SmsService();
