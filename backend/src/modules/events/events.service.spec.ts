import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { EventStatus, EventLocationType, OrganizationRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';

import { EventsService } from './events.service';

const mockPrisma = {
  event: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
  organizationMember: {
    findMany: jest.fn(),
  },
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
};

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RealtimeService, useValue: mockRealtime },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    jest.clearAllMocks();
    mockRealtime.emitToEvent.mockResolvedValue(undefined);
    mockRealtime.emitToOrganization.mockResolvedValue(undefined);
    mockNotifications.create.mockResolvedValue({});
    // default org members for notification tests
    mockPrisma.organizationMember.findMany.mockResolvedValue([
      { userId: 'user-1' },
      { userId: 'user-2' },
    ]);
  });

  const baseCreateDto = {
    title: 'Test Event',
    slug: 'test-event',
    locationType: EventLocationType.PHYSICAL,
    venueName: 'Venue',
    address: '123 St',
    city: 'City',
    country: 'Country',
    startAt: '2025-01-01T10:00:00Z',
    endAt: '2025-01-01T12:00:00Z',
    timezone: 'UTC',
  };

  describe('create', () => {
    it('should create event successfully', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);
      mockPrisma.event.create.mockResolvedValue({ id: 'evt-1', ...baseCreateDto, status: EventStatus.DRAFT, organizationId: 'org-1', createdById: 'user-1' });
      const result = await service.create('org-1', 'user-1', baseCreateDto as any);
      expect(result).toHaveProperty('id');
      expect(result.status).toBe(EventStatus.DRAFT);
    });

    it('should throw ConflictException on duplicate slug', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.create('org-1', 'user-1', baseCreateDto as any)).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when startAt >= endAt', async () => {
      const dto = { ...baseCreateDto, startAt: '2025-01-01T12:00:00Z', endAt: '2025-01-01T10:00:00Z' };
      await expect(service.create('org-1', 'user-1', dto as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for missing physical fields', async () => {
      const dto = { ...baseCreateDto, locationType: EventLocationType.PHYSICAL, venueName: undefined };
      await expect(service.create('org-1', 'user-1', dto as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAllByOrganization', () => {
    it('should return paginated events', async () => {
      const events = [{ id: '1' }, { id: '2' }];
      mockPrisma.$transaction.mockResolvedValue([events, 2]);
      const result = await service.findAllByOrganization('org-1', 1, 20);
      expect(result.items).toEqual(events);
      expect(result.total).toBe(2);
    });
  });

  describe('findOne', () => {
    it('should return event', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'evt-1' });
      const result = await service.findOne('evt-1');
      expect(result.id).toBe('evt-1');
    });

    it('should throw NotFoundException', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const existingEvent = { id: 'evt-1', organizationId: 'org-1', status: EventStatus.DRAFT, startAt: new Date('2025-01-01T10:00:00Z'), endAt: new Date('2025-01-01T12:00:00Z'), locationType: EventLocationType.PHYSICAL, venueName: 'Venue', address: '123', city: 'City', country: 'Country' };
    it('should update event', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(existingEvent);
      mockPrisma.event.update.mockResolvedValue({ ...existingEvent, title: 'Updated' });
      const result = await service.update('evt-1', 'user-1', 'org-1', { title: 'Updated' } as any);
      expect(result.title).toBe('Updated');
    });

    it('should throw ForbiddenException if org mismatch', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ ...existingEvent, organizationId: 'org-2' });
      await expect(service.update('evt-1', 'user-1', 'org-1', { title: 'X' } as any)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException on slug duplicate', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(existingEvent);
      mockPrisma.event.findUnique.mockResolvedValueOnce(existingEvent).mockResolvedValueOnce({ id: 'other' });
      await expect(service.update('evt-1', 'user-1', 'org-1', { slug: 'dup' } as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should delete draft event', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'evt-1', organizationId: 'org-1', status: EventStatus.DRAFT });
      mockPrisma.event.delete.mockResolvedValue({});
      const result = await service.remove('evt-1', 'org-1');
      expect(result.message).toBe('Event deleted');
    });

    it('should forbid deleting non-draft', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'evt-1', organizationId: 'org-1', status: EventStatus.PUBLISHED });
      await expect(service.remove('evt-1', 'org-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('publish', () => {
    it('should publish draft', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'evt-1', organizationId: 'org-1', status: EventStatus.DRAFT });
      mockPrisma.event.update.mockResolvedValue({ id: 'evt-1', status: EventStatus.PUBLISHED });
      const result = await service.publish('evt-1', 'org-1');
      expect(result.status).toBe(EventStatus.PUBLISHED);
    });

    it('should forbid publishing non-draft', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'evt-1', organizationId: 'org-1', status: EventStatus.PUBLISHED });
      await expect(service.publish('evt-1', 'org-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('cancel', () => {
    it('should cancel draft', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'evt-1', organizationId: 'org-1', status: EventStatus.DRAFT });
      mockPrisma.event.update.mockResolvedValue({ id: 'evt-1', status: EventStatus.CANCELLED });
      const result = await service.cancel('evt-1', 'org-1');
      expect(result.status).toBe(EventStatus.CANCELLED);
    });

    it('should cancel published', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'evt-1', organizationId: 'org-1', status: EventStatus.PUBLISHED });
      mockPrisma.event.update.mockResolvedValue({ id: 'evt-1', status: EventStatus.CANCELLED });
      const result = await service.cancel('evt-1', 'org-1');
      expect(result.status).toBe(EventStatus.CANCELLED);
    });

    it('should forbid cancelling completed', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'evt-1', organizationId: 'org-1', status: EventStatus.COMPLETED });
      await expect(service.cancel('evt-1', 'org-1')).rejects.toThrow(ForbiddenException);
    });
  });
});