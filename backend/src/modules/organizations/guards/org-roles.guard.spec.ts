import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgRolesGuard } from './org-roles.guard';
import { ORG_ROLES_KEY } from '../decorators/org-roles.decorator';
import { OrganizationRole } from '@prisma/client';

describe('OrgRolesGuard', () => {
  let guard: OrgRolesGuard;
  let reflector: Reflector;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new OrgRolesGuard(reflector);

    mockContext = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ orgMembership: { role: OrganizationRole.ADMIN } }),
      }),
    } as unknown as ExecutionContext;
  });

  it('should allow when no roles metadata', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('should allow when user org role matches required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([OrganizationRole.ADMIN]);
    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('should throw ForbiddenException when role does not match', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([OrganizationRole.OWNER]);
    const ctx = {
      ...mockContext,
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ orgMembership: { role: OrganizationRole.MEMBER } }),
      }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});