import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailProvider } from './email.provider';

@Injectable()
export class MockEmailProvider implements EmailProvider {
  public sentEmails: Array<{ to: string; subject: string; html: string; text?: string }> = [];

  constructor(private configService: ConfigService) {}

  async sendEmail(params: { to: string; subject: string; html: string; text?: string }): Promise<void> {
    const forceFail = this.configService.get<string>('MOCK_EMAIL_FORCE_FAIL') === 'true';
    if (forceFail) {
      throw new Error('Mock email provider forced failure');
    }
    this.sentEmails.push({ ...params });
    // Simulate async send
    return Promise.resolve();
  }

  // Helper for tests
  getSentEmails() {
    return this.sentEmails;
  }

  clear() {
    this.sentEmails = [];
  }
}