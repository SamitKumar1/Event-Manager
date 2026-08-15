import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, ReservationStatus, Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateOrderDto) {
    // Validate each item against user's active reservations
    const orderItemsData = [];
    let totalAmount = new Prisma.Decimal(0);

    for (const item of dto.items) {
      // Find active reservation for this user and ticketType
      const reservation = await this.prisma.ticketReservation.findFirst({
        where: {
          userId,
          ticketTypeId: item.ticketTypeId,
          status: ReservationStatus.ACTIVE,
          expiresAt: { gt: new Date() },
        },
      });

      if (!reservation) {
        throw new NotFoundException(`Active reservation not found for ticket type ${item.ticketTypeId}`);
      }

      if (item.quantity > reservation.quantity) {
        throw new BadRequestException(`Requested quantity exceeds reserved quantity for ticket type ${item.ticketTypeId}`);
      }

      // Get ticket type price
      const ticketType = await this.prisma.ticketType.findUnique({
        where: { id: item.ticketTypeId },
        select: { price: true },
      });
      if (!ticketType) {
        throw new NotFoundException(`Ticket type ${item.ticketTypeId} not found`);
      }

      const unitPrice = new Prisma.Decimal(ticketType.price);
      const lineTotal = unitPrice.mul(item.quantity);
      totalAmount = totalAmount.add(lineTotal);

      orderItemsData.push({
        ticketTypeId: item.ticketTypeId,
        quantity: item.quantity,
        unitPrice,
      });
    }

    // Create order with items
    const order = await this.prisma.order.create({
      data: {
        userId,
        status: OrderStatus.PENDING,
        totalAmount,
        currency: 'USD', // default
        items: {
          create: orderItemsData.map(i => ({
            ticketTypeId: i.ticketTypeId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        },
      },
      include: { items: true },
    });

    return order;
  }

  async findOne(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { ticketType: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException('Not your order');
    return order;
  }

  async findMyOrders(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: { include: { ticketType: true } } },
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async cancel(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException('Not your order');
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Only PENDING orders can be cancelled');
    }
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED },
    });
    return { message: 'Order cancelled' };
  }
}