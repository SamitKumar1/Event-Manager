import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';

type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

  // Generate a cryptographically secure random token (hex)
  private generateQrToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Generate a human-readable ticket code
  private generateTicketCode(): string {
    const prefix = 'TCK';
    const randomPart = crypto.randomBytes(6).toString('hex').toUpperCase();
    return `${prefix}-${randomPart}`;
  }

  private getClient(tx?: TransactionClient) {
    return tx ?? this.prisma;
  }

  async generateTicketsForOrder(orderId: string, tx?: TransactionClient) {
    const client = this.getClient(tx);
    const isInTransaction = !!tx;

    // Check if tickets already exist for this order (idempotent)
    const existing = await client.ticket.findFirst({ where: { orderId } });
    if (existing) {
      // tickets already generated
      return client.ticket.findMany({ where: { orderId } });
    }

    // Load order with items
    const order = await client.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'PAID') {
      throw new ForbiddenException('Order is not paid');
    }

    const ticketsData = [];
    for (const item of order.items) {
      for (let i = 0; i < item.quantity; i++) {
        ticketsData.push({
          orderId,
          orderItemId: item.id,
          ticketTypeId: item.ticketTypeId,
          userId: order.userId,
          ticketCode: this.generateTicketCode(),
          qrToken: this.generateQrToken(),
          status: 'VALID' as const,
        });
      }
    }

    // Create tickets - use transaction only when not already in one
    if (isInTransaction) {
      // Already in a transaction, execute creates directly
      await Promise.all(
        ticketsData.map((data) => client.ticket.create({ data }))
      );
    } else {
      // Standalone call, wrap in transaction for atomicity
      await client.$transaction(
        ticketsData.map((data) => client.ticket.create({ data }))
      );
    }

    return client.ticket.findMany({ where: { orderId } });
  }

  async findOne(ticketId: string, userId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { ticketType: true, order: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== userId) throw new ForbiddenException('Not your ticket');
    return ticket;
  }

  async findMyTickets(userId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  const [items, total] = await this.prisma.$transaction([
    this.prisma.ticket.findMany({
      where: { userId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        ticketType: true,
        order: {
          include: {
            items: {
              include: {
                ticketType: {
                  include: {
                    event: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    this.prisma.ticket.count({ where: { userId } }),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

}