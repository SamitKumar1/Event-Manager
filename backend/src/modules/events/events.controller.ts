import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { OrganizationRole, Role } from '@prisma/client';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgMembershipGuard } from '../organizations/guards/org-membership.guard';
import { OrgRolesGuard } from '../organizations/guards/org-roles.guard';
import { OrgRoles } from '../organizations/decorators/org-roles.decorator';

import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Controller('organizations/:organizationId/events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly service: EventsService) {}

  @Post()
  @UseGuards(OrgMembershipGuard, OrgRolesGuard)
  @OrgRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('organizationId') organizationId: string,
    @Req() req: Request & { user: { sub: string; email: string; role: Role } },
    @Body() dto: CreateEventDto,
  ) {
    return this.service.create(organizationId, req.user.sub, dto);
  }

  @Get()
  @UseGuards(OrgMembershipGuard)
  async findAll(
    @Param('organizationId') organizationId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.service.findAllByOrganization(organizationId, Number(page), Number(limit));
  }

  @Get(':id')
  @UseGuards(OrgMembershipGuard)
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @UseGuards(OrgMembershipGuard, OrgRolesGuard)
  @OrgRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  async update(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
    @Req() req: Request & { user: { sub: string; email: string; role: Role } },
    @Body() dto: UpdateEventDto,
  ) {
    return this.service.update(id, req.user.sub, organizationId, dto);
  }

  @Delete(':id')
  @UseGuards(OrgMembershipGuard, OrgRolesGuard)
  @OrgRoles(OrganizationRole.OWNER)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('organizationId') organizationId: string, @Param('id') id: string) {
    return this.service.remove(id, organizationId);
  }

  @Post(':id/publish')
  @UseGuards(OrgMembershipGuard, OrgRolesGuard)
  @OrgRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async publish(@Param('organizationId') organizationId: string, @Param('id') id: string) {
    return this.service.publish(id, organizationId);
  }

  @Post(':id/cancel')
  @UseGuards(OrgMembershipGuard, OrgRolesGuard)
  @OrgRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('organizationId') organizationId: string, @Param('id') id: string) {
    return this.service.cancel(id, organizationId);
  }
}