import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationRole } from '@prisma/client';

import { ORG_ROLES_KEY } from '../decorators/org-roles.decorator';

@Injectable()
export class OrgRolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<OrganizationRole[]>(ORG_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const membership = request.orgMembership;
    if (!membership || !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException('Insufficient organization permissions');
    }
    return true;
  }
}