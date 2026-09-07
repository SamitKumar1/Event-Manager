import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class CheckinService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeService,
    private notifications: NotificationsService,
    private emailService: EmailService,
  ) {}

  async checkIn(eventId: string, qrToken: string) {
    // 1. Find ticket using qrToken
    const ticket = await this.prisma.ticket.findUnique({
      where: { qrToken },
      include: {
        ticketType: {
          include: {
            event: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // 2. Verify ticket belongs to the supplied eventId
    if (ticket.ticketType.eventId !== eventId) {
      throw new ForbiddenException('Ticket does not belong to this event');
    }

    // 3. Verify status is VALID
    if (ticket.status !== TicketStatus.VALID) {
      if (ticket.status === TicketStatus.USED) {
        throw new ConflictException('Ticket already checked in');
      }
      if (ticket.status === TicketStatus.CANCELLED) {
        throw new BadRequestException('Ticket is cancelled');
      }
      throw new BadRequestException('Ticket is not valid for check-in');
    }

    // 4. Atomically change VALID -> USED and set checkedInAt
    const updated = await this.prisma.ticket.updateMany({
      where: {
        id: ticket.id,
        status: TicketStatus.VALID,
      },
      data: {
        status: TicketStatus.USED,
        checkedInAt: new Date(),
      },
    });

    if (updated.count === 0) {
      // Another concurrent check-in succeeded
      throw new ConflictException('Ticket already checked in');
    }

    // Fetch updated ticket with relations for response
    const updatedTicket = await this.prisma.ticket.findUnique({
      where: { id: ticket.id },
      include: {
        ticketType: {
          include: {
            event: true,
          },
        },
      },
    });

    // Emit realtime event
    this.realtime.emitToEvent(eventId, 'ticket.checked_in', {
      ticketId: updatedTicket!.id,
      ticketCode: updatedTicket!.ticketCode,
      checkedInAt: updatedTicket!.checkedInAt,
    });

    // Notify ticket owner
    await this.notifications.create({
      userId: updatedTicket!.userId,
      type: 'ticket.checked_in',
      title: 'Ticket Checked In',
      message: `Your ticket "${updatedTicket!.ticketCode}" has been checked in.`,
      data: {
        ticketId: updatedTicket!.id,
        eventId,
        checkedInAt: updatedTicket!.checkedInAt,
      },
    });

    // Send check-in email to ticket owner
    try {
      const ticketOwner = await this.prisma.user.findUnique({ where: { id: updatedTicket!.userId }, select: { email: true } });
      if (ticketOwner?.email) {
        await this.emailService.sendEmail(
          ticketOwner.email,
          `Ticket Checked In: ${updatedTicket!.ticketCode}`,
          `<p>Your ticket <strong>${updatedTicket!.ticketCode}</strong> for event <strong>${updatedTicket!.ticketType?.event?.title}</strong> has been checked in at ${updatedTicket!.checkedInAt?.toISOString()}.</p>`
        );
      }
    } catch (err) {
      console.error('Email send failed on check-in:', err);
    }

    return {
      id: updatedTicket!.id,
      ticketCode: updatedTicket!.ticketCode,
      status: updatedTicket!.status,
      checkedInAt: updatedTicket!.checkedInAt,
      ticketType: {
        id: updatedTicket!.ticketType.id,
        name: updatedTicket!.ticketType.name,
      },
      event: {
        id: updatedTicket!.ticketType.event.id,
        title: updatedTicket!.ticketType.event.title,
      },
    };
  }
}