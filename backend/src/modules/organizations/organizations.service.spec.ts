import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationsService } from './organizations.service';
import { Role, OrganizationRole } from '@prisma/client';

const mockPrisma = {
  organization: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  organizationMember: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('OrganizationsService', () => {
  let service: OrganizationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should throw ForbiddenException for ATTENDEE', async () => {
      await expect(service.create('uid', Role.ATTENDEE, { name: 'Test', slug: 'test' })).rejects.toThrow(ForbiddenException);
    });

    it('should create organization for ORGANIZER', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      mockPrisma.organization.create.mockResolvedValue({ id: 'org-id', name: 'Test', slug: 'test', members: [] });
      const result = await service.create('uid', Role.ORGANIZER, { name: 'Test', slug: 'test' });
      expect(result).toHaveProperty('id', 'org-id');
    });

    it('should throw ConflictException if slug exists', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.create('uid', Role.ADMIN, { name: 'Test', slug: 'test' })).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when not member', async () => {
      mockPrisma.organization.findFirst.mockResolvedValue(null);
      await expect(service.findOne('uid', 'org-id')).rejects.toThrow(NotFoundException);
    });

    it('should return organization when member', async () => {
      const org = { id: 'org-id', name: 'Test', members: [] };
      mockPrisma.organization.findFirst.mockResolvedValue(org);
      const result = await service.findOne('uid', 'org-id');
      expect(result).toEqual(org);
    });
  });

  describe('delete', () => {
    it('should throw ForbiddenException if not owner', async () => {
      mockPrisma.organizationMember.findUnique.mockResolvedValue({ role: OrganizationRole.ADMIN });
      await expect(service.delete('uid', 'org-id')).rejects.toThrow(ForbiddenException);
    });

    it('should delete when owner', async () => {
      mockPrisma.organizationMember.findUnique.mockResolvedValue({ role: OrganizationRole.OWNER });
      mockPrisma.organization.delete.mockResolvedValue({});
      const result = await service.delete('uid', 'org-id');
      expect(result).toEqual({ message: 'Organization deleted' });
    });
  });
});