import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { EventOrgMembershipGuard } from '../events/guards/event-org-membership.guard';
import { OrgRolesGuard } from '../organizations/guards/org-roles.guard';
import { OrgRoles } from '../organizations/decorators/org-roles.decorator';
import { OrganizationRole } from '@prisma/client';
import { TicketingService } from './ticketing.service';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';
import { TicketTypeOrgMembershipGuard } from './guards/ticket-type-org-membership.guard';

@Controller('events/:eventId/ticket-types')
@UseGuards(JwtAuthGuard)
export class TicketingController {
  constructor(private readonly service: TicketingService) {}

  @Post()
  @UseGuards(EventOrgMembershipGuard, OrgRolesGuard)
  @OrgRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('eventId') eventId: string,
    @Request() req: any,
    @Body() dto: CreateTicketTypeDto,
  ) {
    return this.service.create(eventId, req.user.sub, req.orgMembership.role, dto);
  }

  @Get()
  @UseGuards(EventOrgMembershipGuard)
  async findAll(
    @Param('eventId') eventId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.service.findAllByEvent(eventId, Number(page), Number(limit));
  }
}

@Controller('ticket-types')
@UseGuards(JwtAuthGuard)
export class TicketTypesGlobalController {
  constructor(private readonly service: TicketingService) {}

  @UseGuards(TicketTypeOrgMembershipGuard)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @UseGuards(TicketTypeOrgMembershipGuard, OrgRolesGuard)
  @OrgRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  @Patch(':id')
  async update(@Param('id') id: string, @Request() req: any, @Body() dto: UpdateTicketTypeDto) {
    return this.service.update(id, req.user.sub, req.orgMembership.role, dto);
  }

  @UseGuards(TicketTypeOrgMembershipGuard, OrgRolesGuard)
  @OrgRoles(OrganizationRole.OWNER)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.service.remove(id, req.orgMembership.role);
  }
}