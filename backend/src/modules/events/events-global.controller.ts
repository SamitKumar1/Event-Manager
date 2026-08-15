import {
  Controller,
  Get,
  Patch,
  Delete,
  Post,
  Param,
  Body,
  Request,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { EventOrgMembershipGuard } from './guards/event-org-membership.guard';
import { OrgRolesGuard } from '../organizations/guards/org-roles.guard';
import { OrgRoles } from '../organizations/decorators/org-roles.decorator';
import { OrganizationRole } from '@prisma/client';
import { EventsService } from './events.service';
import { UpdateEventDto } from './dto/update-event.dto';


@Controller('events')
export class EventsGlobalController {
  constructor(private readonly service: EventsService) {}

  @Get()
  async findPublished(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.service.findPublished(Number(page), Number(limit));
  }

  @Get(':id')
  async findOnePublic(@Param('id') id: string) {
    return this.service.findOnePublic(id);
  }

  @UseGuards(JwtAuthGuard, EventOrgMembershipGuard)
  @Get('org/:id')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @UseGuards(EventOrgMembershipGuard, OrgRolesGuard)
  @OrgRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  @Patch(':id')
  async update(@Param('id') id: string, @Request() req: any, @Body() dto: UpdateEventDto) {
    const orgId = req.eventOrganizationId;
    return this.service.update(id, req.user.sub, orgId, dto);
  }

  @UseGuards(EventOrgMembershipGuard, OrgRolesGuard)
  @OrgRoles(OrganizationRole.OWNER)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @Request() req: any) {
    const orgId = req.eventOrganizationId;
    return this.service.remove(id, orgId);
  }

  @UseGuards(EventOrgMembershipGuard, OrgRolesGuard)
  @OrgRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  async publish(@Param('id') id: string, @Request() req: any) {
    const orgId = req.eventOrganizationId;
    return this.service.publish(id, orgId);
  }

  @UseGuards(EventOrgMembershipGuard, OrgRolesGuard)
  @OrgRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id') id: string, @Request() req: any) {
    const orgId = req.eventOrganizationId;
    return this.service.cancel(id, orgId);
  }
}