import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { EmailProvider } from './email.provider';

const mockProvider = {
  sendEmail: jest.fn(),
};

describe('EmailService', () => {
  let service: EmailService;
  let provider: typeof mockProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: 'EmailProvider', useValue: mockProvider },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    provider = mockProvider;
    jest.clearAllMocks();
  });

  it('should call provider.sendEmail', async () => {
    provider.sendEmail.mockResolvedValue(undefined);
    await service.sendEmail('to@test.com', 'Subject', '<p>Hi</p>');
    expect(provider.sendEmail).toHaveBeenCalledWith({
      to: 'to@test.com',
      subject: 'Subject',
      html: '<p>Hi</p>',
      text: 'Hi',
    });
  });

  it('should swallow provider errors', async () => {
    provider.sendEmail.mockRejectedValue(new Error('fail'));
    await expect(service.sendEmail('a@b.com', 'Sub', '<p>Hi</p>')).resolves.not.toThrow();
  });

  it('should send payment succeeded email', async () => {
    provider.sendEmail.mockResolvedValue(undefined);
    await service.sendPaymentSucceededEmail('user@test.com', { orderId: 'ord-1', amount: '100', currency: 'USD' });
    expect(provider.sendEmail).toHaveBeenCalled();
  });

  it('should send ticket purchased email', async () => {
    provider.sendEmail.mockResolvedValue(undefined);
    await service.sendTicketPurchasedEmail('user@test.com', {
      orderId: 'ord-1',
      tickets: [{ ticketCode: 'TCK-123', eventTitle: 'Event A', ticketType: 'VIP' }],
    });
    expect(provider.sendEmail).toHaveBeenCalled();
  });

  it('should send event cancelled email', async () => {
    provider.sendEmail.mockResolvedValue(undefined);
    await service.sendEventCancelledEmail('user@test.com', { eventTitle: 'Event X', eventId: 'evt-1' });
    expect(provider.sendEmail).toHaveBeenCalled();
  });

  it('should send ticket checked-in email', async () => {
    provider.sendEmail.mockResolvedValue(undefined);
    await service.sendTicketCheckedInEmail('user@test.com', {
      ticketCode: 'TCK-123',
      eventTitle: 'Event Y',
      checkedInAt: new Date('2025-01-01T10:00:00Z'),
    });
    expect(provider.sendEmail).toHaveBeenCalled();
  });
});