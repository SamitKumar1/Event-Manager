import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { EventOrgMembershipGuard } from '../events/guards/event-org-membership.guard';
import { OrgRolesGuard } from '../organizations/guards/org-roles.guard';
import { OrgRoles } from '../organizations/decorators/org-roles.decorator';
import { OrganizationRole } from '@prisma/client';
import { CheckinService } from './checkin.service';
import { CheckInDto } from './dto/check-in.dto';

@Controller('events/:eventId/check-in')
@UseGuards(JwtAuthGuard, EventOrgMembershipGuard, OrgRolesGuard)
@OrgRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
export class CheckinController {
  constructor(private readonly service: CheckinService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async checkIn(
    @Param('eventId') eventId: string,
    @Body() dto: CheckInDto,
  ) {
    return this.service.checkIn(eventId, dto.qrToken);
  }
}