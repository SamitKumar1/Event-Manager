import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgMembershipGuard } from '../organizations/guards/org-membership.guard';
import { EventOrgMembershipGuard } from '../events/guards/event-org-membership.guard';
import { OrgRolesGuard } from '../organizations/guards/org-roles.guard';
import { OrgRoles } from '../organizations/decorators/org-roles.decorator';

import { AnalyticsService } from './analytics.service';

@Controller()
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('organizations/:organizationId/analytics')
  @UseGuards(JwtAuthGuard, OrgMembershipGuard, OrgRolesGuard)
  @OrgRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  async getOrgAnalytics(@Param('organizationId') organizationId: string) {
    return this.service.getOrganizationAnalytics(organizationId);
  }

  @Get('events/:eventId/analytics')
  @UseGuards(JwtAuthGuard, EventOrgMembershipGuard, OrgRolesGuard)
  @OrgRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  async getEventAnalytics(@Param('eventId') eventId: string) {
    return this.service.getEventAnalytics(eventId);
  }
}