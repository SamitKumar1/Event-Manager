import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';

import type { EmailProvider } from './email.provider';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(@Inject('EmailProvider') private readonly provider: EmailProvider) {}

  async sendEmail(to: string, subject: string, html: string, text?: string): Promise<void> {
    try {
      await this.provider.sendEmail({ to, subject, html, text: text ?? this.stripHtml(html) });
    } catch (error: unknown) {
      this.logger.error(`Failed to send email to ${to}: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      // swallow error – email is secondary side effect
    }
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  // Payment succeeded email
  async sendPaymentSucceededEmail(_to: string, data: { orderId: string; amount: string; currency: string }) {
    await this.sendEmail(data.orderId, `Payment Successful – Order ${data.orderId}`, `
      <p>Hi,</p>
      <p>Your payment for order <strong>${data.orderId}</strong> was successful.</p>
      <p><strong>Amount:</strong> ${data.amount} ${data.currency}</p>
      <p>Thank you for your purchase!</p>
    `);
  }

  // Ticket purchased (multiple tickets) – summarize tickets
  async sendTicketPurchasedEmail(to: string, data: { orderId: string; tickets: Array<{ ticketCode: string; eventTitle: string; ticketType: string }> }) {
    const ticketList = data.tickets.map(t => `<li>${t.ticketCode} – ${t.eventTitle} (${t.ticketType})</li>`).join('');
    const html = `
      <p>Hi,</p>
      <p>Your ticket purchase was successful. Here are your tickets:</p>
      <ul>${ticketList}</ul>
      <p>Thank you for your purchase!</p>
    `;
    await this.sendEmail(to, `Your tickets for order`, html);
  }

  async sendEventCancelledEmail(to: string, data: { eventTitle: string; eventId: string }) {
    const html = `
      <p>Hi,</p>
      <p>The event <strong>${data.eventTitle}</strong> (ID: ${data.eventId}) has been cancelled.</p>
      <p>We apologize for any inconvenience.</p>
    `;
    await this.sendEmail(to, `Event Cancelled: ${data.eventTitle}`, html);
  }

  async sendTicketCheckedInEmail(to: string, data: { ticketCode: string; eventTitle: string; checkedInAt: Date }) {
    const html = `
      <p>Hi,</p>
      <p>Your ticket <strong>${data.ticketCode}</strong> for event <strong>${data.eventTitle}</strong> has been checked in at ${data.checkedInAt.toISOString()}.</p>
      <p>Enjoy the event!</p>
    `;
    await this.sendEmail(to, `Ticket Checked In: ${data.ticketCode}`, html);
  }
}