import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getEventAnalytics(eventId: string) {
    // verify event exists and user has access (owner/admin) - authorization handled by guards
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, organizationId: true },
    });
    if (!event) throw new NotFoundException('Event not found');

    // capacity: sum of ticketType.quantity
    const capacityAgg = await this.prisma.ticketType.aggregate({
      where: { eventId },
      _sum: { quantity: true },
    });
    const totalTicketCapacity = Number(capacityAgg._sum.quantity ?? 0);

    // ticketsSold: sum OrderItem.quantity where order paid and orderItem.ticketType.eventId = eventId
    const soldAgg = await this.prisma.orderItem.aggregate({
      where: {
        ticketType: { eventId },
        order: { status: 'PAID' },
      },
      _sum: { quantity: true },
    });
    const ticketsSold = Number(soldAgg._sum.quantity ?? 0);
    const ticketsRemaining = totalTicketCapacity - ticketsSold;

    // totalReservations
    const totalReservations = await this.prisma.ticketReservation.count({
      where: { ticketType: { eventId } },
    });

    // activeReservations
    const activeReservations = await this.prisma.ticketReservation.count({
      where: {
        ticketType: { eventId },
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
    });

    // totalOrders: distinct orders containing items of this event
    const totalOrders = await this.prisma.order.count({
      where: {
        items: { some: { ticketType: { eventId } } },
      },
    });

    // paidOrders
    const paidOrders = await this.prisma.order.count({
      where: {
        status: 'PAID',
        items: { some: { ticketType: { eventId } } },
      },
    });

    // cancelledOrders
    const cancelledOrders = await this.prisma.order.count({
      where: {
        status: 'CANCELLED',
        items: { some: { ticketType: { eventId } } },
      },
    });

    // totalRevenue: sum Order.totalAmount for PAID orders containing this event
    const revenueAgg = await this.prisma.order.aggregate({
      where: {
        status: 'PAID',
        items: { some: { ticketType: { eventId } } },
      },
      _sum: { totalAmount: true },
    });
    const totalRevenue = (revenueAgg._sum.totalAmount as Prisma.Decimal) ?? new Prisma.Decimal(0);

    // ticketsCheckedIn: tickets with status USED for this event
    const ticketsCheckedIn = await this.prisma.ticket.count({
      where: {
        ticketType: { eventId },
        status: 'USED',
      },
    });

    const attendanceRate = ticketsSold > 0
      ? Number(((ticketsCheckedIn / ticketsSold) * 100).toFixed(2))
      : 0;

    return {
      eventId,
      totalTicketCapacity,
      ticketsSold,
      ticketsRemaining,
      totalReservations,
      activeReservations,
      totalOrders,
      paidOrders,
      cancelledOrders,
      totalRevenue: totalRevenue.toString(),
      ticketsCheckedIn,
      attendanceRate,
    };
  }

  async getOrganizationAnalytics(organizationId: string) {
    // verify organization exists
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
    if (!org) throw new NotFoundException('Organization not found');

    // totalEvents
    const totalEvents = await this.prisma.event.count({ where: { organizationId } });
    const publishedEvents = await this.prisma.event.count({ where: { organizationId, status: 'PUBLISHED' } });

    // totalCapacity across all ticketTypes of org events
    const capacityAgg = await this.prisma.ticketType.aggregate({
      where: { event: { organizationId } },
      _sum: { quantity: true },
    });
    const totalCapacity = Number(capacityAgg._sum.quantity ?? 0);

    // ticketsSold across org events
    const soldAgg = await this.prisma.orderItem.aggregate({
      where: {
        ticketType: { event: { organizationId } },
        order: { status: 'PAID' },
      },
      _sum: { quantity: true },
    });
    const ticketsSold = Number(soldAgg._sum.quantity ?? 0);

    // totalOrders distinct orders containing items of org events
    const totalOrders = await this.prisma.order.count({
      where: {
        items: { some: { ticketType: { event: { organizationId } } } },
      },
    });

    const paidOrders = await this.prisma.order.count({
      where: {
        status: 'PAID',
        items: { some: { ticketType: { event: { organizationId } } } },
      },
    });

    const revenueAgg = await this.prisma.order.aggregate({
      where: {
        status: 'PAID',
        items: { some: { ticketType: { event: { organizationId } } } },
      },
      _sum: { totalAmount: true },
    });
    const totalRevenue = (revenueAgg._sum.totalAmount as Prisma.Decimal) ?? new Prisma.Decimal(0);

    // ticketsCheckedIn across org events
    const ticketsCheckedIn = await this.prisma.ticket.count({
      where: {
        ticketType: { event: { organizationId } },
        status: 'USED',
      },
    });

    return {
      organizationId,
      totalEvents,
      publishedEvents,
      totalCapacity,
      ticketsSold,
      totalOrders,
      paidOrders,
      totalRevenue: totalRevenue.toString(),
      ticketsCheckedIn,
    };
  }
}