import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { RealtimeService } from '../realtime/realtime.service';

const mockPrisma = {
  notification: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockRealtime = {
  emitToUser: jest.fn(),
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RealtimeService, useValue: mockRealtime },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  it('should create notification and emit realtime', async () => {
    const input = {
      userId: 'user-1',
      type: 'test',
      title: 'Test',
      message: 'Hello',
      data: { foo: 'bar' },
    };
    const created = { id: 'n-1', ...input, readAt: null, createdAt: new Date() };
    mockPrisma.notification.create.mockResolvedValue(created);
    mockRealtime.emitToUser.mockResolvedValue(undefined);

    const result = await service.create(input);
    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        data: input.data,
      },
    });
    expect(mockRealtime.emitToUser).toHaveBeenCalledWith(
      input.userId,
      'notification.created',
      expect.objectContaining({ id: expect.any(String), type: input.type }),
    );
    expect(result).toEqual(created);
  });

  it('returns paginated notifications for user', async () => {
    const items = [{ id: 'n1' }, { id: 'n2' }];
    mockPrisma.$transaction.mockResolvedValue([items, 2]);
    const res = await service.findAllForUser('user-1', 1, 20);
    expect(res.items).toEqual(items);
    expect(res.total).toBe(2);
  });

  it('returns unread count', async () => {
    mockPrisma.notification.count.mockResolvedValue(5);
    const cnt = await service.getUnreadCount('user-1');
    expect(cnt).toBe(5);
  });

  it('marks notification as read', async () => {
    const notif = { id: 'n-1', userId: 'user-1', readAt: null };
    mockPrisma.notification.findUnique.mockResolvedValue(notif);
    mockPrisma.notification.update.mockResolvedValue({ ...notif, readAt: new Date() });
    const res = await service.markAsRead('user-1', 'n-1');
    expect(res.readAt).toBeDefined();
  });

  it('throws ForbiddenException when marking other user notification', async () => {
    mockPrisma.notification.findUnique.mockResolvedValue({ id: 'n-1', userId: 'other' });
    await expect(service.markAsRead('user-1', 'n-1')).rejects.toThrow(ForbiddenException);
  });

  it('marks all as read', async () => {
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 3 });
    const res = await service.markAllAsRead('user-1');
    expect(res.count).toBe(3);
  });
});