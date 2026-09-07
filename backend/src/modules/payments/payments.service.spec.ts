import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PaymentStatus, OrderStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { TicketsService } from '../tickets/tickets.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';

import { PaymentProvider } from './providers/payment-provider.interface';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

type TransactionClient = Prisma.TransactionClient;

const mockPrisma = {
  order: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  payment: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  ticketReservation: {
    updateMany: jest.fn(),
  },
  ticketType: {
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockTx = {
  order: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  payment: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  ticketReservation: {
    updateMany: jest.fn(),
  },
  ticketType: {
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockPaymentProvider = {
  charge: jest.fn(),
};

const mockTicketsService = {
  generateTicketsForOrder: jest.fn().mockResolvedValue([]),
};

const mockRealtime = {
  emitToEvent: jest.fn(),
  emitToOrganization: jest.fn(),
};

const mockNotifications = {
  create: jest.fn().mockResolvedValue({}),
};

const mockEmailService = {
  sendEmail: jest.fn().mockResolvedValue(undefined),
  sendPaymentSucceededEmail: jest.fn().mockResolvedValue(undefined),
  sendTicketPurchasedEmail: jest.fn().mockResolvedValue(undefined),
};

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: 'PaymentProvider', useValue: mockPaymentProvider },
        { provide: TicketsService, useValue: mockTicketsService },
        { provide: RealtimeService, useValue: mockRealtime },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();
    // default mocks
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockTx));
    mockTx.$transaction.mockImplementation(async (promises) => Promise.all(promises));
    mockTx.order.update.mockResolvedValue({});
    mockTx.payment.update.mockResolvedValue({});
    mockTx.ticketReservation.updateMany.mockResolvedValue({ count: 1 });
    mockTx.payment.findUnique.mockResolvedValue(null); // no existing payment by default
    mockTx.order.findUnique.mockResolvedValue(order);
    mockTx.payment.create.mockResolvedValue({});
    mockPaymentProvider.charge.mockResolvedValue({ providerPaymentId: 'prov-1', succeeded: true });
    mockTx.payment.create.mockResolvedValue({});
    mockTx.payment.update.mockResolvedValue({});
    mockTx.order.update.mockResolvedValue({});
    mockTx.ticketReservation.updateMany.mockResolvedValue({ count: 1 });
    mockRealtime.emitToEvent.mockResolvedValue(undefined);
    mockRealtime.emitToOrganization.mockResolvedValue(undefined);
    mockTx.ticketType.findUnique.mockResolvedValue({ id: 'tt-1', eventId: 'ev-1' });
    mockTx.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'user@example.com' });
  });

  const order = {
    id: 'ord-1',
    userId: 'user-1',
    status: OrderStatus.PENDING,
    totalAmount: new Prisma.Decimal('100.00'),
    currency: 'USD',
    items: [{ ticketTypeId: 'tt-1', quantity: 2 }],
  };

  const baseDto: CreatePaymentDto = { idempotencyKey: 'idem-1' };

  describe('createPayment', () => {
    it('should create and succeed payment', async () => {
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockTx));
      mockTx.order.findUnique.mockResolvedValue(order);
      mockTx.payment.findUnique
        .mockResolvedValueOnce(null) // idempotency check
        .mockResolvedValue({ id: 'pay-1', status: PaymentStatus.SUCCEEDED }); // final return
      mockTx.payment.create.mockResolvedValue({ id: 'pay-1', ...order, status: 'PENDING' });
      mockPaymentProvider.charge.mockResolvedValue({ providerPaymentId: 'prov-1', succeeded: true });
      mockTx.payment.update.mockResolvedValue({ id: 'pay-1', status: PaymentStatus.SUCCEEDED });
      mockTx.order.update.mockResolvedValue({ ...order, status: OrderStatus.PAID });
      mockTx.ticketReservation.updateMany.mockResolvedValue({ count: 1 });
      mockTicketsService.generateTicketsForOrder.mockResolvedValue([{ id: 't-1' }, { id: 't-2' }]);

      const res = await service.createPayment('ord-1', 'user-1', baseDto);
      expect(res.payment.id).toBe('pay-1');
      expect(res.payment.status).toBe(PaymentStatus.SUCCEEDED);
      expect(res.isNew).toBe(true);
      expect(mockTicketsService.generateTicketsForOrder).toHaveBeenCalledWith('ord-1', mockTx);
    });

    it('should fail payment and leave order pending', async () => {
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockTx));
      mockTx.order.findUnique.mockResolvedValue(order);
      mockTx.payment.findUnique
        .mockResolvedValueOnce(null) // idempotency check
        .mockResolvedValue({ id: 'pay-2', status: PaymentStatus.FAILED }); // final return
      mockTx.payment.create.mockResolvedValue({ id: 'pay-2', ...order, status: 'PENDING' });
      mockPaymentProvider.charge.mockResolvedValue({ providerPaymentId: 'prov-2', succeeded: false });
      mockTx.payment.update.mockResolvedValue({ id: 'pay-2', status: PaymentStatus.FAILED });

      const res = await service.createPayment('ord-1', 'user-1', { idempotencyKey: 'idem-2' });
      expect(res.payment.status).toBe(PaymentStatus.FAILED);
      expect(res.isNew).toBe(true);
      // tickets should not be generated on failed payment
      expect(mockTicketsService.generateTicketsForOrder).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if order missing', async () => {
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockTx));
      mockTx.order.findUnique.mockResolvedValue(null);
      await expect(service.createPayment('missing', 'user-1', baseDto)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if order belongs to other user', async () => {
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockTx));
      mockTx.order.findUnique.mockResolvedValue({ ...order, userId: 'other' });
      await expect(service.createPayment('ord-1', 'user-1', baseDto)).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException if order not pending', async () => {
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockTx));
      mockTx.order.findUnique.mockResolvedValue({ ...order, status: OrderStatus.PAID });
      await expect(service.createPayment('ord-1', 'user-1', baseDto)).rejects.toThrow(BadRequestException);
    });

    it('returns existing payment for same idempotency key', async () => {
      const existing = { id: 'pay-1', idempotencyKey: 'idem-1', status: PaymentStatus.SUCCEEDED };
      mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockTx));
      mockTx.order.findUnique.mockResolvedValue(order);
      mockTx.payment.findUnique.mockResolvedValue(existing);
      const res = await service.createPayment('ord-1', 'user-1', baseDto);
      expect(res).toEqual({ payment: existing, isNew: false });
    });
  });

  describe('findOne', () => {
    it('returns payment for owner', async () => {
      const payment = { id: 'pay-1', order: { userId: 'user-1' } };
      mockPrisma.payment.findUnique.mockResolvedValue(payment);
      const res = await service.findOne('pay-1', 'user-1');
      expect(res).toEqual(payment);
    });

    it('throws ForbiddenException for other user', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({ id: 'pay-1', order: { userId: 'other' } });
      await expect(service.findOne('pay-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });
  });
});