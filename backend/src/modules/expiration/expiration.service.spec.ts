import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ReservationStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { ExpirationService } from './expiration.service';

const mockPrisma = {
  ticketReservation: {
    updateMany: jest.fn(),
  },
};

describe('ExpirationService', () => {
  let service: ExpirationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpirationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ExpirationService>(ExpirationService);
    jest.clearAllMocks();
  });

  describe('expireReservations', () => {
    it('should expire ACTIVE reservations whose expiresAt is past', async () => {
      mockPrisma.ticketReservation.updateMany.mockResolvedValue({ count: 3 });
      const count = await service.expireReservations();
      expect(count).toBe(3);
      expect(mockPrisma.ticketReservation.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
          expiresAt: { lt: expect.any(Date) },
        },
        data: { status: 'EXPIRED' },
      });
    });

    it('should return 0 when no reservations to expire', async () => {
      mockPrisma.ticketReservation.updateMany.mockResolvedValue({ count: 0 });
      const count = await service.expireReservations();
      expect(count).toBe(0);
    });
  });

  describe('expireNow', () => {
    it('calls expireReservations', async () => {
      const spy = jest.spyOn(service, 'expireReservations').mockResolvedValue(2);
      const result = await service.expireNow();
      expect(result).toBe(2);
      expect(spy).toHaveBeenCalled();
    });
  });
});