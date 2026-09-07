import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';

import { OrgMembershipGuard } from './org-membership.guard';

describe('OrgMembershipGuard', () => {
  let guard: OrgMembershipGuard;
  let mockPrisma: Partial<PrismaService>;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    mockPrisma = {
      organizationMember: {
        findUnique: jest.fn(),
      },
    };
    guard = new OrgMembershipGuard(mockPrisma as PrismaService);

    mockContext = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { sub: 'user-id' },
          params: { id: 'org-id' },
        }),
      }),
    } as unknown as ExecutionContext;
  });

  it('should throw ForbiddenException when user not authenticated', async () => {
    const ctx = {
      ...mockContext,
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ params: { id: 'org-id' } }),
      }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should throw NotFoundException when orgId missing', async () => {
    const ctx = {
      ...mockContext,
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user: { sub: 'user-id' }, params: {} }),
      }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException when membership not found', async () => {
    (mockPrisma.organizationMember!.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
  });

  it('should allow when membership exists', async () => {
    (mockPrisma.organizationMember!.findUnique as jest.Mock).mockResolvedValue({ role: 'MEMBER' });
    const result = await guard.canActivate(mockContext);
    expect(result).toBe(true);
  });
});