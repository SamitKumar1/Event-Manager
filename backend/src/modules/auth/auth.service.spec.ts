import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    jest.clearAllMocks();
  });

  const registerDto: RegisterDto = {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'secure-password',
  };

  const loginDto: LoginDto = {
    email: 'john@example.com',
    password: 'secure-password',
  };

  it('should register a new user and return safe user object', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const createdUser = {
      id: 'uuid-123',
      name: registerDto.name,
      email: registerDto.email,
      role: 'ATTENDEE' as const,
      createdAt: new Date(),
    };
    mockPrisma.user.create.mockResolvedValue(createdUser);

    const result = await service.register(registerDto);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: registerDto.email },
    });
    expect(prisma.user.create).toHaveBeenCalled();
    expect(result).toEqual(createdUser);
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('should throw ConflictException when email already exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing', email: registerDto.email });

    await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: registerDto.email },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  // LOGIN TESTS
  it('should login successfully and return accessToken and safe user', async () => {
    const hashedPassword = await bcrypt.hash(loginDto.password, 10);
    const user = {
      id: 'uuid-123',
      name: 'John Doe',
      email: loginDto.email,
      passwordHash: hashedPassword,
      role: 'ATTENDEE' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrisma.user.findUnique.mockResolvedValue(user);
    mockJwtService.sign.mockReturnValue('mock-jwt-token');

    const result = await service.login(loginDto);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: loginDto.email } });
    expect(jwtService.sign).toHaveBeenCalledWith({ sub: user.id, email: user.email, role: user.role });
    expect(result).toEqual({
      accessToken: 'mock-jwt-token',
      user: expect.objectContaining({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      }),
    });
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('should throw UnauthorizedException for unknown email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: loginDto.email } });
    expect(jwtService.sign).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException for wrong password', async () => {
    const hashedPassword = await bcrypt.hash('different-password', 10);
    const user = {
      id: 'uuid-123',
      name: 'John Doe',
      email: loginDto.email,
      passwordHash: hashedPassword,
      role: 'ATTENDEE' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrisma.user.findUnique.mockResolvedValue(user);

    await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: loginDto.email } });
    expect(jwtService.sign).not.toHaveBeenCalled();
  });
});