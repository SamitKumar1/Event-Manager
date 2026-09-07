import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { EventStatus, EventLocationType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';

import { UpdateEventDto } from './dto/update-event.dto';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeService,
    private notifications: NotificationsService,
    private emailService: EmailService,
  ) {}

  private validateDates(startAt: string, endAt: string) {
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (start >= end) {
      throw new BadRequestException('startAt must be before endAt');
    }
  }

  private validateLocationRules(dto: CreateEventDto | UpdateEventDto) {
    const locationType = dto.locationType;
    if (locationType === EventLocationType.PHYSICAL || locationType === EventLocationType.HYBRID) {
      if (!dto.venueName || !dto.address || !dto.city || !dto.country) {
        throw new BadRequestException('Physical/Hybrid events require venueName, address, city, and country');
      }
    }
    if (locationType === EventLocationType.ONLINE) {
      if (!dto.venueName) {
        throw new BadRequestException('Online events require venueName (e.g., platform name)');
      }
    }
  }

  async create(organizationId: string, userId: string, dto: CreateEventDto) {
    this.validateDates(dto.startAt, dto.endAt);
    this.validateLocationRules(dto);

    // check slug uniqueness within organization
    const existing = await this.prisma.event.findUnique({
      where: { organizationId_slug: { organizationId, slug: dto.slug } },
    });
    if (existing) throw new ConflictException('Slug already exists in this organization');

    return this.prisma.event.create({
      data: {
        ...dto,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        organizationId,
        createdById: userId,
        status: EventStatus.DRAFT,
      },
    });
  }

  async findAllByOrganization(organizationId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where: { organizationId },
        skip,
        take: limit,
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.event.count({ where: { organizationId } }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findPublished(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where: { status: EventStatus.PUBLISHED },
        skip,
        take: limit,
        orderBy: { startAt: 'asc' },
        include: { ticketTypes: true },
      }),
      this.prisma.event.count({ where: { status: EventStatus.PUBLISHED } }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOnePublic(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { ticketTypes: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    if (event.status !== EventStatus.PUBLISHED) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  async findOne(eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async update(eventId: string, _userId: string, organizationId: string, dto: UpdateEventDto) {
    const event = await this.findOne(eventId);
    if (event.organizationId !== organizationId) throw new ForbiddenException('Event does not belong to organization');

    if (dto.startAt || dto.endAt) {
      const start = dto.startAt ?? event.startAt.toISOString();
      const end = dto.endAt ?? event.endAt.toISOString();
      this.validateDates(start, end);
    }

    if (dto.locationType) {
      this.validateLocationRules({ ...event, ...dto } as any);
    }

    if (dto.slug && dto.slug !== event.slug) {
      const existing = await this.prisma.event.findUnique({
        where: { organizationId_slug: { organizationId, slug: dto.slug } },
      });
      if (existing) throw new ConflictException('Slug already exists in this organization');
    }

    return this.prisma.event.update({
      where: { id: eventId },
      data: {
        ...dto,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
      },
    });
  }

  async remove(eventId: string, organizationId: string) {
    const event = await this.findOne(eventId);
    if (event.organizationId !== organizationId) throw new ForbiddenException('Event does not belong to organization');
    if (event.status !== EventStatus.DRAFT) {
      throw new ForbiddenException('Only DRAFT events can be deleted');
    }
    await this.prisma.event.delete({ where: { id: eventId } });
    return { message: 'Event deleted' };
  }

  async publish(eventId: string, organizationId: string) {
    const event = await this.findOne(eventId);
    if (event.organizationId !== organizationId) throw new ForbiddenException('Event does not belong to organization');
    if (event.status !== EventStatus.DRAFT) {
      throw new ForbiddenException('Only DRAFT events can be published');
    }
    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: { status: EventStatus.PUBLISHED },
    });
    this.realtime.emitToEvent(eventId, 'event.published', { eventId, title: updated.title });
    this.realtime.emitToOrganization(organizationId, 'event.published', { eventId, title: updated.title });

    // Notify organization members
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      select: { userId: true },
    });
    for (const m of members) {
      await this.notifications.create({
        userId: m.userId,
        type: 'event.published',
        title: 'Event Published',
        message: `Event "${updated.title}" has been published.`,
        data: { eventId: updated.id },
      });
    }

    // Send email to event creator
    try {
      const creator = await this.prisma.user.findUnique({ where: { id: event.createdById }, select: { email: true } });
      if (creator?.email) {
        await this.emailService.sendEmail(
          creator.email,
          `Event Published: ${updated.title}`,
          `<p>Your event <strong>${updated.title}</strong> has been published.</p>`
        );
      }
    } catch (err) {
      console.error('Email send failed on publish:', err);
    }

    return updated;
  }

  async cancel(eventId: string, organizationId: string) {
    const event = await this.findOne(eventId);
    if (event.organizationId !== organizationId) throw new ForbiddenException('Event does not belong to organization');
    if (event.status !== EventStatus.DRAFT && event.status !== EventStatus.PUBLISHED) {
      throw new ForbiddenException('Only DRAFT or PUBLISHED events can be cancelled');
    }
    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: { status: EventStatus.CANCELLED },
    });
    this.realtime.emitToEvent(eventId, 'event.cancelled', { eventId, title: updated.title });
    this.realtime.emitToOrganization(organizationId, 'event.cancelled', { eventId, title: updated.title });

    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      select: { userId: true },
    });
    for (const m of members) {
      await this.notifications.create({
        userId: m.userId,
        type: 'event.cancelled',
        title: 'Event Cancelled',
        message: `Event "${updated.title}" has been cancelled.`,
        data: { eventId: updated.id },
      });
    }

    // Send cancellation email to event creator
    try {
      const creator = await this.prisma.user.findUnique({ where: { id: event.createdById }, select: { email: true } });
      if (creator?.email) {
        await this.emailService.sendEmail(
          creator.email,
          `Event Cancelled: ${updated.title}`,
          `<p>Your event <strong>${updated.title}</strong> has been cancelled.</p>`
        );
      }
    } catch (err) {
      console.error('Email send failed on cancel:', err);
    }

    return updated;
  }
}