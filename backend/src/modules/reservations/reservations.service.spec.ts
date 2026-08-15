import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { RedisLockService } from '../../common/redis/redis-lock.service';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ReservationStatus } from '@prisma/client';

const mockPrisma = {
  ticketType: {
    findUnique: jest.fn(),
  },
  ticketReservation: {
    aggregate: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockRedisLock = {
  acquireLock: jest.fn().mockResolvedValue('lock-token'),
  releaseLock: jest.fn().mockResolvedValue(true),
};

describe('ReservationsService', () => {
  let service: ReservationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: { get: jest.fn(() => 10) } },
        { provide: RedisLockService, useValue: mockRedisLock },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
    jest.clearAllMocks();
  });

  const baseDto: CreateReservationDto = { quantity: 2 };

  const ticketType = {
    id: 'tt-1',
    quantity: 10,
    salesStartAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365), // one year ago
    salesEndAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),   // one year ahead
    event: { id: 'ev-1', status: 'PUBLISHED' },
  };

  describe('create', () => {
    it('should create reservation successfully', async () => {
      mockPrisma.ticketType.findUnique.mockResolvedValue(ticketType);
      mockPrisma.ticketReservation.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });
      mockPrisma.ticketReservation.create.mockResolvedValue({
        id: 'res-1',
        ticketTypeId: 'tt-1',
        userId: 'user-1',
        quantity: 2,
        status: 'ACTIVE',
        expiresAt: new Date(),
      });
      const res = await service.create('tt-1', 'user-1', baseDto);
      expect(res.id).toBe('res-1');
      expect(res.status).toBe(ReservationStatus.ACTIVE);
    });

    it('throws NotFoundException if ticket type missing', async () => {
      mockPrisma.ticketType.findUnique.mockResolvedValue(null);
      await expect(service.create('tt-1', 'user-1', baseDto)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if event not published', async () => {
      mockPrisma.ticketType.findUnique.mockResolvedValue({ ...ticketType, event: { status: 'DRAFT' } });
      await expect(service.create('tt-1', 'user-1', baseDto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if outside sales window', async () => {
      mockPrisma.ticketType.findUnique.mockResolvedValue({
        ...ticketType,
        salesStartAt: new Date('2030-01-01'),
        salesEndAt: new Date('2031-01-01'),
      });
      await expect(service.create('tt-1', 'user-1', baseDto)).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException if insufficient inventory', async () => {
      mockPrisma.ticketType.findUnique.mockResolvedValue(ticketType);
      mockPrisma.ticketReservation.aggregate.mockResolvedValue({ _sum: { quantity: 9 } });
      await expect(service.create('tt-1', 'user-1', { quantity: 3 })).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('returns reservation for owner', async () => {
      const reservation = { id: 'res-1', userId: 'user-1', status: ReservationStatus.ACTIVE, expiresAt: new Date(Date.now() + 1000) };
      mockPrisma.ticketReservation.findUnique.mockResolvedValue(reservation);
      const res = await service.findOne('res-1', 'user-1');
      expect(res.id).toBe('res-1');
    });

    it('throws ForbiddenException for other user', async () => {
      mockPrisma.ticketReservation.findUnique.mockResolvedValue({ id: 'res-1', userId: 'other' });
      await expect(service.findOne('res-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('updates status to EXPIRED if past expiresAt', async () => {
      const reservation = { id: 'res-1', userId: 'user-1', status: ReservationStatus.ACTIVE, expiresAt: new Date(Date.now() - 1000) };
      mockPrisma.ticketReservation.findUnique.mockResolvedValue(reservation);
      mockPrisma.ticketReservation.update.mockResolvedValue({ ...reservation, status: ReservationStatus.EXPIRED });
      const res = await service.findOne('res-1', 'user-1');
      expect(res.status).toBe(ReservationStatus.EXPIRED);
    });
  });

  describe('cancel', () => {
    it('cancels active reservation', async () => {
      mockPrisma.ticketReservation.findUnique.mockResolvedValue({ id: 'res-1', userId: 'user-1', status: ReservationStatus.ACTIVE });
      mockPrisma.ticketReservation.update.mockResolvedValue({});
      const res = await service.cancel('res-1', 'user-1');
      expect(res.message).toBe('Reservation cancelled');
    });

    it('forbids cancelling non-active', async () => {
      mockPrisma.ticketReservation.findUnique.mockResolvedValue({ id: 'res-1', userId: 'user-1', status: ReservationStatus.CANCELLED });
      await expect(service.cancel('res-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });
});