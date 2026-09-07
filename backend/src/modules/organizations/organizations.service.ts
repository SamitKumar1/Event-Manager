import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { Role, OrganizationRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, userRole: Role, dto: CreateOrganizationDto) {
    if (userRole === Role.ATTENDEE) {
      throw new ForbiddenException('Attendees cannot create organizations');
    }

    const existing = await this.prisma.organization.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException('Slug already in use');
    }

    const organization = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        logoUrl: dto.logoUrl,
        website: dto.website,
        members: {
          create: {
            userId,
            role: OrganizationRole.OWNER,
          },
        },
      },
      include: { members: true },
    });

    return organization;
  }

  async findAll(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.organization.findMany({
        where: { members: { some: { userId } } },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.organization.count({ where: { members: { some: { userId } } } }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(userId: string, orgId: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, members: { some: { userId } } },
      include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async update(userId: string, orgId: string, dto: UpdateOrganizationDto) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } },
    });
    const allowedRoles: OrganizationRole[] = [OrganizationRole.OWNER, OrganizationRole.ADMIN];
    if (!membership || !allowedRoles.includes(membership.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    if (dto.slug) {
      const existing = await this.prisma.organization.findUnique({ where: { slug: dto.slug } });
      if (existing && existing.id !== orgId) throw new ConflictException('Slug already in use');
    }

    return this.prisma.organization.update({ where: { id: orgId }, data: dto });
  }

  async delete(userId: string, orgId: string) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } },
    });
    if (!membership || membership.role !== OrganizationRole.OWNER) {
      throw new ForbiddenException('Only owner can delete organization');
    }

    await this.prisma.organization.delete({ where: { id: orgId } });
    return { message: 'Organization deleted' };
  }

  async addMember(actorUserId: string, orgId: string, dto: InviteMemberDto) {
    const actorMembership = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: actorUserId, organizationId: orgId } },
    });
    const allowedRoles: OrganizationRole[] = [OrganizationRole.OWNER, OrganizationRole.ADMIN];
    if (!actorMembership || !allowedRoles.includes(actorMembership.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const targetUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!targetUser) throw new NotFoundException('User not found');

    const existing = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: targetUser.id, organizationId: orgId } },
    });
    if (existing) throw new ConflictException('User already a member');

    const member = await this.prisma.organizationMember.create({
      data: { userId: targetUser.id, organizationId: orgId, role: dto.role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return member;
  }

  async getMembers(userId: string, orgId: string, page = 1, limit = 10) {
    await this.findOne(userId, orgId); // ensures membership
    const skip = (page - 1) * limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.organizationMember.findMany({
        where: { organizationId: orgId },
        skip,
        take: limit,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { joinedAt: 'asc' },
      }),
      this.prisma.organizationMember.count({ where: { organizationId: orgId } }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async updateMemberRole(actorUserId: string, orgId: string, targetUserId: string, dto: UpdateMemberRoleDto) {
    const actorMembership = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: actorUserId, organizationId: orgId } },
    });
    const allowedRoles: OrganizationRole[] = [OrganizationRole.OWNER, OrganizationRole.ADMIN];
    if (!actorMembership || !allowedRoles.includes(actorMembership.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const targetMembership = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
    });
    if (!targetMembership) throw new NotFoundException('Member not found');

    // Prevent non-owner from assigning OWNER or modifying OWNER
    if (actorMembership.role !== OrganizationRole.OWNER) {
      if (dto.role === OrganizationRole.OWNER || targetMembership.role === OrganizationRole.OWNER) {
        throw new ForbiddenException('Only owner can manage owner role');
      }
    }

    const updated = await this.prisma.organizationMember.update({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
      data: { role: dto.role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return updated;
  }

  async removeMember(actorUserId: string, orgId: string, targetUserId: string) {
    const actorMembership = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: actorUserId, organizationId: orgId } },
    });
    const targetMembership = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
    });
    if (!targetMembership) throw new NotFoundException('Member not found');

    const allowedManageRoles: OrganizationRole[] = [OrganizationRole.OWNER, OrganizationRole.ADMIN];
    // Allow self-removal, or owner/admin removing others (owner can remove admin)
    const isSelf = actorUserId === targetUserId;
    const canManage = actorMembership && allowedManageRoles.includes(actorMembership.role);
    if (!isSelf && !canManage) throw new ForbiddenException('Insufficient permissions');
    if (!isSelf && actorMembership!.role !== OrganizationRole.OWNER && targetMembership.role === OrganizationRole.ADMIN) {
      throw new ForbiddenException('Only owner can remove admin');
    }

    await this.prisma.organizationMember.delete({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
    });
    return { message: 'Member removed' };
  }
}