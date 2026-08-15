import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { PaymentProvider } from './providers/payment-provider.interface';
import { TicketsService } from '../tickets/tickets.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { PaymentStatus, OrderStatus, ReservationStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';

type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    @Inject('PaymentProvider') private paymentProvider: PaymentProvider,
    private ticketsService: TicketsService,
    private realtime: RealtimeService,
    private notifications: NotificationsService,
    private emailService: EmailService,
  ) {}

  async createPayment(orderId: string, userId: string, idempotencyKey: string) {
    return this.prisma.$transaction(async (tx: TransactionClient) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { ticketType: true } } },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.userId !== userId) {
        throw new ForbiddenException('Order does not belong to user');
      }

      // Check idempotency key FIRST - allows duplicate requests to return existing payment
      const existingPayment = await tx.payment.findUnique({
        where: { idempotencyKey },
      });

      if (existingPayment) {
        return { payment: existingPayment, isNew: false };
      }

      // Then check order status - must be PENDING for new payments
      if (order.status !== OrderStatus.PENDING) {
        throw new BadRequestException('Order is not pending');
      }

      const payment = await tx.payment.create({
        data: {
          orderId,
          status: PaymentStatus.PENDING,
          amount: order.totalAmount,
          currency: order.currency,
          provider: 'mock',
          idempotencyKey,
        },
      });

      const chargeResult = await this.paymentProvider.charge(
        Number(order.totalAmount),
        order.currency,
        { orderId, paymentId: payment.id },
      );

      if (chargeResult.succeeded) {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.SUCCEEDED,
            providerPaymentId: chargeResult.providerPaymentId,
          },
        });

        await tx.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.PAID },
        });

        await tx.ticketReservation.updateMany({
          where: {
            userId,
            ticketTypeId: { in: order.items.map((i) => i.ticketTypeId) },
            status: ReservationStatus.ACTIVE,
          },
          data: { status: ReservationStatus.CONFIRMED },
        });

        const tickets = await this.ticketsService.generateTicketsForOrder(orderId, tx);

        const eventId = order.items[0]?.ticketType?.eventId;
        if (eventId) {
          this.realtime.emitToEvent(eventId, 'ticket.purchased', {
            orderId,
            userId,
            ticketsCount: tickets.length,
          });
        }

        await this.notifications.create({
          userId,
          type: 'payment.succeeded',
          title: 'Payment Successful',
          message: `Your payment of ${order.totalAmount} ${order.currency} was successful.`,
          data: { orderId, paymentId: payment.id, amount: order.totalAmount.toString(), currency: order.currency },
        });

        const user = await tx.user.findUnique({ where: { id: userId } });
        if (user?.email) {
          await this.emailService.sendPaymentSucceededEmail(user.email, {
            orderId,
            amount: order.totalAmount.toString(),
            currency: order.currency,
          });

          const ticketTypeMap = new Map(order.items.map((item) => [item.ticketTypeId, item.ticketType]));
          const eventTitle = order.items[0]?.ticketType?.eventId ? 'Event' : 'Event';
          await this.emailService.sendTicketPurchasedEmail(user.email, {
            orderId,
            tickets: tickets.map((t) => {
              const tt = ticketTypeMap.get(t.ticketTypeId);
              return {
                ticketCode: t.ticketCode,
                eventTitle,
                ticketType: tt?.name ?? 'Ticket',
              };
            }),
          });
        }

        return { payment: await tx.payment.findUnique({ where: { id: payment.id } }), isNew: true };
      } else {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            providerPaymentId: chargeResult.providerPaymentId,
          },
        });

        return { payment: await tx.payment.findUnique({ where: { id: payment.id } }), isNew: true };
      }
    });
  }

  async findOne(paymentId: string, userId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.order.userId !== userId) {
      throw new ForbiddenException('Payment does not belong to user');
    }

    return payment;
  }
}