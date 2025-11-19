import { SmsManager } from '@byteowls/capacitor-sms';
import { Capacitor } from '@capacitor/core';

export interface SmsOptions {
  phone: string;
  message: string;
}

export interface SmsResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

export class SmsService {
  private isNativeAvailable(): boolean {
    return Capacitor.isNativePlatform();
  }

  async sendSms(options: SmsOptions): Promise<SmsResult> {
    try {
      // Check if we're on a native platform
      if (!this.isNativeAvailable()) {
        console.warn('SMS is only available on native platforms');
        return this.simulateSms(options);
      }

      // Validate phone number (basic validation)
      if (!this.isValidPhoneNumber(options.phone)) {
        throw new Error('Invalid phone number format');
      }      // Send SMS using the plugin
      await SmsManager.send({
        numbers: [options.phone],
        text: options.message,
      });

      console.log('✅ SMS sent successfully:', {
        to: options.phone,
        message: options.message.substring(0, 50) + '...'
      });

      return {
        success: true,
        messageId: `sms_${Date.now()}`
      };

    } catch (error) {
      console.error('❌ SMS sending failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async checkSmsPermission(): Promise<boolean> {
    try {
      if (!this.isNativeAvailable()) {
        return true; // Simulate permission granted in web
      }      // SMS permission is handled by the system when sending
      return true;
    } catch (error) {
      console.error('Error checking SMS permission:', error);
      return false;
    }
  }

  async requestSmsPermission(): Promise<boolean> {
    try {
      if (!this.isNativeAvailable()) {
        return true; // Simulate permission granted in web
      }      // SMS permission will be requested automatically when sending
      return true;
    } catch (error) {
      console.error('Error requesting SMS permission:', error);
      return false;
    }
  }

  private isValidPhoneNumber(phone: string): boolean {
    // Basic phone number validation
    // Remove all non-digit characters except + at the beginning
    const cleaned = phone.replace(/[^\d+]/g, '');
    
    // Check if it's a valid format (international or local)
    // At least 10 digits, optionally starting with +
    return /^(\+)?[1-9]\d{9,14}$/.test(cleaned);
  }

  private async simulateSms(options: SmsOptions): Promise<SmsResult> {
    // Simulate SMS sending for web platform or testing
    console.log('📱 [SIMULATED] SMS would be sent:', {
      to: options.phone,
      message: options.message,
      timestamp: new Date().toISOString()
    });

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      success: true,
      messageId: `sim_${Date.now()}`
    };
  }

  formatTestResultMessage(testData: {
    studentName: string;
    testName: string;
    subject: string;
    obtainedMarks: number;
    maxMarks: number;
    percentage: number;
    date: string;
    notes?: string;
  }): string {
    return `📚 Test Result - ${testData.studentName}

🔸 Test: ${testData.testName}
🔸 Subject: ${testData.subject}
🔸 Score: ${testData.obtainedMarks}/${testData.maxMarks} (${testData.percentage}%)
🔸 Date: ${new Date(testData.date).toLocaleDateString()}
${testData.notes ? `\n📝 Notes: ${testData.notes}` : ''}

- Prottoy Paul`;
  }
}

// Export a singleton instance
export const smsService = new SmsService();
