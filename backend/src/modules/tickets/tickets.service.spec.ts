import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { TicketStatus, OrderStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { TicketsService } from './tickets.service';

type TransactionClient = Prisma.TransactionClient;

const mockPrisma = {
  ticket: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  order: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockTx = {
  ticket: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  order: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('TicketsService', () => {
  let service: TicketsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
    jest.clearAllMocks();
  });

  const userId = 'user-1';
  const orderId = 'ord-1';
  const order = {
    id: orderId,
    userId,
    status: OrderStatus.PAID,
    items: [
      { id: 'oi-1', ticketTypeId: 'tt-1', quantity: 2 },
    ],
  };

  describe('generateTicketsForOrder', () => {
    beforeEach(() => {
      mockTx.$transaction.mockImplementation(async (promises) => Promise.all(promises));
    });

    it('should generate tickets for a paid order', async () => {
      mockPrisma.ticket.findFirst.mockResolvedValue(null);
      mockPrisma.order.findUnique.mockResolvedValue(order);
      mockPrisma.ticket.create.mockResolvedValue({ id: 't-1', orderId, userId, status: TicketStatus.VALID });
      mockPrisma.ticket.findMany.mockResolvedValue([{ id: 't-1' }, { id: 't-2' }]);

      const tickets = await service.generateTicketsForOrder(orderId);
      expect(tickets.length).toBe(2);
    });

    it('should generate tickets for a paid order using transaction client', async () => {
      mockTx.ticket.findFirst.mockResolvedValue(null);
      mockTx.order.findUnique.mockResolvedValue(order);
      mockTx.ticket.create.mockResolvedValue({ id: 't-1', orderId, userId, status: TicketStatus.VALID });
      mockTx.ticket.findMany.mockResolvedValue([{ id: 't-1' }, { id: 't-2' }]);
      mockTx.$transaction.mockImplementation(async (promises) => Promise.all(promises));

      const tickets = await service.generateTicketsForOrder(orderId, mockTx as TransactionClient);
      expect(tickets.length).toBe(2);
      expect(mockTx.ticket.findFirst).toHaveBeenCalled();
      expect(mockTx.order.findUnique).toHaveBeenCalled();
    });

    it('should be idempotent and return existing tickets', async () => {
      const existingTickets = [{ id: 't-1' }, { id: 't-2' }];
      mockPrisma.ticket.findFirst.mockResolvedValue(existingTickets[0]);
      mockPrisma.ticket.findMany.mockResolvedValue(existingTickets);
      const tickets = await service.generateTicketsForOrder(orderId);
      expect(tickets).toEqual(existingTickets);
    });

    it('should be idempotent and return existing tickets using transaction client', async () => {
      const existingTickets = [{ id: 't-1' }, { id: 't-2' }];
      mockTx.ticket.findFirst.mockResolvedValue(existingTickets[0]);
      mockTx.ticket.findMany.mockResolvedValue(existingTickets);

      const tickets = await service.generateTicketsForOrder(orderId, mockTx as TransactionClient);
      expect(tickets).toEqual(existingTickets);
      expect(mockTx.ticket.findFirst).toHaveBeenCalled();
    });

    it('throws NotFoundException if order missing', async () => {
      mockPrisma.ticket.findFirst.mockResolvedValue(null);
      mockPrisma.order.findUnique.mockResolvedValue(null);
      await expect(service.generateTicketsForOrder('missing')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException if order missing using transaction client', async () => {
      mockTx.ticket.findFirst.mockResolvedValue(null);
      mockTx.order.findUnique.mockResolvedValue(null);
      await expect(service.generateTicketsForOrder('missing', mockTx as TransactionClient)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if order not paid', async () => {
      mockPrisma.ticket.findFirst.mockResolvedValue(null);
      mockPrisma.order.findUnique.mockResolvedValue({ ...order, status: OrderStatus.PENDING });
      await expect(service.generateTicketsForOrder(orderId)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException if order not paid using transaction client', async () => {
      mockTx.ticket.findFirst.mockResolvedValue(null);
      mockTx.order.findUnique.mockResolvedValue({ ...order, status: OrderStatus.PENDING });
      await expect(service.generateTicketsForOrder(orderId, mockTx as TransactionClient)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findOne', () => {
    it('returns ticket for owner', async () => {
      const ticket = { id: 't-1', userId };
      mockPrisma.ticket.findUnique.mockResolvedValue(ticket);
      const res = await service.findOne('t-1', userId);
      expect(res).toEqual(ticket);
    });

    it('throws ForbiddenException for other user', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ id: 't-1', userId: 'other' });
      await expect(service.findOne('t-1', userId)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException if missing', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing', userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findMyTickets', () => {
    it('returns paginated tickets', async () => {
      const items = [{ id: 't-1' }, { id: 't-2' }];
      mockPrisma.$transaction.mockResolvedValue([items, 2]);
      const res = await service.findMyTickets(userId, 1, 20);
      expect(res.items).toEqual(items);
      expect(res.total).toBe(2);
    });
  });
});