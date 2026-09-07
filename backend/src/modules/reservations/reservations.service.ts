import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { ReservationStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisLockService } from '../../common/redis/redis-lock.service';

import { CreateReservationDto } from './dto/create-reservation.dto';

@Injectable()
export class ReservationsService {
  private readonly ttlMinutes: number;
  private readonly lockTtlMs: number;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private redisLock: RedisLockService,
  ) {
    this.ttlMinutes = Number(this.config.get('RESERVATION_TTL_MINUTES') ?? 10);
    this.lockTtlMs = Number(this.config.get('RESERVATION_LOCK_TTL_MS') ?? 10000);
  }

  private expirationDate(): Date {
    const d = new Date();
    d.setMinutes(d.getMinutes() + this.ttlMinutes);
    return d;
  }

  private async checkAndUpdateExpiration(reservation: any) {
    if (reservation.status === ReservationStatus.ACTIVE && reservation.expiresAt < new Date()) {
      await this.prisma.ticketReservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.EXPIRED },
      });
      reservation.status = ReservationStatus.EXPIRED;
    }
    return reservation;
  }

  async create(ticketTypeId: string, userId: string, dto: CreateReservationDto) {
    // Validate ticket type and event (outside lock to avoid long lock hold)
    const ticketType = await this.prisma.ticketType.findUnique({
      where: { id: ticketTypeId },
      include: { event: true },
    });
    if (!ticketType) throw new NotFoundException('Ticket type not found');
    if (ticketType.event.status !== 'PUBLISHED') {
      throw new BadRequestException('Event is not published');
    }
    const now = new Date();
    if (now < ticketType.salesStartAt || now > ticketType.salesEndAt) {
      throw new BadRequestException('Outside sales window');
    }

    const lockKey = `reservation:lock:${ticketTypeId}`;
    const token = await this.redisLock.acquireLock(lockKey, this.lockTtlMs);
    if (!token) {
      throw new ConflictException('Could not acquire lock, try again');
    }

    try {
      // Re-validate inside lock in case of concurrent changes
      const freshTicketType = await this.prisma.ticketType.findUnique({
        where: { id: ticketTypeId },
        include: { event: true },
      });
      if (!freshTicketType) throw new NotFoundException('Ticket type not found');
      if (freshTicketType.event.status !== 'PUBLISHED') {
        throw new BadRequestException('Event is not published');
      }
      const nowInside = new Date();
      if (nowInside < freshTicketType.salesStartAt || nowInside > freshTicketType.salesEndAt) {
        throw new BadRequestException('Outside sales window');
      }

      // Calculate available inventory
      const activeReservations = await this.prisma.ticketReservation.aggregate({
        where: {
          ticketTypeId,
          status: ReservationStatus.ACTIVE,
          expiresAt: { gt: nowInside },
        },
        _sum: { quantity: true },
      });
      const reservedQty = activeReservations._sum.quantity ?? 0;
      const available = freshTicketType.quantity - reservedQty;
      if (dto.quantity > available) {
        throw new ConflictException('Insufficient inventory');
      }

      const expiresAt = this.expirationDate();
      const reservation = await this.prisma.ticketReservation.create({
        data: {
          ticketTypeId,
          userId,
          quantity: dto.quantity,
          status: ReservationStatus.ACTIVE,
          expiresAt,
        },
      });
      return reservation;
    } finally {
      await this.redisLock.releaseLock(lockKey, token);
    }
  }

  async findOne(reservationId: string, userId: string) {
    const reservation = await this.prisma.ticketReservation.findUnique({
      where: { id: reservationId },
      include: { ticketType: { include: { event: true } } },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.userId !== userId) throw new ForbiddenException('Not your reservation');
    return this.checkAndUpdateExpiration(reservation);
  }

  async findMyReservations(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ticketReservation.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { ticketType: { include: { event: true } } },
      }),
      this.prisma.ticketReservation.count({ where: { userId } }),
    ]);
    // update expiration status on the fly (optional, not persisting unless accessed individually)
    const now = new Date();
    items.forEach(r => {
      if (r.status === ReservationStatus.ACTIVE && r.expiresAt < now) {
        r.status = ReservationStatus.EXPIRED;
      }
    });
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async cancel(reservationId: string, userId: string) {
    const reservation = await this.prisma.ticketReservation.findUnique({
      where: { id: reservationId },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.userId !== userId) throw new ForbiddenException('Not your reservation');
    if (reservation.status !== ReservationStatus.ACTIVE) {
      throw new BadRequestException('Only active reservations can be cancelled');
    }
    await this.prisma.ticketReservation.update({
      where: { id: reservationId },
      data: { status: ReservationStatus.CANCELLED },
    });
    return { message: 'Reservation cancelled' };
  }
}