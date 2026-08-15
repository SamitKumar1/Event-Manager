import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';
import { OrganizationRole } from '@prisma/client';

@Injectable()
export class TicketingService {
  constructor(private prisma: PrismaService) {}

  private validateDates(startAt: string, endAt: string) {
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (start >= end) {
      throw new BadRequestException('salesStartAt must be before salesEndAt');
    }
  }

  private allowedWriteRoles: OrganizationRole[] = [OrganizationRole.OWNER, OrganizationRole.ADMIN];

  async create(eventId: string, _userId: string, userRole: OrganizationRole, dto: CreateTicketTypeDto) {
    if (!this.allowedWriteRoles.includes(userRole)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // basic value validation
    if (dto.price < 0) throw new BadRequestException('price must be non-negative');
    if (dto.quantity <= 0) throw new BadRequestException('quantity must be greater than zero');
    this.validateDates(dto.salesStartAt, dto.salesEndAt);

    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const existing = await this.prisma.ticketType.findUnique({
      where: { eventId_name: { eventId, name: dto.name } },
    });
    if (existing) throw new ConflictException('Ticket type name already exists for this event');

    return this.prisma.ticketType.create({
      data: {
        ...dto,
        price: dto.price,
        quantity: dto.quantity,
        salesStartAt: new Date(dto.salesStartAt),
        salesEndAt: new Date(dto.salesEndAt),
        eventId,
      },
    });
  }

  async findAllByEvent(eventId: string, page = 1, limit = 20) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const skip = (page - 1) * limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ticketType.findMany({
        where: { eventId },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.ticketType.count({ where: { eventId } }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(ticketTypeId: string) {
    const tt = await this.prisma.ticketType.findUnique({ where: { id: ticketTypeId } });
    if (!tt) throw new NotFoundException('Ticket type not found');
    return tt;
  }

  async update(ticketTypeId: string, _userId: string, userRole: OrganizationRole, dto: UpdateTicketTypeDto) {
    if (!this.allowedWriteRoles.includes(userRole)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const existing = await this.prisma.ticketType.findUnique({ where: { id: ticketTypeId } });
    if (!existing) throw new NotFoundException('Ticket type not found');

    if (dto.price !== undefined && dto.price < 0) throw new BadRequestException('price must be non-negative');
    if (dto.quantity !== undefined && dto.quantity <= 0) throw new BadRequestException('quantity must be greater than zero');

    if (dto.salesStartAt || dto.salesEndAt) {
      const start = dto.salesStartAt ?? existing.salesStartAt.toISOString();
      const end = dto.salesEndAt ?? existing.salesEndAt.toISOString();
      this.validateDates(start, end);
    }

    if (dto.name && dto.name !== existing.name) {
      const dup = await this.prisma.ticketType.findUnique({
        where: { eventId_name: { eventId: existing.eventId, name: dto.name } },
      });
      if (dup) throw new ConflictException('Ticket type name already exists for this event');
    }

    return this.prisma.ticketType.update({
      where: { id: ticketTypeId },
      data: {
        ...dto,
        price: dto.price ?? existing.price,
        quantity: dto.quantity ?? existing.quantity,
        salesStartAt: dto.salesStartAt ? new Date(dto.salesStartAt) : undefined,
        salesEndAt: dto.salesEndAt ? new Date(dto.salesEndAt) : undefined,
      },
    });
  }

  async remove(ticketTypeId: string, userRole: OrganizationRole) {
    if (userRole !== OrganizationRole.OWNER) {
      throw new ForbiddenException('Only owner can delete ticket type');
    }
    const existing = await this.prisma.ticketType.findUnique({ where: { id: ticketTypeId } });
    if (!existing) throw new NotFoundException('Ticket type not found');
    await this.prisma.ticketType.delete({ where: { id: ticketTypeId } });
    return { message: 'Ticket type deleted' };
  }
}