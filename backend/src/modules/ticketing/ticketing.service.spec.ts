import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketingService } from './ticketing.service';
import { OrganizationRole } from '@prisma/client';

const mockPrisma = {
  ticketType: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  event: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('TicketingService', () => {
  let service: TicketingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TicketingService>(TicketingService);
    jest.clearAllMocks();
  });

  const baseDto = {
    name: 'VIP',
    description: 'VIP ticket',
    price: 100.00,
    quantity: 50,
    salesStartAt: '2025-01-01T10:00:00Z',
    salesEndAt: '2025-06-01T10:00:00Z',
  };

  describe('create', () => {
    it('should create ticket type for OWNER', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'evt-1' });
      mockPrisma.ticketType.findUnique.mockResolvedValue(null);
      mockPrisma.ticketType.create.mockResolvedValue({ id: 'tt-1', ...baseDto, eventId: 'evt-1' });
      const result = await service.create('evt-1', 'user-1', OrganizationRole.OWNER, baseDto as any);
      expect(result).toHaveProperty('id');
    });

    it('should forbid MEMBER', async () => {
      await expect(service.create('evt-1', 'user-1', OrganizationRole.MEMBER, baseDto as any)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException on duplicate name', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'evt-1' });
      mockPrisma.ticketType.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.create('evt-1', 'user-1', OrganizationRole.OWNER, baseDto as any)).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when salesStartAt >= salesEndAt', async () => {
      const dto = { ...baseDto, salesStartAt: '2025-06-01T10:00:00Z', salesEndAt: '2025-01-01T10:00:00Z' };
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'evt-1' });
      await expect(service.create('evt-1', 'user-1', OrganizationRole.OWNER, dto as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for negative price', async () => {
      const dto = { ...baseDto, price: -10 };
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'evt-1' });
      await expect(service.create('evt-1', 'user-1', OrganizationRole.OWNER, dto as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for quantity <=0', async () => {
      const dto = { ...baseDto, quantity: 0 };
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'evt-1' });
      await expect(service.create('evt-1', 'user-1', OrganizationRole.OWNER, dto as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAllByEvent', () => {
    it('should return paginated ticket types', async () => {
      const items = [{ id: '1' }, { id: '2' }];
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'evt-1' });
      mockPrisma.$transaction.mockResolvedValue([items, 2]);
      const result = await service.findAllByEvent('evt-1', 1, 20);
      expect(result.items).toEqual(items);
    });

    it('should throw NotFoundException when event missing', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);
      await expect(service.findAllByEvent('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('should return ticket type', async () => {
      mockPrisma.ticketType.findUnique.mockResolvedValue({ id: 'tt-1' });
      const result = await service.findOne('tt-1');
      expect(result.id).toBe('tt-1');
    });
    it('should throw NotFoundException', async () => {
      mockPrisma.ticketType.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const existing = { id: 'tt-1', eventId: 'evt-1', name: 'VIP', price: 100, quantity: 10, salesStartAt: new Date('2025-01-01'), salesEndAt: new Date('2025-06-01') };
    it('should update for ADMIN', async () => {
      mockPrisma.ticketType.findUnique.mockResolvedValueOnce(existing).mockResolvedValueOnce(null);
      mockPrisma.ticketType.update.mockResolvedValue({ ...existing, name: 'VIP2' });
      const result = await service.update('tt-1', 'user-1', OrganizationRole.ADMIN, { name: 'VIP2' } as any);
      expect(result.name).toBe('VIP2');
    });
    it('should forbid MEMBER', async () => {
      mockPrisma.ticketType.findUnique.mockResolvedValue(existing);
      await expect(service.update('tt-1', 'user-1', OrganizationRole.MEMBER, { name: 'X' } as any)).rejects.toThrow(ForbiddenException);
    });
    it('should throw ConflictException on duplicate name', async () => {
      mockPrisma.ticketType.findUnique.mockResolvedValueOnce(existing).mockResolvedValueOnce({ id: 'other' });
      await expect(service.update('tt-1', 'user-1', OrganizationRole.OWNER, { name: 'Dup' } as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should allow OWNER', async () => {
      mockPrisma.ticketType.findUnique.mockResolvedValue({ id: 'tt-1' });
      mockPrisma.ticketType.delete.mockResolvedValue({});
      const result = await service.remove('tt-1', OrganizationRole.OWNER);
      expect(result.message).toBe('Ticket type deleted');
    });
    it('should forbid ADMIN', async () => {
      mockPrisma.ticketType.findUnique.mockResolvedValue({ id: 'tt-1' });
      await expect(service.remove('tt-1', OrganizationRole.ADMIN)).rejects.toThrow(ForbiddenException);
    });
  });
});