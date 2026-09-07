import type { Request } from 'express';
import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { OrganizationRole, Role } from '@prisma/client';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

import { OrgMembershipGuard } from './guards/org-membership.guard';
import { OrgRolesGuard } from './guards/org-roles.guard';
import { OrgRoles } from './decorators/org-roles.decorator';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Req() req: Request & { user: { sub: string; email: string; role: Role } }, @Body() dto: CreateOrganizationDto) {
    return this.service.create(req.user.sub, req.user.role, dto);
  }

  @Get()
  findAll(@Req() req: Request & { user: { sub: string; email: string; role: Role } }, @Query('page') page = 1, @Query('limit') limit = 10) {
    return this.service.findAll(req.user.sub, Number(page), Number(limit));
  }

  @UseGuards(OrgMembershipGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request & { user: { sub: string; email: string; role: Role } }) {
    return this.service.findOne(req.user.sub, id);
  }

  @UseGuards(OrgMembershipGuard, OrgRolesGuard)
  @OrgRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Req() req: Request & { user: { sub: string; email: string; role: Role } }, @Body() dto: UpdateOrganizationDto) {
    return this.service.update(req.user.sub, id, dto);
  }

  @UseGuards(OrgMembershipGuard, OrgRolesGuard)
  @OrgRoles(OrganizationRole.OWNER)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  delete(@Param('id') id: string, @Req() req: Request & { user: { sub: string; email: string; role: Role } }) {
    return this.service.delete(req.user.sub, id);
  }

  // Members
  @UseGuards(OrgMembershipGuard, OrgRolesGuard)
  @OrgRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  addMember(@Param('id') id: string, @Req() req: Request & { user: { sub: string; email: string; role: Role } }, @Body() dto: InviteMemberDto) {
    return this.service.addMember(req.user.sub, id, dto);
  }

  @UseGuards(OrgMembershipGuard)
  @Get(':id/members')
  getMembers(@Param('id') id: string, @Req() req: Request & { user: { sub: string; email: string; role: Role } }, @Query('page') page = 1, @Query('limit') limit = 10) {
    return this.service.getMembers(req.user.sub, id, Number(page), Number(limit));
  }

  @UseGuards(OrgMembershipGuard, OrgRolesGuard)
  @OrgRoles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  @Patch(':id/members/:userId')
  updateMemberRole(@Param('id') id: string, @Param('userId') userId: string, @Req() req: Request & { user: { sub: string; email: string; role: Role } }, @Body() dto: UpdateMemberRoleDto) {
    return this.service.updateMemberRole(req.user.sub, id, userId, dto);
  }

  @UseGuards(OrgMembershipGuard)
  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.OK)
  removeMember(@Param('id') id: string, @Param('userId') userId: string, @Req() req: Request & { user: { sub: string; email: string; role: Role } }) {
    return this.service.removeMember(req.user.sub, id, userId);
  }
}