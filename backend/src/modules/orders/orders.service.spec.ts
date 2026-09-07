import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, ReservationStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { OrdersService } from './orders.service';
import { CreateOrderDto, CreateOrderItemDto } from './dto/create-order.dto';


const mockPrisma = {
  ticketReservation: {
    findFirst: jest.fn(),
  },
  ticketType: {
    findUnique: jest.fn(),
  },
  order: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: {} },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();
  });

  const userId = 'user-1';
  const ticketTypeId = 'tt-1';
  const reservation = { id: 'res-1', userId, ticketTypeId, quantity: 5, status: ReservationStatus.ACTIVE, expiresAt: new Date(Date.now() + 10000) };
  const ticketType = { id: ticketTypeId, price: new Prisma.Decimal(20) };
  const baseDto: CreateOrderDto = { items: [{ ticketTypeId, quantity: 2 }] };

  describe('create', () => {
    it('should create order successfully', async () => {
      mockPrisma.ticketReservation.findFirst.mockResolvedValue(reservation);
      mockPrisma.ticketType.findUnique.mockResolvedValue(ticketType);
      mockPrisma.order.create.mockResolvedValue({ id: 'ord-1', userId, status: OrderStatus.PENDING, totalAmount: new Prisma.Decimal(40), currency: 'USD', items: [] });
      const res = await service.create(userId, baseDto);
      expect(res.id).toBe('ord-1');
      expect(res.status).toBe(OrderStatus.PENDING);
    });

    it('throws NotFoundException if no active reservation', async () => {
      mockPrisma.ticketReservation.findFirst.mockResolvedValue(null);
      await expect(service.create(userId, baseDto)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if quantity exceeds reservation', async () => {
      mockPrisma.ticketReservation.findFirst.mockResolvedValue({ ...reservation, quantity: 1 });
      await expect(service.create(userId, { items: [{ ticketTypeId, quantity: 2 }] })).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if ticket type missing', async () => {
      mockPrisma.ticketReservation.findFirst.mockResolvedValue(reservation);
      mockPrisma.ticketType.findUnique.mockResolvedValue(null);
      await expect(service.create(userId, baseDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('returns order for owner', async () => {
      const order = { id: 'ord-1', userId, status: OrderStatus.PENDING };
      mockPrisma.order.findUnique.mockResolvedValue(order);
      const res = await service.findOne('ord-1', userId);
      expect(res.id).toBe('ord-1');
    });

    it('throws ForbiddenException for other user', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({ id: 'ord-1', userId: 'other' });
      await expect(service.findOne('ord-1', userId)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException if order missing', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing', userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('cancels pending order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({ id: 'ord-1', userId, status: OrderStatus.PENDING });
      mockPrisma.order.update.mockResolvedValue({});
      const res = await service.cancel('ord-1', userId);
      expect(res.message).toBe('Order cancelled');
    });

    it('forbids cancelling non-pending', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({ id: 'ord-1', userId, status: OrderStatus.PAID });
      await expect(service.cancel('ord-1', userId)).rejects.toThrow(BadRequestException);
    });
  });
});