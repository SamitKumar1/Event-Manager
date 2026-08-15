import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class TicketTypeOrgMembershipGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const ticketTypeId = request.params.id;
    if (!ticketTypeId) {
      throw new NotFoundException('Ticket type ID not provided');
    }

    const ticketType = await this.prisma.ticketType.findUnique({
      where: { id: ticketTypeId },
      select: { event: { select: { organizationId: true } } },
    });
    if (!ticketType) {
      throw new NotFoundException('Ticket type not found');
    }

    const organizationId = ticketType.event.organizationId;

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: user.sub,
          organizationId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('User is not a member of this organization');
    }

    request.orgMembership = membership;
    request.eventOrganizationId = organizationId;
    return true;
  }
}