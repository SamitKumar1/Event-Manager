import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';

import { CheckinService } from './checkin.service';

const mockPrisma = {
  ticket: {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockRealtime = {
  emitToEvent: jest.fn(),
};

const mockNotifications = {
  create: jest.fn().mockResolvedValue({}),
};

const mockEmailService = {
  sendEmail: jest.fn().mockResolvedValue(undefined),
};

describe('CheckinService', () => {
  let service: CheckinService;
  let prisma: typeof mockPrisma;
  let realtime: typeof mockRealtime;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckinService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RealtimeService, useValue: mockRealtime },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<CheckinService>(CheckinService);
    prisma = module.get(PrismaService);
    realtime = module.get(RealtimeService);
    jest.clearAllMocks();
  });

  const eventId = 'ev-1';
  const qrToken = 'valid-qr-token';
  const ticket = {
    id: 't-1',
    qrToken,
    ticketType: {
      id: 'tt-1',
      name: 'VIP',
      eventId: 'ev-1',
      event: {
        id: 'ev-1',
        title: 'Test Event',
      },
    },
    status: TicketStatus.VALID,
    ticketCode: 'TCK-ABC123',
  };

  const eventIdWrong = 'ev-2';

  it('should check in a valid ticket successfully', async () => {
    prisma.ticket.findUnique
      .mockResolvedValueOnce(ticket)
      .mockResolvedValueOnce({
        ...ticket,
        status: TicketStatus.USED,
        checkedInAt: new Date(),
      });
    prisma.ticket.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.checkIn(eventId, qrToken);

    expect(prisma.ticket.findUnique).toHaveBeenCalledWith({ where: { qrToken }, include: { ticketType: { include: { event: true } } } });
    expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
      where: { id: ticket.id, status: TicketStatus.VALID },
      data: { status: TicketStatus.USED, checkedInAt: expect.any(Date) },
    });
    expect(result).toMatchObject({
      id: ticket.id,
      ticketCode: ticket.ticketCode,
      status: TicketStatus.USED,
      checkedInAt: expect.any(Date),
    });
    expect(realtime.emitToEvent).toHaveBeenCalledWith(eventId, 'ticket.checked_in', {
      ticketId: expect.any(String),
      ticketCode: expect.any(String),
      checkedInAt: expect.any(Date),
    });
  });

  it('throws NotFoundException for invalid QR token', async () => {
    prisma.ticket.findUnique.mockResolvedValue(null);
    await expect(service.checkIn(eventId, 'invalid')).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException for ticket from another event', async () => {
    const otherEventTicket = { ...ticket, ticketType: { ...ticket.ticketType, eventId: 'ev-2', event: { id: 'ev-2', title: 'Other' } } };
    prisma.ticket.findUnique.mockResolvedValue(otherEventTicket);
    await expect(service.checkIn(eventId, qrToken)).rejects.toThrow(ForbiddenException);
  });

  it('throws BadRequestException for cancelled ticket', async () => {
    const cancelledTicket = { ...ticket, status: TicketStatus.CANCELLED };
    prisma.ticket.findUnique.mockResolvedValue(cancelledTicket);
    await expect(service.checkIn(eventId, qrToken)).rejects.toThrow(BadRequestException);
  });

  it('throws ConflictException for already used ticket', async () => {
    const usedTicket = { ...ticket, status: TicketStatus.USED };
    prisma.ticket.findUnique.mockResolvedValue(usedTicket);
    await expect(service.checkIn(eventId, qrToken)).rejects.toThrow(ConflictException);
  });

  it('throws ConflictException when concurrent check-in occurs (zero rows updated)', async () => {
    prisma.ticket.findUnique.mockResolvedValue(ticket);
    prisma.ticket.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.checkIn(eventId, qrToken)).rejects.toThrow(ConflictException);
  });
});