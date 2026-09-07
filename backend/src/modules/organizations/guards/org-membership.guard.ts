import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class OrgMembershipGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Prefer organizationId param (used by EventsController), fall back to id (used by OrganizationsController)
    const orgId = request.params.organizationId || request.params.id;
    if (!orgId) {
      throw new NotFoundException('Organization ID not provided');
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: user.sub,
          organizationId: orgId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('User is not a member of this organization');
    }

    // Attach membership to request for downstream guards/controllers
    request.orgMembership = membership;
    return true;
  }
}