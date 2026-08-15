import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from './analytics.service';
import { Prisma } from '@prisma/client';

const mockPrisma = {
  event: {
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  ticketType: {
    aggregate: jest.fn(),
  },
  orderItem: {
    aggregate: jest.fn(),
  },
  ticketReservation: {
    count: jest.fn(),
  },
  order: {
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  ticket: {
    count: jest.fn(),
  },
  organization: {
    findUnique: jest.fn(),
  },
  organizationMember: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    jest.clearAllMocks();
    // reset specific mocks that use mockResolvedValueOnce sequences
    mockPrisma.ticketType.aggregate.mockReset();
    mockPrisma.orderItem.aggregate.mockReset();
    mockPrisma.order.aggregate.mockReset();
  });

  const eventId = 'evt-1';
  const orgId = 'org-1';
  const userId = 'user-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getEventAnalytics', () => {
    it('should return event analytics', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: eventId, organizationId: 'org-1' });
      mockPrisma.ticketType.aggregate
        .mockResolvedValueOnce({ _sum: { quantity: 100 } }) // capacity
        .mockResolvedValueOnce({ _sum: { quantity: 30 } }); // sold (orderItem)
      mockPrisma.orderItem.aggregate.mockResolvedValue({ _sum: { quantity: 30 } });
      mockPrisma.ticketReservation.count
        .mockResolvedValueOnce(10) // totalReservations
        .mockResolvedValueOnce(5); // activeReservations
      mockPrisma.order.count
        .mockResolvedValueOnce(5) // totalOrders
        .mockResolvedValueOnce(4) // paidOrders
        .mockResolvedValueOnce(1); // cancelledOrders
      mockPrisma.order.aggregate.mockResolvedValue({ _sum: { totalAmount: new Prisma.Decimal('5000') } });
      mockPrisma.ticket.count.mockResolvedValue(20); // ticketsCheckedIn

      const result = await service.getEventAnalytics('evt-1', 'user-1');

      expect(result.eventId).toBe('evt-1');
      expect(result.totalTicketCapacity).toBe(100);
      expect(result.ticketsSold).toBe(30);
      expect(result.ticketsRemaining).toBe(70);
      expect(result.totalReservations).toBe(10);
      expect(result.activeReservations).toBe(5);
      expect(result.totalOrders).toBe(5);
      expect(result.paidOrders).toBe(4);
      expect(result.cancelledOrders).toBe(1);
      expect(result.totalRevenue).toBe('5000');
      expect(result.ticketsCheckedIn).toBe(20);
      expect(typeof result.attendanceRate).toBe('number');
    });

    it('throws NotFoundException if event not found', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);
      await expect(service.getEventAnalytics('missing', 'user')).rejects.toThrow(NotFoundException);
    });

    it('attendanceRate zero when ticketsSold zero', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'evt-1', organizationId: 'org-1' });
      mockPrisma.ticketType.aggregate
        .mockResolvedValueOnce({ _sum: { quantity: 0 } })
        .mockResolvedValueOnce({ _sum: { quantity: 0 } });
      mockPrisma.orderItem.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });
      mockPrisma.ticketReservation.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrisma.order.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrisma.order.aggregate.mockResolvedValue({ _sum: { totalAmount: new Prisma.Decimal('0') } });
      mockPrisma.ticket.count.mockResolvedValue(0);
      const result = await service.getEventAnalytics('evt-1', 'user-1');
      expect(result.attendanceRate).toBe(0);
    });
  });

  describe('getOrganizationAnalytics', () => {
    it('should return organization analytics', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org-1' });
      mockPrisma.event.count
        .mockResolvedValueOnce(5) // totalEvents
        .mockResolvedValueOnce(3); // publishedEvents
      mockPrisma.ticketType.aggregate.mockResolvedValue({ _sum: { quantity: 500 } });
      mockPrisma.orderItem.aggregate.mockResolvedValue({ _sum: { quantity: 200 } });
      mockPrisma.order.count
        .mockResolvedValueOnce(10) // totalOrders
        .mockResolvedValueOnce(8); // paidOrders
      mockPrisma.order.aggregate.mockResolvedValue({ _sum: { totalAmount: new Prisma.Decimal('20000') } });
      mockPrisma.ticket.count.mockResolvedValue(50); // ticketsCheckedIn

      const result = await service.getOrganizationAnalytics('org-1');

      expect(result.organizationId).toBe('org-1');
      expect(result.totalEvents).toBe(5);
      expect(result.publishedEvents).toBe(3);
      expect(result.totalCapacity).toBe(500);
      expect(result.ticketsSold).toBe(200);
      expect(result.totalOrders).toBe(10);
      expect(result.paidOrders).toBe(8);
      expect(result.totalRevenue).toBe('20000');
      expect(result.ticketsCheckedIn).toBe(50);
    });

    it('throws NotFoundException if org missing', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      await expect(service.getOrganizationAnalytics('missing')).rejects.toThrow(NotFoundException);
    });
  });
});